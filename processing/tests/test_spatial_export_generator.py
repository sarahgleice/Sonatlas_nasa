import numpy as np
import pytest
import h5py

from scripts.generate_spatial_export import (
    AGGREGATE_TOLERANCE,
    _axis_order,
    _load_region_bounds,
    build_spatial_export,
    normalize_granule,
)
from extraction.gpm_extractor import GPMExtractor


BOX = {
    "min_latitude": 0.0,
    "max_latitude": 0.2,
    "min_longitude": 10.0,
    "max_longitude": 10.2,
}


def observation(timestamp, values, missing=0, total=4):
    lats = np.array([0.05, 0.15])
    weights = np.cos(np.deg2rad(lats))[:, None] * np.ones((2, 2))
    matrix = np.array(values, dtype=float)
    valid = np.isfinite(matrix) & (matrix >= 0)
    rate = float((matrix[valid] * weights[valid]).sum() / weights[valid].sum())
    rain = float((weights * valid * (matrix >= 0.1)).sum() / weights[valid].sum())
    return {
        "timestamp_utc": timestamp,
        "availability": {
            "missing_cells_count": missing,
            "total_cells_count": total,
            "valid_cells_ratio": (total - missing) / total,
            "status": "available" if (total - missing) / total >= 0.8 else "partial" if (total - missing) / total >= 0.1 else "missing",
        },
        "scientific_indicators": {
            "mean_precipitation_rate": {"value": rate},
            "rain_area_fraction": {"value": rain, "threshold_rate_mm_h": 0.1},
        },
    }

def dataset(region, records, *, box=BOX):
    return {
        "region_id": region,
        "phenomenon": "precipitation",
        "is_sample": False,
        "bounding_box": box,
        "data_source": "NASA Earthdata GES DISC",
        "product_name": "GPM_3IMERGHHE",
        "product_version": "07B",
        "observations": records,
    }


def raw(values, *, lats=(0.05, 0.15), lons=(10.05, 10.15), units="mm/hr", fill=-9999.9):
    return {
        "variable_name": "/Grid/precipitation",
        "latitudes": np.array(lats),
        "longitudes": np.array(lons),
        "precipitation_matrix": np.array(values, dtype=float),
        "units": units,
        "units_attribute_present": True,
        "fill_value": fill,
        "fill_value_attribute_present": True,
    }


def test_reverses_descending_axes_and_preserves_zero_and_float_precision():
    lats, lons, values = normalize_granule(
        raw([[0.123456789, 0.0], [0.4, 0.2]], lats=(0.15, 0.05), lons=(10.15, 10.05)),
        BOX,
        expected_cell_count=4,
    )
    assert lats == [0.05, 0.15]
    assert lons == [10.05, 10.15]
    assert values == [[0.2, 0.4], [0.0, 0.123456789]]


def test_normalizes_float32_imerg_axes_to_nominal_centers():
    latitudes, _ = _axis_order(np.array([89.95, 89.85, 89.75], dtype=np.float32), "latitude")
    longitudes, _ = _axis_order(np.array([179.75, 179.85, 179.95], dtype=np.float32), "longitude")
    assert latitudes.tolist() == [89.75, 89.85, 89.95]
    assert longitudes.tolist() == [179.75, 179.85, 179.95]
    with pytest.raises(ValueError, match="alinhado aos centros"):
        _axis_order(np.array([89.751, 89.851, 89.951], dtype=np.float32), "latitude")


def test_invalid_fill_negative_and_nonfinite_are_null_but_zero_is_valid():
    _, _, values = normalize_granule(
        raw([[0.0, -9999.9], [-0.1, float("nan")]]), BOX, expected_cell_count=4
    )
    assert values == [[0.0, None], [None, None]]


