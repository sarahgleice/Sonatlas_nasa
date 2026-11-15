"""
Pipeline Universal de Processamento Geoespacial e Científico do SONATLAS.

Capaz de receber qualquer geometria GeoJSON válida em WGS84, correlacionar com dados
brutos NASA GPM IMERG (V07B Early Run), calcular frações físicas de cobertura,
aplicar ponderação geodésica cos(lat) * frac * mask, tratar ausência de dados
segundo os metadados HDF5 e exportar datasets estritamente compatíveis com o contrato
TemporalObservation e o motor de sonificação.
"""

import os
import glob
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
from shapely.geometry.base import BaseGeometry

from extraction.gpm_extractor import GPMExtractor
from extraction.nasa_data_ingestion import (
    IMERGTimeResolver,
    HDF5IntegrityChecker,
    NASAGranuleDownloader
)
from indicators.precipitation_indicators import (
    calculate_temporal_difference
)
from validation.data_validator import DataValidator
from geometry.geospatial_engine import (
    load_geojson,
    validate_geometry,
    repair_geometry_if_safe,
    densify_geometry,
    calculate_bounding_box,
    extract_grid_cells_for_geometry,
    calculate_spatial_indicators_with_geometry
)


class UniversalProcessingPipeline:
    """
    Pipeline universal e geograficamente desacoplado de processamento de precipitação.
    """

    IMERG_LATITUDE_BOUNDS = (-60.0, 60.0)
    DEFAULT_RESOLUTION = 0.1

    def __init__(
        self,
        raw_data_dir: Optional[Union[str, Path]] = None,
        output_base_dir: Optional[Union[str, Path]] = None,
        username: Optional[str] = None,
        password: Optional[str] = None
    ):
        base_dir = Path(__file__).resolve().parent.parent
        self.raw_data_dir = Path(raw_data_dir) if raw_data_dir else base_dir / "data" / "raw"
        self.output_base_dir = Path(output_base_dir) if output_base_dir else base_dir.parent / "frontend" / "public" / "data"
        self.extractor = GPMExtractor()
        self.downloader = NASAGranuleDownloader(
            raw_data_dir=self.raw_data_dir,
            username=username,
            password=password
        )

    def validate_geographic_coverage(self, geom: BaseGeometry) -> Dict[str, Any]:
        """
        Valida a compatibilidade geográfica da geometria com o domínio orbital do IMERG [-60°, +60°].
        """
        bbox = calculate_bounding_box(geom)
        min_lat = bbox["min_latitude"]
        max_lat = bbox["max_latitude"]

        completely_outside = (min_lat > self.IMERG_LATITUDE_BOUNDS[1]) or (max_lat < self.IMERG_LATITUDE_BOUNDS[0])
        partially_outside = (min_lat < self.IMERG_LATITUDE_BOUNDS[0]) or (max_lat > self.IMERG_LATITUDE_BOUNDS[1])

        if completely_outside:
            status = "out_of_coverage"
            desc = (
                f"Geometria com latitude [{min_lat:.2f}°, {max_lat:.2f}°] está totalmente fora "
                f"da cobertura latitudinal do NASA GPM IMERG [-60.0°, +60.0°]."
            )
        elif partially_outside:
            status = "partial_coverage"
            desc = (
                f"Geometria com latitude [{min_lat:.2f}°, {max_lat:.2f}°] ultrapassa parcialmente "
                f"a cobertura latitudinal do IMERG [-60.0°, +60.0°]. Apenas a porção coberta terá dados."
            )
        else:
            status = "nominal_coverage"
            desc = "Geometria totalmente contida dentro do domínio orbital do NASA GPM IMERG [-60.0°, +60.0°]."

        return {
            "status": status,
            "is_nominal": status == "nominal_coverage",
            "is_completely_outside": completely_outside,
            "is_partially_outside": partially_outside,
            "description": desc,
            "bounding_box": bbox
        }

    def resolve_cached_granules(
        self,
        date_str: Optional[str] = None,
        time_tags: Optional[List[str]] = None
    ) -> List[Path]:
        """
        Localiza grânulos HDF5 correspondentes no cache local raw_data_dir.
        """
        if not self.raw_data_dir.exists():
            return []

        pattern = "3B-HHR-E.*.V07B.HDF5"
        if date_str:
            clean_date = date_str.replace("-", "")
            pattern = f"3B-HHR-E.MS.MRG.3IMERG.{clean_date}*.V07B.HDF5"

        candidates = sorted(list(self.raw_data_dir.glob(pattern)) + list(self.raw_data_dir.glob(pattern.replace(".HDF5", ".hdf5"))))

        if time_tags:
            filtered = []
            for c in candidates:
                for tag in time_tags:
                    clean_tag = tag.replace(":", "")
                    if f"-S{clean_tag}" in c.name:
                        filtered.append(c)
                        break
            return sorted(list(set(filtered)))

        return candidates

    @staticmethod
    def extract_granule_timestamp(filepath: Union[str, Path]) -> str:
        """
        Extrai o timestamp UTC padrão ISO 8601 a partir do nome oficial do grânulo IMERG.
        Ex: 3B-HHR-E.MS.MRG.3IMERG.20240101-S170000-E172959.1020.V07B.HDF5
        Retorna: '2024-01-01T17:00:00Z'
        """
        name = Path(filepath).name
        try:
            date_part = name.split("3IMERG.")[1].split("-S")[0]
            time_part = name.split("-S")[1].split("-E")[0]
            return f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}T{time_part[:2]}:{time_part[2:4]}:{time_part[4:6]}Z"
        except Exception:
            return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    @staticmethod
    def generate_qualitative_summary(
        step_index: int,
        total_steps: int,
        timestamp_utc: str,
        region_name: str,
        mean_rate: Optional[float],
        rain_fraction: Optional[float],
        avail_status: str
    ) -> str:
        """
        Gera um resumo textual acessível, neutro e sem acoplamento a nomes regionais específicos.
        """
        step_label = f"Observação {step_index + 1} de {total_steps}"
        time_label = timestamp_utc.replace("Z", " UTC")

        if avail_status == "missing" or mean_rate is None:
            return f"{step_label} — {time_label} [{region_name}]: Dados de satélite ausentes ou indisponíveis neste intervalo."

        if mean_rate == 0.0 or (rain_fraction or 0.0) == 0.0:
            return f"{step_label} — {time_label} [{region_name}]: Ausência de precipitação mensurável (calmaria radiométrica)."

        if mean_rate < 0.15:
            intensity = "Chuva leve"
        elif mean_rate < 2.5:
            intensity = "Precipitação de intensidade moderada"
        elif mean_rate < 10.0:
            intensity = "Atividade de precipitação forte"
        else:
            intensity = "Evento de precipitação convectiva severa"

        pct = (rain_fraction or 0.0) * 100.0
        return f"{step_label} — {time_label} [{region_name}]: {intensity} com taxa média espacial de {mean_rate:.2f} mm/h e cobertura de {pct:.1f}% da área."

    def process(
        self,
        geojson_source: Union[str, Path, Dict[str, Any]],
        region_id: str,
        start_time: Optional[Union[str, datetime]] = None,
        end_time: Optional[Union[str, datetime]] = None,
        granules: Optional[List[Union[str, Path]]] = None,
        date_str: Optional[str] = None,
        time_tags: Optional[List[str]] = None,
        auto_download: bool = True,
        region_name: Optional[str] = None,
        country: Optional[str] = None,
        product_name: str = "GPM_3IMERGHHE",
        product_version: str = "07B",
        spatial_resolution: float = 0.1,
        temporal_resolution: str = "30_minutes",
        threshold_rate_mm_h: float = 0.1,
        validation_status: str = "preliminary_verified",
        is_sample: bool = False,
        note: Optional[str] = None,
        output_filepath: Optional[Union[str, Path]] = None,
        allow_repair: bool = True
    ) -> Dict[str, Any]:
        """
        Executa o fluxo completo do pipeline para a geometria e grânulos especificados.
        """
        # 1. Leitura e validação da geometria
        raw_geom, geo_props = load_geojson(geojson_source)

        is_valid, validation_errors = validate_geometry(raw_geom)
        repaired_note = None

        if not is_valid:
            if allow_repair:
                geom, was_repaired, repair_reason = repair_geometry_if_safe(raw_geom)
                if not was_repaired:
                    raise ValueError(
                        f"Geometria inválida e não passível de correção segura: {validation_errors}. Motivo: {repair_reason}"
                    )
                repaired_note = repair_reason
            else:
                raise ValueError(f"Geometria inválida segundo os padrões OGC/WGS84: {validation_errors}")
        else:
            geom = raw_geom

        # Densificação das arestas para captura precisa do arco esférico na projeção autálica
        geom = densify_geometry(geom, max_segment_degrees=spatial_resolution / 2.0)

        # 2. Validação da cobertura espacial do produto
        cov_info = self.validate_geographic_coverage(geom)
        bbox = cov_info["bounding_box"]

        if cov_info["is_completely_outside"]:
            raise ValueError(
                f"Erro de cobertura científica: a região '{region_id}' está totalmente fora do domínio IMERG. {cov_info['description']}"
            )

        # 3. Resolução e aquisição dos grânulos
        acquisition_report: Optional[Dict[str, Any]] = None

        if granules:
            h5_files = [Path(g) for g in granules]
            acq_mode = "explicit_granules"
        elif start_time and end_time:
            acq_mode = "interval_auto"
            acquisition_report = self.downloader.acquire_granules_for_interval(
                start_time=start_time,
                end_time=end_time,
                product=product_name,
                version=product_version,
                auto_download=auto_download
            )
            h5_files = acquisition_report["available_files"]
            if not h5_files:
                missing_names = [m["filename"] for m in acquisition_report["missing_granules"]]
                reasons = [m.get("download_error", "não localizado") for m in acquisition_report["missing_granules"]]
                raise FileNotFoundError(
                    f"Nenhum grânulo HDF5 disponível para o intervalo [{start_time} até {end_time}]. "
                    f"Arquivos necessários: {missing_names}. Motivos: {reasons[:3]}"
                )
        else:
            acq_mode = "cached_date"
            h5_files = self.resolve_cached_granules(date_str, time_tags)

        if not h5_files:
            raise FileNotFoundError(
                f"Nenhum grânulo HDF5 encontrado em cache para a data '{date_str}' no diretório '{self.raw_data_dir}'."
            )

        # Metadados regionais padrão a partir de propriedades do GeoJSON se omitidos
        resolved_name = region_name or geo_props.get("name") or geo_props.get("region_name") or region_id.replace("_", " ").title()
        resolved_country = country or geo_props.get("country") or "Internacional"

        # 4. Processamento iterativo dos grânulos temporais
        observations: List[Dict[str, Any]] = []
        previous_mean: Optional[float] = None
        total_steps = len(h5_files)
        total_cells_tracked = 0

        for idx, h5_path in enumerate(h5_files):
            raw_h5 = GPMExtractor.read_imerg_hdf5(str(h5_path))
            raw_lats = np.round(raw_h5["latitudes"], 6)
            raw_lons = np.round(raw_h5["longitudes"], 6)
            matrix = raw_h5["precipitation_matrix"]
            fill_val = raw_h5["fill_value"]

            timestamp_utc = self.extract_granule_timestamp(h5_path)

            # Extração da fatia da grade IMERG para a geometria
            subset = extract_grid_cells_for_geometry(raw_lats, raw_lons, geom, grid_resolution=spatial_resolution)
            sub_lats = subset["latitudes"]
            sub_lons = subset["longitudes"]
            total_cells_tracked = subset["total_cells"]

            if subset["total_cells"] == 0 or len(sub_lats) == 0 or len(sub_lons) == 0:
                # Região não intersecta nenhuma célula da grade
                avail_status = "missing"
                mean_rate = None
                rain_fraction = None
                max_rate = None
                valid_ratio = 0.0
                valid_count = 0
                missing_count = 0
            else:
                sub_matrix = matrix[np.ix_(subset["lat_indices"], subset["lon_indices"])]

                indicators = calculate_spatial_indicators_with_geometry(
                    sub_matrix,
                    sub_lats,
                    sub_lons,
                    geom,
                    threshold_rate_mm_h=threshold_rate_mm_h,
                    missing_value=fill_val,
                    min_valid_ratio=0.10
                )

                mean_rate = indicators["mean_precipitation_rate"]
                rain_fraction = indicators["rain_area_fraction"]
                max_rate = indicators["max_precipitation_rate"]
                avail_status = indicators["availability_status"]

                mask_info = indicators["mask_info"]
                valid_ratio = mask_info["valid_ratio"]
                valid_count = mask_info["valid_intersected_count"]
                missing_count = mask_info["missing_intersected_count"]

            temporal_diff = calculate_temporal_difference(mean_rate, previous_mean)
            if mean_rate is not None:
                previous_mean = mean_rate

            summary_text = self.generate_qualitative_summary(
                idx, total_steps, timestamp_utc, resolved_name, mean_rate, rain_fraction, avail_status
            )

            obs_record: Dict[str, Any] = {
                "observation_id": f"obs_{region_id}_{idx:03d}",
                "step_index": idx,
                "timestamp_utc": timestamp_utc,
                "availability": {
                    "status": avail_status,
                    "valid_cells_ratio": float(valid_ratio),
                    "missing_cells_count": int(missing_count),
                    "total_cells_count": int(total_cells_tracked)
                },
                "scientific_indicators": {
                    "mean_precipitation_rate": {
                        "value": float(mean_rate) if mean_rate is not None else None,
                        "unit": "mm/h",
                        "metric_type": "rate",
                        "description": "Taxa média espacial de precipitação ponderada pela área física da célula (cosseno da latitude e fração de cobertura)"
                    },
                    "rain_area_fraction": {
                        "value": float(rain_fraction) if rain_fraction is not None else None,
                        "unit": "fraction",
                        "threshold_rate_mm_h": threshold_rate_mm_h,
                        "description": f"Fração da área com taxa de precipitação >= {threshold_rate_mm_h} mm/h (adimensional entre 0 e 1)"
                    },
                    "max_precipitation_rate": {
                        "value": float(max_rate) if max_rate is not None else None,
                        "unit": "mm/h",
                        "description": "Pico máximo pontual de precipitação registrado no recorte"
                    },
                    "temporal_difference": {
                        "value": float(temporal_diff) if temporal_diff is not None else None,
                        "unit": "mm/h",
                        "description": "Variação da taxa média em relação à observação imediatamente anterior"
                    },
                    "temporal_variance": {
                        "value": float(temporal_diff) if temporal_diff is not None else None,
                        "unit": "mm/h",
                        "description": "Alias retrocompatível para variação temporal entre passos"
                    }
                },
                "visual_frame_reference": {
                    "frame_id": f"frame_{region_id}_{idx:03d}",
                    "image_path": "",
                    "source_system": "NASA Scientific Visualization Studio (SVS) / Earth Information Center",
                    "synchronization_status": "pending_official_validation",
                    "alt_text": summary_text
                },
                "textual_summary": summary_text
            }
            observations.append(obs_record)

        # 5. Consolidação do dataset final conforme contrato da plataforma
        dataset: Dict[str, Any] = {
            "dataset_version": "1.0.0",
            "region_id": region_id,
            "region_name": resolved_name,
            "country": resolved_country,
            "data_source": "NASA Earthdata GES DISC",
            "product_name": product_name,
            "product_version": product_version,
            "phenomenon": "precipitation",
            "temporal_resolution": temporal_resolution,
            "is_sample": bool(is_sample),
            "validation_status": validation_status,
            "metadata_url": "https://gpm.nasa.gov/data/imerg",
            "bounding_box": bbox,
            "spatial_resolution_degrees": float(spatial_resolution),
            "processing_provenance": {
                "engine": "SONATLAS Universal Geospatial Pipeline",
                "engine_version": "1.0.0",
                "processing_timestamp_utc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "total_observations": len(observations),
                "geographic_coverage_status": cov_info["status"],
                "geometry_type": geom.geom_type,
                "intersected_grid_cells": total_cells_tracked,
                "repaired_geometry": repaired_note is not None,
                "repair_details": repaired_note,
                "acquisition_mode": acq_mode,
                "acquisition_report": {
                    "total_requested": acquisition_report["total_requested"],
                    "total_cached": acquisition_report["total_cached"],
                    "total_downloaded": acquisition_report["total_downloaded"],
                    "total_missing": acquisition_report["total_missing"]
                } if acquisition_report else None
            },
            "note": note or f"Dataset científico processado pelo Pipeline Universal SONATLAS para a região '{resolved_name}'.",
            "observations": observations
        }

        # 6. Validação científica rigorosa das regras de contrato
        is_valid_dataset, val_errors = DataValidator.validate_dataset(dataset)
        if not is_valid_dataset:
            raise ValueError(f"Dataset gerado falhou na validação de conformidade científica: {val_errors}")

        # 7. Gravação em disco, se solicitado
        if output_filepath:
            out_p = Path(output_filepath)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            with open(out_p, "w", encoding="utf-8") as f:
                json.dump(dataset, f, indent=2, ensure_ascii=False)

        return dataset
