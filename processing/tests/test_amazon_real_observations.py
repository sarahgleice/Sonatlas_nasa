"""
Suíte de testes automatizados para as observações reais processadas da Amazônia Central.
Valida os 6 passos temporais, limites físicos, tratamento de nulos e conformidade
com o contrato TypeScript do motor de sonificação da Hazel.
"""

import os
import json
import pytest
import numpy as np

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OBSERVATIONS_JSON_PATH = os.path.join(REPO_ROOT, "frontend", "public", "data", "amazon", "observations.json")


@pytest.fixture
def observations_dataset():
    assert os.path.exists(OBSERVATIONS_JSON_PATH), f"Arquivo não encontrado: {OBSERVATIONS_JSON_PATH}"
    with open(OBSERVATIONS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_dataset_root_structure(observations_dataset):
    assert observations_dataset["region_id"] == "amazon_central"
    assert observations_dataset["product_name"] == "GPM_3IMERGHHE"
    assert observations_dataset["product_version"] == "07B"
    assert observations_dataset["temporal_resolution"] == "30_minutes"
    assert observations_dataset["is_sample"] is False
    assert "observations" in observations_dataset
    assert len(observations_dataset["observations"]) == 6


def test_chronological_timestamps(observations_dataset):
    expected_timestamps = [
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:30:00Z",
        "2024-01-01T01:00:00Z",
        "2024-01-01T01:30:00Z",
        "2024-01-01T02:00:00Z",
        "2024-01-01T02:30:00Z",
    ]
    actual_timestamps = [obs["timestamp_utc"] for obs in observations_dataset["observations"]]
    assert actual_timestamps == expected_timestamps


def test_hazel_contract_compatibility(observations_dataset):
    for idx, obs in enumerate(observations_dataset["observations"]):
        assert obs["step_index"] == idx
        assert "availability" in obs
        assert obs["availability"]["status"] in ["available", "partial", "missing"]
        assert obs["availability"]["total_cells_count"] == 750
        assert obs["availability"]["valid_cells_ratio"] == 1.0

        indicators = obs["scientific_indicators"]
        assert "mean_precipitation_rate" in indicators
        assert "rain_area_fraction" in indicators

        mean_rate = indicators["mean_precipitation_rate"]["value"]
        assert mean_rate is not None
        assert isinstance(mean_rate, (int, float))
        assert np.isfinite(mean_rate)
        assert mean_rate >= 0.0
        assert indicators["mean_precipitation_rate"]["unit"] == "mm/h"

        rain_frac = indicators["rain_area_fraction"]["value"]
        assert rain_frac is not None
        assert isinstance(rain_frac, (int, float))
        assert np.isfinite(rain_frac)
        assert 0.0 <= rain_frac <= 1.0

        max_rate = indicators["max_precipitation_rate"]["value"]
        assert max_rate is not None
        assert max_rate >= mean_rate


def test_missing_values_not_treated_as_zero():
    from indicators.precipitation_indicators import calculate_mean_precipitation_rate

    matrix_with_missing = np.array([[-9999.9, -9999.9], [5.0, 5.0]])
    lats = np.array([-3.0, -2.0])
    mean_rate, ratio, valid_count, total = calculate_mean_precipitation_rate(matrix_with_missing, lats)

    assert valid_count == 2
    assert total == 4
    assert ratio == 0.5
    # The mean of only the 2 valid cells (5.0 and 5.0) must be 5.0, NOT (5+5+0+0)/4 = 2.5!
    assert mean_rate == 5.0


def test_rain_area_fraction_thresholds():
    from indicators.precipitation_indicators import calculate_rain_area_fraction

    # 4 células: 0.0 (sem chuva), 0.05 (chuva leve < 0.1), 0.2 (chuva >= 0.1), 1.0 (chuva >= 0.1)
    matrix = np.array([[0.0, 0.05], [0.2, 1.0]])
    lats = np.array([0.0, 0.0])
    fraction = calculate_rain_area_fraction(matrix, lats, threshold_rate_mm_h=0.1)

    # Apenas as células 0.2 e 1.0 atendem ao limiar >= 0.1 mm/h -> 2 de 4 células = 0.5
    assert fraction == 0.5