def test_hdf_reader_reports_required_metadata_attributes(tmp_path):
    filepath = tmp_path / "synthetic-unit-test-only.h5"
    with h5py.File(filepath, "w") as hdf:
        grid = hdf.create_group("Grid")
        grid.create_dataset("lat", data=[0.05, 0.15])
        grid.create_dataset("lon", data=[10.05, 10.15, 10.25])
        precipitation = grid.create_dataset("precipitation", data=[[[0.0, 0.1, 9.0], [0.2, -9999.9, 9.0]]])
        precipitation.attrs["units"] = "mm/hr"
        precipitation.attrs["_FillValue"] = -9999.9

    raw_hdf = GPMExtractor.read_imerg_hdf5(str(filepath))
    assert raw_hdf["variable_name"] == "/Grid/precipitation"
    assert raw_hdf["units_attribute_present"] is True
    assert raw_hdf["fill_value_attribute_present"] is True
    _, _, values = normalize_granule(raw_hdf, BOX, expected_cell_count=4)
    assert values == [[0.0, 0.1], [0.2, None]]


def test_rejects_units_dimensions_and_non_monotonic_axes():
    with pytest.raises(ValueError, match="Unidade"):
        normalize_granule(raw([[0, 0], [0, 0]], units="mm"), BOX, expected_cell_count=4)
    with pytest.raises(ValueError, match="Dimensões"):
        normalize_granule(raw([[0, 0]], ), BOX, expected_cell_count=4)
    with pytest.raises(ValueError, match="monotônico"):
        normalize_granule(raw([[0, 0], [0, 0]], lats=(0.05, 0.05)), BOX, expected_cell_count=4)
    with pytest.raises(ValueError, match="esperado 750"):
        normalize_granule(raw([[0, 0], [0, 0]]), BOX)

    no_units = raw([[0, 0], [0, 0]])
    no_units["units_attribute_present"] = False
    with pytest.raises(ValueError, match="units attribute is absent"):
        normalize_granule(no_units, BOX, expected_cell_count=4)

    no_fill_value = raw([[0, 0], [0, 0]])
    no_fill_value["fill_value_attribute_present"] = False
    with pytest.raises(ValueError, match="_FillValue attribute is absent"):
        normalize_granule(no_fill_value, BOX, expected_cell_count=4)

    shifted_centers = raw([[0, 0], [0, 0]], lats=(0.04, 0.14))
    with pytest.raises(ValueError, match="Cell-center latitude axis"):
        normalize_granule(shifted_centers, BOX, expected_cell_count=4)


def test_rejects_unidentified_scientific_variable():
    timestamp = "2024-01-01T17:00:00Z"
    obs = observation(timestamp, [[0.0, 0.2], [0.4, 0.8]])
    source = raw([[0.0, 0.2], [0.4, 0.8]])
    source["variable_name"] = "/Grid/other"
    with pytest.raises(ValueError, match="Variável HDF5 incompatível"):
        build_spatial_export(
            "amazon_central", [("source", dataset("amazon_central", [obs]))],
            {timestamp: "hdf"}, lambda _: source, expected_cell_count=4, expected_bounds=BOX,
        )


def test_merges_distinct_amazon_times_without_filling_the_real_gap():
    values = [[0.0, 0.105], [0.123456789, 0.4]]
    times = ["2024-01-01T00:00:00Z", "2024-01-01T02:30:00Z", "2024-01-01T17:00:00Z", "2024-01-01T17:30:00Z"]
    sources = [
        ("observations.json", dataset("amazon_central", [observation(t, values) for t in times[:2]])),
        ("observations_afternoon.json", dataset("amazon_central", [observation(t, values) for t in times[2:]])),
        ("observations_day_windows.json", dataset("amazon_central", [observation(t, values) for t in times])),
    ]
    granules = {timestamp: timestamp for timestamp in times}
    manifest, matrices = build_spatial_export(
        "amazon_central", sources, granules, lambda _: raw(values), expected_cell_count=4, expected_bounds=BOX
    )
    assert [item["timestamp_utc"] for item in manifest["timestamps"]] == times
    assert matrices[0]["values"][1][0] == 0.123456789
    assert manifest["timestamps"][0]["matrix_path"].startswith("matrices/2024-01-01T00-00-00Z-")
    assert manifest["processing_provenance"]["source_granules"][0]["variable_name"] == "/Grid/precipitation"
    assert "2024-01-01T03:00:00Z" not in [e["timestamp_utc"] for e in manifest["timestamps"]]


