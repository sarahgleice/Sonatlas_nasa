"""
Suíte de testes automatizados para as observações reais vespertinas da Amazônia Central.
Valida integridade numérica, metadados científicos NASA IMERG Early V07B e
consistência entre os arquivos da janela vespertina (17:00 a 19:30 UTC).
"""

import os
import json
import pytest
import numpy as np

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

JSON_PATHS = [
    os.path.join(REPO_ROOT, "frontend", "public", "data", "amazon", "observations_afternoon.json"),
    os.path.join(REPO_ROOT, "processing", "data", "processed", "amazon_central_afternoon_series.json")
]


@pytest.fixture
def amazon_afternoon_dataset():
    assert os.path.exists(JSON_PATHS[0]), f"Arquivo principal não encontrado: {JSON_PATHS[0]}"
    with open(JSON_PATHS[0], "r", encoding="utf-8") as f:
        return json.load(f)


def test_amazon_afternoon_json_consistency():
    datasets = []
    for path in JSON_PATHS:
        assert os.path.exists(path), f"Arquivo não encontrado: {path}"
        with open(path, "r", encoding="utf-8") as f:
            datasets.append(json.load(f))
    assert datasets[0] == datasets[1], "Divergência entre public e processed vespertinos"


def test_amazon_afternoon_root_structure(amazon_afternoon_dataset):
    assert amazon_afternoon_dataset["region_id"] == "amazon_central"
    assert amazon_afternoon_dataset["product_name"] == "GPM_3IMERGHHE"
    assert amazon_afternoon_dataset["product_version"] == "07B"
    assert amazon_afternoon_dataset["is_sample"] is False
    assert len(amazon_afternoon_dataset["observations"]) == 6


def test_amazon_afternoon_timestamps(amazon_afternoon_dataset):
    expected_timestamps = [
        "2024-01-01T17:00:00Z",
        "2024-01-01T17:30:00Z",
        "2024-01-01T18:00:00Z",
        "2024-01-01T18:30:00Z",
        "2024-01-01T19:00:00Z",
        "2024-01-01T19:30:00Z",
    ]
    actual_timestamps = [obs["timestamp_utc"] for obs in amazon_afternoon_dataset["observations"]]
    assert actual_timestamps == expected_timestamps


def test_amazon_afternoon_indicators_physics(amazon_afternoon_dataset):
    for idx, obs in enumerate(amazon_afternoon_dataset["observations"]):
        indicators = obs["scientific_indicators"]
        mean_rate = indicators["mean_precipitation_rate"]["value"]
        rain_frac = indicators["rain_area_fraction"]["value"]

        assert mean_rate is not None and np.isfinite(mean_rate) and mean_rate >= 0.0
        assert rain_frac is not None and 0.0 <= rain_frac <= 1.0
        assert indicators["rain_area_fraction"]["unit"] == "fraction"

        diff = indicators["temporal_difference"]["value"]
        if idx == 0:
            assert diff is None
        else:
            assert diff is not None and np.isfinite(diff)

        avail = obs["availability"]
        assert avail["status"] == "available"
        assert avail["valid_cells_ratio"] == 1.0
        assert avail["total_cells_count"] == 750
