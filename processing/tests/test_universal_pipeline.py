"""
Suíte de testes científicos e de generalização para o Pipeline Universal do SONATLAS.

Valida:
1. Regressão exata da Amazônia Central com dados reais HDF5.
2. Regressão exata de Kisangani (Bacia do Congo) com dados reais HDF5.
3. Polígono irregular com fronteiras fracionárias.
4. MultiPolígono (ilhas disjuntas).
5. Polígono com buraco (anel/donut).
6. Rejeição explícita de região fora da cobertura latitudinal IMERG (lat > 60°).
7. Detecção de cobertura espacial parcial (cruzando 60°).
8. Tratamento de período sem grânulos (FileNotFoundError explícito).
9. Reutilização de arquivos HDF5 em cache local.
10. Tratamento de dados ausentes (sem converter para zero).
11. Conformidade estrita com o contrato TemporalObservation e DataValidator.
"""

import os
import glob
from pathlib import Path
import pytest
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, box

from pipeline.universal_pipeline import UniversalProcessingPipeline
from validation.data_validator import DataValidator
from geometry.geospatial_engine import load_geojson
from extraction.gpm_extractor import GPMExtractor
from indicators.precipitation_indicators import (
    calculate_mean_precipitation_rate,
    calculate_rain_area_fraction
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DATA_DIR = REPO_ROOT / "processing" / "data" / "raw"
AMAZON_GEOJSON = REPO_ROOT / "processing" / "geometry" / "amazon" / "central_amazon_bbox.geojson"
CONGO_GEOJSON = REPO_ROOT / "processing" / "geometry" / "international" / "congo_basin_kisangani_bbox.geojson"


def get_afternoon_granules():
    files = sorted(list(RAW_DATA_DIR.glob("3B-HHR-E.*-S1[7-9]*.V07B.HDF5")))
    return files


@pytest.fixture
def pipeline():
    return UniversalProcessingPipeline(raw_data_dir=RAW_DATA_DIR)


def test_universal_pipeline_amazon_regression(pipeline):
    """Valida que o pipeline universal reproduz exatamente os dados oficiais da Amazônia Central."""
    granules = get_afternoon_granules()
    if len(granules) != 6:
        pytest.skip(f"Esperado 6 grânulos vespertinos, encontrados {len(granules)}.")

    dataset = pipeline.process(
        geojson_source=AMAZON_GEOJSON,
        region_id="amazon_central",
        granules=granules,
        region_name="Amazônia Central (Série Vespertina)",
        country="Brasil"
    )

    # 1. Conformidade com DataValidator
    is_valid, errors = DataValidator.validate_dataset(dataset)
    assert is_valid is True, f"Erros de validação: {errors}"

    # 2. Estrutura do dataset
    assert dataset["region_id"] == "amazon_central"
    assert dataset["product_name"] == "GPM_3IMERGHHE"
    assert len(dataset["observations"]) == 6

    # 3. Comparação com o cálculo oficial direto
    raw_geom, _ = load_geojson(AMAZON_GEOJSON)
    extractor = GPMExtractor()

    for idx, (h5_path, obs) in enumerate(zip(granules, dataset["observations"])):
        raw_h5 = GPMExtractor.read_imerg_hdf5(str(h5_path))
        lats = np.round(raw_h5["latitudes"], 6)
        lons = np.round(raw_h5["longitudes"], 6)

        min_lon, min_lat, max_lon, max_lat = raw_geom.bounds
        clipped = extractor.clip_bounding_box(lats, lons, raw_h5["precipitation_matrix"], {
            "min_latitude": min_lat, "max_latitude": max_lat,
            "min_longitude": min_lon, "max_longitude": max_lon
        })
        m_ofic, _, vc_ofic, tot_ofic = calculate_mean_precipitation_rate(
            clipped["precipitation_matrix"], clipped["latitudes"], missing_value=-9999.0
        )
        rain_ofic = calculate_rain_area_fraction(
            clipped["precipitation_matrix"], clipped["latitudes"], threshold_rate_mm_h=0.1, missing_value=-9999.0
        )
        val_vals = clipped["precipitation_matrix"][
            (clipped["precipitation_matrix"] != -9999.0) & (clipped["precipitation_matrix"] >= 0.0)
        ]
        max_ofic = float(np.max(val_vals)) if val_vals.size > 0 else 0.0

        m_pipe = obs["scientific_indicators"]["mean_precipitation_rate"]["value"]
        rain_pipe = obs["scientific_indicators"]["rain_area_fraction"]["value"]
        max_pipe = obs["scientific_indicators"]["max_precipitation_rate"]["value"]

        assert obs["availability"]["total_cells_count"] == 750
        assert obs["availability"]["missing_cells_count"] == 0
        assert obs["availability"]["status"] == "available"

        assert np.isclose(m_pipe, m_ofic, rtol=1e-5)
        assert np.isclose(rain_pipe, rain_ofic, rtol=1e-5)
        assert np.isclose(max_pipe, max_ofic, rtol=1e-5)


def test_universal_pipeline_kisangani_regression(pipeline):
    """Valida que o pipeline universal reproduz exatamente os dados oficiais de Kisangani."""
    granules = get_afternoon_granules()
    if len(granules) != 6:
        pytest.skip(f"Esperado 6 grânulos vespertinos, encontrados {len(granules)}.")

    dataset = pipeline.process(
        geojson_source=CONGO_GEOJSON,
        region_id="congo_basin_kisangani",
        granules=granules,
        region_name="Bacia do Congo (Janela de Kisangani)",
        country="República Democrática do Congo"
    )

    is_valid, errors = DataValidator.validate_dataset(dataset)
    assert is_valid is True, f"Erros de validação: {errors}"
    assert len(dataset["observations"]) == 6

    raw_geom, _ = load_geojson(CONGO_GEOJSON)
    extractor = GPMExtractor()

    for idx, (h5_path, obs) in enumerate(zip(granules, dataset["observations"])):
        raw_h5 = GPMExtractor.read_imerg_hdf5(str(h5_path))
        lats = np.round(raw_h5["latitudes"], 6)
        lons = np.round(raw_h5["longitudes"], 6)

        min_lon, min_lat, max_lon, max_lat = raw_geom.bounds
        clipped = extractor.clip_bounding_box(lats, lons, raw_h5["precipitation_matrix"], {
            "min_latitude": min_lat, "max_latitude": max_lat,
            "min_longitude": min_lon, "max_longitude": max_lon
        })
        m_ofic, _, _, _ = calculate_mean_precipitation_rate(
            clipped["precipitation_matrix"], clipped["latitudes"], missing_value=-9999.0
        )
        rain_ofic = calculate_rain_area_fraction(
            clipped["precipitation_matrix"], clipped["latitudes"], threshold_rate_mm_h=0.1, missing_value=-9999.0
        )
        val_vals = clipped["precipitation_matrix"][
            (clipped["precipitation_matrix"] != -9999.0) & (clipped["precipitation_matrix"] >= 0.0)
        ]
        max_ofic = float(np.max(val_vals)) if val_vals.size > 0 else 0.0

        m_pipe = obs["scientific_indicators"]["mean_precipitation_rate"]["value"]
        rain_pipe = obs["scientific_indicators"]["rain_area_fraction"]["value"]
        max_pipe = obs["scientific_indicators"]["max_precipitation_rate"]["value"]

        assert obs["availability"]["total_cells_count"] == 750
        assert np.isclose(m_pipe, m_ofic, rtol=1e-5)
        assert np.isclose(rain_pipe, rain_ofic, rtol=1e-5)
        assert np.isclose(max_pipe, max_ofic, rtol=1e-5)


def test_universal_pipeline_irregular_polygon(pipeline):
    """Processa um polígono irregular novo que corta células com frações arbitrárias."""
    granules = get_afternoon_granules()
    if not granules:
        pytest.skip("Nenhum grânulo HDF5 encontrado.")

    # Polígono irregular na região do Pantanal (lat -19.5 a -18.0, lon -57.5 a -55.5)
    poly = Polygon([
        (-57.5, -19.5),
        (-56.0, -19.5),
        (-55.5, -18.5),
        (-56.8, -18.0),
        (-57.5, -19.5)
    ])

    geojson_dict = {
        "type": "Feature",
        "properties": {"name": "Pantanal Mato-Grossense", "country": "Brasil"},
        "geometry": poly.__geo_interface__
    }

    dataset = pipeline.process(
        geojson_source=geojson_dict,
        region_id="pantanal_matogrossense",
        granules=[granules[0]],
        threshold_rate_mm_h=0.1
    )

    is_valid, errors = DataValidator.validate_dataset(dataset)
    assert is_valid is True, f"Erros: {errors}"
    assert dataset["region_id"] == "pantanal_matogrossense"
    assert len(dataset["observations"]) == 1

    obs = dataset["observations"][0]
    assert obs["availability"]["status"] in ["available", "partial"]
    assert obs["scientific_indicators"]["mean_precipitation_rate"]["value"] is not None
    assert obs["scientific_indicators"]["rain_area_fraction"]["value"] is not None


def test_universal_pipeline_multipolygon(pipeline):
    """Processa um MultiPolygon (arquipélago ou áreas disjuntas)."""
    granules = get_afternoon_granules()
    if not granules:
        pytest.skip("Nenhum grânulo HDF5 encontrado.")

    island1 = box(-60.0, -3.0, -59.5, -2.5)
    island2 = box(-59.0, -3.0, -58.5, -2.5)
    multi = MultiPolygon([island1, island2])

    geojson_dict = {
        "type": "Feature",
        "properties": {"name": "Áreas Disjuntas Piloto", "country": "Brasil"},
        "geometry": multi.__geo_interface__
    }

    dataset = pipeline.process(
        geojson_source=geojson_dict,
        region_id="multi_island_region",
        granules=[granules[0]]
    )

    is_valid, errors = DataValidator.validate_dataset(dataset)
    assert is_valid is True, f"Erros: {errors}"
    assert dataset["processing_provenance"]["geometry_type"] == "MultiPolygon"
    assert len(dataset["observations"]) == 1


def test_universal_pipeline_polygon_with_hole(pipeline):
    """Processa um polígono com buraco interior (donut)."""
    granules = get_afternoon_granules()
    if not granules:
        pytest.skip("Nenhum grânulo HDF5 encontrado.")

    ext = [(-60.5, -3.5), (-59.0, -3.5), (-59.0, -2.0), (-60.5, -2.0), (-60.5, -3.5)]
    hole = [(-60.0, -3.0), (-59.5, -3.0), (-59.5, -2.5), (-60.0, -2.5), (-60.0, -3.0)]
    donut = Polygon(ext, [hole])

    dataset = pipeline.process(
        geojson_source=donut.__geo_interface__,
        region_id="donut_test_region",
        granules=[granules[0]]
    )

    is_valid, errors = DataValidator.validate_dataset(dataset)
    assert is_valid is True, f"Erros: {errors}"
    assert len(dataset["observations"]) == 1


def test_universal_pipeline_region_out_of_coverage_rejection(pipeline):
    """Rejeita explicitamente geometria fora da cobertura latitudinal IMERG (lat > 60°)."""
    # Groenlândia / Ártico
    poly_arctic = box(-40.0, 72.0, -35.0, 75.0)

    with pytest.raises(ValueError, match="Erro de cobertura científica"):
        pipeline.process(
            geojson_source=poly_arctic.__geo_interface__,
            region_id="greenland_arctic",
            granules=["fake.HDF5"]
        )


def test_universal_pipeline_partial_coverage_warning(pipeline):
    """Detecta cobertura parcial quando o polígono cruza a borda de 60°."""
    granules = get_afternoon_granules()
    if not granules:
        pytest.skip("Nenhum grânulo HDF5 encontrado.")

    # Polígono no norte da Europa cruzando lat 60° (58° a 62°)
    poly_subpolar = box(15.0, 58.0, 18.0, 62.0)

    dataset = pipeline.process(
        geojson_source=poly_subpolar.__geo_interface__,
        region_id="scandinavia_partial",
        granules=[granules[0]]
    )

    assert dataset["processing_provenance"]["geographic_coverage_status"] == "partial_coverage"


def test_universal_pipeline_no_granules_found_raises(pipeline):
    """Dispara FileNotFoundError explícito quando não há arquivos no cache para a data."""
    poly = box(-60.0, -3.0, -59.0, -2.0)

    with pytest.raises(FileNotFoundError, match="Nenhum grânulo HDF5 encontrado"):
        pipeline.process(
            geojson_source=poly.__geo_interface__,
            region_id="date_not_in_cache",
            date_str="1999-12-31"
        )


def test_universal_pipeline_cache_reutilization(pipeline):
    """Comprova a reutilização dos grânulos em cache sem efetuar downloads."""
    cached = pipeline.resolve_cached_granules(date_str="2024-01-01")
    if len(cached) < 6:
        pytest.skip(f"Esperado pelo menos 6 grânulos em cache local, encontrados {len(cached)}.")
    assert len(cached) >= 6
    for f in cached:
        assert f.exists()
        assert f.stat().st_size > 7_000_000  # Tamanho de arquivo real


def test_universal_pipeline_invalid_geometry_safe_repair(pipeline):
    """Repara com segurança auto-interseção (bow-tie) ao processar."""
    granules = get_afternoon_granules()
    if not granules:
        pytest.skip("Nenhum grânulo HDF5 encontrado.")

    # Bow-tie na Amazônia
    bowtie = Polygon([(-60.0, -3.0), (-59.0, -2.0), (-59.0, -3.0), (-60.0, -2.0), (-60.0, -3.0)])

    dataset = pipeline.process(
        geojson_source=bowtie.__geo_interface__,
        region_id="repaired_bowtie_region",
        granules=[granules[0]],
        allow_repair=True
    )

    assert dataset["processing_provenance"]["repaired_geometry"] is True
    assert "make_valid" in dataset["processing_provenance"]["repair_details"]
    assert len(dataset["observations"]) == 1


def test_universal_pipeline_zero_precipitation(pipeline):
    """Processa uma região real sem chuva (deserto do Saara), confirmando zero instrumental válido."""
    granules = get_afternoon_granules()
    if not granules:
        pytest.skip("Nenhum grânulo HDF5 encontrado.")

    # Região hiperárida no deserto do Saara (lat 22.0 a 23.0, lon 15.0 a 16.0)
    sahara_box = box(15.0, 22.0, 16.0, 23.0)

    dataset = pipeline.process(
        geojson_source=sahara_box.__geo_interface__,
        region_id="sahara_desert_zero",
        granules=[granules[0]]
    )

    is_valid, errors = DataValidator.validate_dataset(dataset)
    assert is_valid is True, f"Erros: {errors}"

    obs = dataset["observations"][0]
    # Células válidas sem chuva: taxa média = 0.0, fração de chuva = 0.0, status disponível
    assert obs["availability"]["status"] == "available"
    assert obs["scientific_indicators"]["mean_precipitation_rate"]["value"] == 0.0
    assert obs["scientific_indicators"]["rain_area_fraction"]["value"] == 0.0
    assert "Ausência de precipitação mensurável" in obs["textual_summary"]


def test_universal_pipeline_no_grid_intersection(pipeline, monkeypatch):
    """Processa uma geometria microscópica que não intersecta células da grade."""
    granules = get_afternoon_granules()
    if not granules:
        pytest.skip("Nenhum grânulo HDF5 encontrado.")

    # Simular subset vazio (região fora da grade ou sem células)
    poly = box(0.01, 0.01, 0.02, 0.02)

    from pipeline import universal_pipeline
    original_extract = universal_pipeline.extract_grid_cells_for_geometry

    def mock_empty_extract(*args, **kwargs):
        return {
            "latitudes": np.array([]),
            "longitudes": np.array([]),
            "lat_indices": np.array([]),
            "lon_indices": np.array([]),
            "bounding_box": {"min_latitude": 0, "max_latitude": 0, "min_longitude": 0, "max_longitude": 0},
            "total_cells": 0
        }

    monkeypatch.setattr(universal_pipeline, "extract_grid_cells_for_geometry", mock_empty_extract)

    dataset = pipeline.process(
        geojson_source=poly.__geo_interface__,
        region_id="empty_grid_region",
        granules=[granules[0]]
    )

    obs = dataset["observations"][0]
    assert obs["availability"]["status"] == "missing"
    assert obs["scientific_indicators"]["mean_precipitation_rate"]["value"] is None
    assert obs["scientific_indicators"]["rain_area_fraction"]["value"] is None
