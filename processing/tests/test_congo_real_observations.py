"""
Suíte de testes automatizados para as observações reais da Bacia do Congo (janela de Kisangani).
Valida integridade numérica, metadados científicos NASA IMERG Early V07B,
consistência entre observations.json e processed series, e conformidade com o contrato TemporalObservation.
"""

import os
import json
import pytest
import numpy as np

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

JSON_PATHS = [
    os.path.join(REPO_ROOT, "frontend", "public", "data", "congo", "observations.json"),
    os.path.join(REPO_ROOT, "processing", "data", "processed", "congo_kisangani_real_series.json")
]


@pytest.fixture
def congo_dataset():
    assert os.path.exists(JSON_PATHS[0]), f"Arquivo principal do Congo não encontrado: {JSON_PATHS[0]}"
    with open(JSON_PATHS[0], "r", encoding="utf-8") as f:
        return json.load(f)


def test_congo_json_files_consistency():
    """Confere se os arquivos JSON do Congo contêm rigorosamente os mesmos dados."""
    datasets = []
    for path in JSON_PATHS:
        assert os.path.exists(path), f"Arquivo não encontrado: {path}"
        with open(path, "r", encoding="utf-8") as f:
            datasets.append(json.load(f))

    assert datasets[0] == datasets[1], "Divergência entre public/data/congo/observations.json e processed/congo_kisangani_real_series.json"


def test_congo_root_structure(congo_dataset):
    """Valida metadados essenciais na raiz do dataset de Kisangani / Congo."""
    assert congo_dataset["region_id"] == "congo_basin_kisangani"
    assert congo_dataset["product_name"] == "GPM_3IMERGHHE"
    assert congo_dataset["product_version"] == "07B"
    assert congo_dataset["temporal_resolution"] == "30_minutes"
    assert congo_dataset["is_sample"] is False
    assert congo_dataset["validation_status"] == "preliminary_verified"
    assert congo_dataset["bounding_box"]["min_longitude"] == 23.7
    assert congo_dataset["bounding_box"]["max_longitude"] == 26.7
    assert congo_dataset["bounding_box"]["min_latitude"] == -0.8
    assert congo_dataset["bounding_box"]["max_latitude"] == 1.7
    assert "observations" in congo_dataset
    assert len(congo_dataset["observations"]) == 6


def test_congo_timestamps_match_afternoon_window(congo_dataset):
    """Valida se os seis passos temporais correspondem rigorosamente ao período vespertino de 01/01/2024."""
    expected_timestamps = [
        "2024-01-01T17:00:00Z",
        "2024-01-01T17:30:00Z",
        "2024-01-01T18:00:00Z",
        "2024-01-01T18:30:00Z",
        "2024-01-01T19:00:00Z",
        "2024-01-01T19:30:00Z",
    ]
    actual_timestamps = [obs["timestamp_utc"] for obs in congo_dataset["observations"]]
    assert actual_timestamps == expected_timestamps


def test_congo_indicators_precision_and_physics(congo_dataset):
    """Valida física e precisão dos indicadores científicos do Congo."""
    for idx, obs in enumerate(congo_dataset["observations"]):
        assert obs["step_index"] == idx
        indicators = obs["scientific_indicators"]

        # 1. Taxa média
        mean_rate = indicators["mean_precipitation_rate"]["value"]
        assert mean_rate is not None
        assert isinstance(mean_rate, (int, float))
        assert np.isfinite(mean_rate)
        assert mean_rate >= 0.0
        assert indicators["mean_precipitation_rate"]["unit"] == "mm/h"

        # 2. Fração de área
        rain_frac = indicators["rain_area_fraction"]["value"]
        assert rain_frac is not None
        assert isinstance(rain_frac, (int, float))
        assert np.isfinite(rain_frac)
        assert 0.0 <= rain_frac <= 1.0
        assert indicators["rain_area_fraction"]["unit"] == "fraction"

        # 3. Diferença temporal
        assert "temporal_difference" in indicators
        diff = indicators["temporal_difference"]["value"]
        if idx == 0:
            assert diff is None
        else:
            assert diff is not None
            assert np.isfinite(diff)
            assert indicators["temporal_difference"]["unit"] == "mm/h"

        # 4. Pico máximo pontual
        max_rate = indicators["max_precipitation_rate"]["value"]
        assert max_rate is not None
        assert max_rate >= mean_rate

        # 5. Ausência de valores sentinela
        assert mean_rate != -9999.9 and mean_rate != -9999.0
        assert rain_frac != -9999.9
        assert max_rate != -9999.9

        # 6. Disponibilidade 100% (750 células válidas)
        avail = obs["availability"]
        assert avail["status"] == "available"
        assert avail["valid_cells_ratio"] == 1.0
        assert avail["total_cells_count"] == 750
        assert avail["missing_cells_count"] == 0
