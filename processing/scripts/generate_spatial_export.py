"""Build validated per-cell IMERG exports; writing requires the explicit --publish flag."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

import numpy as np

PROCESSING_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PROCESSING_DIR.parent
if str(PROCESSING_DIR) not in sys.path:
    sys.path.insert(0, str(PROCESSING_DIR))

from extraction.gpm_extractor import GPMExtractor

EXPECTED_CELL_COUNT = 750
SPATIAL_RESOLUTION = 0.1
AGGREGATE_TOLERANCE = 0.0051  # source aggregates may be rounded to two decimal places
GRANULE_TIMESTAMP = re.compile(r"3IMERG\.(\d{8})-S(\d{6})-")
TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
DATA_FILES = {
    "amazon_central": (
        "amazon/observations.json",
        "amazon/observations_afternoon.json",
        "amazon/observations_day_windows.json",
    ),
    "congo_basin_kisangani": ("congo/observations.json",),
}
GEOMETRY_FILES = {
    "amazon_central": PROCESSING_DIR / "geometry" / "amazon" / "central_amazon_bbox.geojson",
    "congo_basin_kisangani": PROCESSING_DIR / "geometry" / "international" / "congo_basin_kisangani_bbox.geojson",
}


def _fail(region: str, timestamp: str, detail: str) -> ValueError:
    return ValueError(f"{region} {timestamp}: {detail}")


def _validate_timestamp(value: Any, region: str) -> str:
    if not isinstance(value, str) or not TIMESTAMP.fullmatch(value):
        raise ValueError(f"Timestamp UTC inválido para {region}: {value!r}.")
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise ValueError(f"Timestamp UTC inválido para {region}: {value!r}.") from exc
    return value


def timestamp_from_granule(path: str | Path) -> str:
    match = GRANULE_TIMESTAMP.search(Path(path).name)
    if not match:
        raise ValueError(f"Nome de grânulo IMERG inválido: {Path(path).name}")
    date, time = match.groups()
    return f"{date[:4]}-{date[4:6]}-{date[6:8]}T{time[:2]}:{time[2:4]}:{time[4:]}Z"


def _axis_order(axis: Any, name: str) -> tuple[np.ndarray, np.ndarray]:
    source = np.asarray(axis)
    values = source.astype(float)
    if values.ndim != 1 or values.size < 2 or not np.isfinite(values).all():
        raise ValueError(f"Eixo {name} inválido.")
    lower, upper = (-90.0, 90.0) if name == "latitude" else (-180.0, 180.0)
    if np.any((values < lower) | (values > upper)):
        raise ValueError(f"Eixo {name} fora dos limites WGS84.")
    precision_tolerance = max(
        1e-6,
        float(np.finfo(source.dtype).eps * np.max(np.abs(values)))
        if np.issubdtype(source.dtype, np.floating) else 0.0,
    )
    nominal_values = np.round(values, 2)
    if np.any(np.abs(values - nominal_values) > precision_tolerance):
        raise ValueError(f"Eixo {name} não está alinhado aos centros da grade IMERG.")
    values = nominal_values
    differences = np.diff(values)
    if not (np.all(differences > 0) or np.all(differences < 0)):
        raise ValueError(f"Eixo {name} deve ser estritamente monotônico.")
    order = np.argsort(values)
    sorted_values = values[order]
    if np.any(np.abs(np.diff(sorted_values) - SPATIAL_RESOLUTION) > 1e-6):
        raise ValueError(f"Eixo {name} não corresponde à resolução de 0,1°.")
    return sorted_values, order


def normalize_granule(
    raw: Mapping[str, Any],
    bounding_box: Mapping[str, float],
    *,
    expected_cell_count: int = EXPECTED_CELL_COUNT,
) -> tuple[list[float], list[float], list[list[float | None]]]:
    if raw.get("units_attribute_present") is not True:
        raise ValueError("HDF5 units attribute is absent; units cannot be assumed.")
    if raw.get("fill_value_attribute_present") is not True or raw.get("fill_value") is None:
        raise ValueError("HDF5 _FillValue attribute is absent; missing data cannot be identified.")
    units = raw.get("units")
    if isinstance(units, bytes):
        units = units.decode("utf-8", errors="strict")
    if not isinstance(units, str) or units.strip().lower().replace(" ", "") not in {"mm/hr", "mm/h", "mm/hour"}:
        raise ValueError(f"Unidade IMERG incompatível: {units!r}; esperado mm/h.")

    latitudes, lat_order = _axis_order(raw.get("latitudes"), "latitude")
    longitudes, lon_order = _axis_order(raw.get("longitudes"), "longitude")
    matrix = np.asarray(raw.get("precipitation_matrix"), dtype=float)
    if matrix.shape != (lat_order.size, lon_order.size):
        raise ValueError("Dimensões da matriz não correspondem aos eixos latitude/longitude.")
    matrix = matrix[np.ix_(lat_order, lon_order)]

    lat_mask = (latitudes >= bounding_box["min_latitude"]) & (latitudes <= bounding_box["max_latitude"])
    lon_mask = (longitudes >= bounding_box["min_longitude"]) & (longitudes <= bounding_box["max_longitude"])
    latitudes, longitudes = latitudes[lat_mask], longitudes[lon_mask]
    matrix = matrix[np.ix_(lat_mask, lon_mask)]
    if matrix.size != expected_cell_count:
        raise ValueError(f"Recorte contém {matrix.size} células; esperado {expected_cell_count}.")
    if matrix.shape != (latitudes.size, longitudes.size):
        raise ValueError("Dimensões do recorte incompatíveis com os eixos.")
    for axis, lower, upper, name in (
        (latitudes, bounding_box["min_latitude"], bounding_box["max_latitude"], "latitude"),
        (longitudes, bounding_box["min_longitude"], bounding_box["max_longitude"], "longitude"),
    ):
        if abs(axis[0] - (lower + SPATIAL_RESOLUTION / 2)) > 1e-6 or abs(axis[-1] - (upper - SPATIAL_RESOLUTION / 2)) > 1e-6:
            raise ValueError(f"Cell-center {name} axis does not match bounding-box edges.")

    fill = float(raw["fill_value"])
    valid = np.isfinite(matrix) & (matrix >= 0)
    valid &= matrix != fill
    values = np.where(valid, matrix, np.nan).tolist()
    return latitudes.tolist(), longitudes.tolist(), [
        [None if not math.isfinite(value) else value for value in row] for row in values
    ]


def _indicators(values: Sequence[Sequence[float | None]], latitudes: Sequence[float], threshold_rate_mm_h: float) -> tuple[float | None, float | None, int]:
    valid = np.asarray([[value is not None for value in row] for row in values], dtype=bool)
    numeric = np.asarray([[0.0 if value is None else value for value in row] for row in values], dtype=float)
    weights = np.cos(np.deg2rad(np.asarray(latitudes, dtype=float)))[:, None] * np.ones(numeric.shape)
    valid_weights = weights * valid
    denominator = float(valid_weights.sum())
    if denominator <= 0:
        return None, None, int(valid.sum())
    valid_count = int(valid.sum())
    mean = float((numeric * valid_weights).sum() / denominator) if valid_count / valid.size >= 0.10 else None
    rain_fraction = float((weights * valid * (numeric >= threshold_rate_mm_h)).sum() / denominator)
    return mean, rain_fraction, valid_count


def _validate_dataset(dataset: Mapping[str, Any], region: str, path: str) -> tuple[dict[str, float], dict[str, dict[str, Any]]]:
    if dataset.get("region_id") != region or dataset.get("phenomenon") != "precipitation" or dataset.get("is_sample") is not False:
        raise ValueError(f"Dataset {path} não é uma série observacional compatível com {region}.")
    box = dataset.get("bounding_box")
    if not isinstance(box, dict) or set(box) != {"min_latitude", "max_latitude", "min_longitude", "max_longitude"}:
        raise ValueError(f"Bounding box inválida em {path}.")
    if (not all(isinstance(value, (int, float)) and math.isfinite(value) for value in box.values()) or
            not (-90 <= box["min_latitude"] < box["max_latitude"] <= 90) or
            not (-180 <= box["min_longitude"] < box["max_longitude"] <= 180)):
        raise ValueError(f"Limites geográficos inválidos em {path}.")
    observations = dataset.get("observations")
    if not isinstance(observations, list) or not observations:
        raise ValueError(f"Série sem observações em {path}.")
    timestamp_map: dict[str, dict[str, Any]] = {}
    for observation in observations:
        if not isinstance(observation, dict):
            raise ValueError(f"Observação inválida em {path}.")
        timestamp = _validate_timestamp(observation.get("timestamp_utc"), region)
        if timestamp in timestamp_map:
            raise ValueError(f"Timestamp duplicado em {path}: {timestamp}.")
        timestamp_map[timestamp] = observation
    return box, timestamp_map


def build_spatial_export(
    region: str,
    datasets: Sequence[tuple[str, Mapping[str, Any]]],
    granules_by_timestamp: Mapping[str, str | Path],
    read_granule: Callable[[str], Mapping[str, Any]],
    *,
    expected_cell_count: int = EXPECTED_CELL_COUNT,
    expected_bounds: Mapping[str, float] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if region not in DATA_FILES or not datasets:
        raise ValueError(f"Região não suportada ou datasets ausentes: {region}.")
    box: dict[str, float] | None = None
    observations: dict[str, dict[str, Any]] = {}
    product_metadata: tuple[Any, ...] | None = None
    for path, dataset in datasets:
        current_box, current = _validate_dataset(dataset, region, path)
        if box is None:
            box = current_box
        elif current_box != box:
            raise ValueError(f"Bounding boxes divergentes para {region} em {path}.")
        metadata = (dataset.get("data_source"), dataset.get("product_name"), dataset.get("product_version"))
        if product_metadata is None:
            product_metadata = metadata
        elif metadata != product_metadata:
            raise ValueError(f"Metadados do produto divergentes para {region} em {path}.")
        for timestamp, observation in current.items():
            previous = observations.get(timestamp)
            if previous:
                if previous.get("availability") != observation.get("availability"):
                    raise _fail(region, timestamp, "contagens publicadas divergem entre séries fonte.")
                for key in ("mean_precipitation_rate", "rain_area_fraction"):
                    left = previous.get("scientific_indicators", {}).get(key, {}).get("value")
                    right = observation.get("scientific_indicators", {}).get(key, {}).get("value")
                    if left is None and right is None:
                        continue
                    if (not isinstance(left, (int, float)) or not isinstance(right, (int, float)) or
                            not math.isfinite(float(left)) or not math.isfinite(float(right)) or
                            abs(float(left) - float(right)) > AGGREGATE_TOLERANCE):
                        raise _fail(region, timestamp, f"{key} publicado diverge entre séries fonte: {left!r} e {right!r}.")
            observations.setdefault(timestamp, observation)

    assert box is not None and product_metadata is not None
    expected_box = expected_bounds if expected_bounds is not None else _load_region_bounds(region)
    if box != expected_box:
        raise ValueError(f"Bounding box de {region} diverge da geometria definida: {box} != {expected_box}.")
    timestamps = sorted(observations)
    if set(timestamps) != set(granules_by_timestamp):
        missing = sorted(set(timestamps) - set(granules_by_timestamp))
        extra = sorted(set(granules_by_timestamp) - set(timestamps))
        raise ValueError(f"{region}: timestamps de grânulos divergentes; ausentes={missing}, extras={extra}.")

    latitude_centers: list[float] | None = None
    longitude_centers: list[float] | None = None
    matrices: list[dict[str, Any]] = []
    source_variables: dict[str, str] = {}
    for timestamp in timestamps:
        path = granules_by_timestamp[timestamp]
        try:
            raw = read_granule(str(path))
            variable_name = raw.get("variable_name")
            if not isinstance(variable_name, str) or variable_name not in {
                "/Grid/precipitation", "/Grid/precipitationCal", "/Grid/precipitationUncal"
            }:
                raise ValueError(f"Variável HDF5 incompatível: {variable_name!r}.")
            lats, lons, values = normalize_granule(raw, box, expected_cell_count=expected_cell_count)
            source_variables[timestamp] = variable_name
            if latitude_centers is None:
                latitude_centers, longitude_centers = lats, lons
            elif lats != latitude_centers or lons != longitude_centers:
                raise ValueError("Eixos da grade diferem entre timestamps.")

            observation = observations[timestamp]
            availability = observation.get("availability", {})
            total = len(lats) * len(lons)
            missing = total - sum(value is not None for row in values for value in row)
            if availability.get("total_cells_count") != total or availability.get("missing_cells_count") != missing:
                raise ValueError(f"contagens divergentes: matriz missing/total={missing}/{total}, publicado={availability.get('missing_cells_count')}/{availability.get('total_cells_count')}.")
            metrics = observation.get("scientific_indicators", {})
            rain_metric = metrics.get("rain_area_fraction", {})
            threshold = rain_metric.get("threshold_rate_mm_h")
            if not isinstance(threshold, (int, float)) or not math.isfinite(float(threshold)) or threshold < 0:
                raise ValueError("threshold_rate_mm_h ausente ou inválido na observação publicada.")
            mean, fraction, valid_count = _indicators(values, lats, float(threshold))
            valid_ratio = valid_count / total
            availability_status = "available" if valid_ratio >= 0.8 else "partial" if valid_ratio >= 0.1 else "missing"
            published_ratio = availability.get("valid_cells_ratio")
            if (not isinstance(published_ratio, (int, float)) or
                    abs(float(published_ratio) - valid_ratio) > 1e-4 or
                    availability.get("status") != availability_status):
                raise ValueError(
                    f"disponibilidade divergente: razão/status calculados={valid_ratio:.6f}/{availability_status}, "
                    f"publicados={published_ratio!r}/{availability.get('status')!r}."
                )
            for key, actual in (("mean_precipitation_rate", mean), ("rain_area_fraction", fraction)):
                published = metrics.get(key, {}).get("value")
                matches = published is None if actual is None else (
                    isinstance(published, (int, float)) and math.isfinite(float(published)) and
                    abs(actual - float(published)) <= AGGREGATE_TOLERANCE
                )
                if not matches:
                    raise ValueError(f"{key} diverge: recalculado={actual!r}, publicado={published!r}, tolerância={AGGREGATE_TOLERANCE}.")
        except (KeyError, TypeError, ValueError) as exc:
            raise _fail(region, timestamp, str(exc)) from exc
        matrices.append({"timestamp_utc": timestamp, "values": values})

    assert latitude_centers is not None and longitude_centers is not None
    validation_status = "candidate_under_review" if region == "congo_basin_kisangani" else "preliminary_verified"
    matrix_entries = []
    for timestamp, matrix in zip(timestamps, matrices):
        content = json.dumps(matrix, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
        matrix_entries.append({
            "timestamp_utc": timestamp,
            "matrix_path": f"matrices/{timestamp.replace(':', '-')}-{digest}.json",
        })
    manifest = {
        "schema_version": "1.0.0",
        "region_id": region,
        "units": "mm/h",
        "data_source": product_metadata[0],
        "product_name": product_metadata[1],
        "product_version": product_metadata[2],
        "validation_status": validation_status,
        "spatial_resolution_degrees": SPATIAL_RESOLUTION,
        "bounding_box": box,
        "latitude_centers": latitude_centers,
        "longitude_centers": longitude_centers,
        "timestamps": matrix_entries,
        "processing_provenance": {
            "generator": "SONATLAS spatial grid exporter",
            "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "method": "Direct per-cell values from NASA GPM IMERG HDF5; no interpolation or rounding.",
            "source_granules": [
                {
                    "timestamp_utc": timestamp,
                    "filename": Path(granules_by_timestamp[timestamp]).name,
                    "variable_name": source_variables[timestamp],
                }
                for timestamp in timestamps
            ],
        },
    }
    return manifest, matrices


def _load_dataset(relative_path: str) -> dict[str, Any]:
    return json.loads((REPO_ROOT / "frontend" / "public" / "data" / relative_path).read_text(encoding="utf-8"))


def _load_region_bounds(region: str) -> dict[str, float]:
    geometry_path = GEOMETRY_FILES[region]
    document = json.loads(geometry_path.read_text(encoding="utf-8"))
    positions: list[tuple[float, float]] = []

    def collect(value: Any) -> None:
        if isinstance(value, list) and len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
            positions.append((float(value[0]), float(value[1])))
        elif isinstance(value, list):
            for item in value:
                collect(item)

    for feature in document.get("features", []):
        collect(feature.get("geometry", {}).get("coordinates", []))
    if not positions:
        raise ValueError(f"Geometria sem coordenadas para {region}: {geometry_path}.")
    return {
        "min_latitude": min(lat for _, lat in positions),
        "max_latitude": max(lat for _, lat in positions),
        "min_longitude": min(lon for lon, _ in positions),
        "max_longitude": max(lon for lon, _ in positions),
    }


def build_publication() -> dict[str, tuple[dict[str, Any], list[dict[str, Any]]]]:
    datasets = {region: [(path, _load_dataset(path)) for path in paths] for region, paths in DATA_FILES.items()}
    expected = {region: set().union(*(set(_validate_dataset(data, region, path)[1]) for path, data in sources)) for region, sources in datasets.items()}
    granules: dict[str, Path] = {}
    for path in (PROCESSING_DIR / "data" / "raw").glob("3B-HHR-E.*.V07B.HDF5"):
        timestamp = timestamp_from_granule(path)
        if timestamp in set.union(*expected.values()):
            if timestamp in granules:
                raise ValueError(f"Timestamp duplicado em arquivos HDF5: {timestamp}.")
            granules[timestamp] = path
    result = {}
    for region, sources in datasets.items():
        region_granules = {timestamp: path for timestamp, path in granules.items() if timestamp in expected[region]}
        result[region] = build_spatial_export(
            region, sources, region_granules, GPMExtractor.read_imerg_hdf5,
            expected_bounds=_load_region_bounds(region),
        )
    return result


def _atomic_write(path: Path, content: str) -> None:
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def publish(exports: Mapping[str, tuple[Mapping[str, Any], Sequence[Mapping[str, Any]]]]) -> list[Path]:
    """Write only after every region has been built and validated successfully."""
    paths = []
    for region, (manifest, matrices) in exports.items():
        if len(manifest["timestamps"]) != len(matrices):
            raise ValueError(f"Manifesto/matrizes têm contagens diferentes para {region}.")
        output = REPO_ROOT / "frontend" / "public" / "data" / ("amazon" if region == "amazon_central" else "congo") / "spatial"
        output.mkdir(parents=True, exist_ok=True)
        for entry, matrix in zip(manifest["timestamps"], matrices):
            if entry["timestamp_utc"] != matrix.get("timestamp_utc"):
                raise ValueError(f"Timestamp de matriz diverge do manifesto em {region}: {entry['timestamp_utc']}.")
            target = output / entry["matrix_path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            content = json.dumps(matrix, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            _atomic_write(target, content)
            paths.append(target)
        target = output / "manifest.json"
        _atomic_write(target, json.dumps(manifest, ensure_ascii=False, allow_nan=False, indent=2))
        paths.append(target)
    return paths


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="grava os JSONs espaciais após validar todos os timestamps e regiões")
    args = parser.parse_args()
    exports = build_publication()
    counts = {region: len(manifest["timestamps"]) for region, (manifest, _) in exports.items()}
    if not args.publish:
        print(f"Validação concluída; nada gravado: {counts}. Use --publish para publicar.")
        return 0
    print("Arquivos publicados:")
    for path in publish(exports):
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