def test_compares_published_aggregates_with_explicit_rounding_tolerance():
    values = [[0.0, 0.105], [0.123456789, 0.4]]
    source_obs = observation("2024-01-01T17:00:00Z", values)
    source_obs["scientific_indicators"]["mean_precipitation_rate"]["value"] = round(
        source_obs["scientific_indicators"]["mean_precipitation_rate"]["value"], 2
    )
    source_obs["scientific_indicators"]["rain_area_fraction"]["value"] = round(
        source_obs["scientific_indicators"]["rain_area_fraction"]["value"], 2
    )
    _, matrices = build_spatial_export(
        "amazon_central",
        [("source", dataset("amazon_central", [source_obs]))],
        {source_obs["timestamp_utc"]: "hdf"},
        lambda _: raw(values),
        expected_cell_count=4, expected_bounds=BOX,
    )
    assert matrices[0]["values"] == values
    assert AGGREGATE_TOLERANCE == 0.0051


def test_aggregate_mismatch_reports_region_timestamp_and_recalculated_value():
    timestamp = "2024-01-01T17:00:00Z"
    obs = observation(timestamp, [[0.0, 0.2], [0.4, 0.8]])
    obs["scientific_indicators"]["mean_precipitation_rate"]["value"] = 99
    with pytest.raises(ValueError, match=r"amazon_central 2024-01-01T17:00:00Z.*recalculado=.*publicado=99"):
        build_spatial_export(
            "amazon_central", [("source", dataset("amazon_central", [obs]))],
            {timestamp: "hdf"}, lambda _: raw([[0.0, 0.2], [0.4, 0.8]]), expected_cell_count=4, expected_bounds=BOX,
        )


def test_missing_timestamp_fails_before_matrix_creation():
    timestamp = "2024-01-01T17:00:00Z"
    obs = observation(timestamp, [[0.0, 0.2], [0.4, 0.8]])
    with pytest.raises(ValueError, match="ausentes=.*2024-01-01T17:00:00Z"):
        build_spatial_export(
            "amazon_central", [("source", dataset("amazon_central", [obs]))], {},
            lambda _: pytest.fail("não deveria ler matriz"), expected_cell_count=4, expected_bounds=BOX,
        )


def test_rejects_duplicate_source_timestamp_and_count_mismatch():
    timestamp = "2024-01-01T17:00:00Z"
    obs = observation(timestamp, [[0.0, 0.2], [0.4, 0.8]])
    with pytest.raises(ValueError, match="Timestamp duplicado"):
        build_spatial_export(
            "amazon_central", [("source", dataset("amazon_central", [obs, obs]))],
            {timestamp: "hdf"}, lambda _: raw([[0.0, 0.2], [0.4, 0.8]]), expected_cell_count=4, expected_bounds=BOX,
        )
    obs["availability"]["total_cells_count"] = 750
    with pytest.raises(ValueError, match=r"amazon_central 2024-01-01T17:00:00Z:.*contagens divergentes"):
        build_spatial_export(
            "amazon_central", [("source", dataset("amazon_central", [obs]))],
            {timestamp: "hdf"}, lambda _: raw([[0.0, 0.2], [0.4, 0.8]]), expected_cell_count=4, expected_bounds=BOX,
        )


def test_congo_is_a_distinct_candidate_under_review_region():
    timestamp = "2024-01-01T17:00:00Z"
    values = [[0.0, 0.2], [0.4, 0.8]]
    # The controlled axes are intentionally local and small; only region metadata/status is under test.
    obs = observation(timestamp, values)
    manifest, _ = build_spatial_export(
        "congo_basin_kisangani", [("congo/observations.json", dataset("congo_basin_kisangani", [obs], box=BOX))],
        {timestamp: "hdf"}, lambda _: raw(values), expected_cell_count=4, expected_bounds=BOX,
    )
    assert manifest["region_id"] == "congo_basin_kisangani"
    assert manifest["validation_status"] == "candidate_under_review"


def test_uses_the_region_geojson_bounds_instead_of_shared_or_hardcoded_bounds():
    assert _load_region_bounds("amazon_central") == {
        "min_latitude": -4.0, "max_latitude": -1.5,
        "min_longitude": -61.5, "max_longitude": -58.5,
    }
    assert _load_region_bounds("congo_basin_kisangani") == {
        "min_latitude": -0.8, "max_latitude": 1.7,
        "min_longitude": 23.7, "max_longitude": 26.7,
    }
