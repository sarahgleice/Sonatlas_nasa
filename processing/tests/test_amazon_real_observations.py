"""
Suíte de testes automatizados para as observações reais auditadas da Amazônia Central.
Valida precisão numérica, unidades semânticas, consistência entre os três arquivos JSON,
tratamento de nulos/sentinelas e conformidade estrita com o contrato do motor da Hazel.
"""

import os
import json
import pytest
import numpy as np

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

JSON_PATHS = [
    os.path.join(REPO_ROOT, "frontend", "public", "data", "amazon", "observations.json"),
    os.path.join(REPO_ROOT, "frontend", "public", "data", "amazon_central_series.json"),
    os.path.join(REPO_ROOT, "processing", "data", "processed", "amazon_central_real_series.json")
]


@pytest.fixture
def observations_dataset():
    assert os.path.exists(JSON_PATHS[0]), f"Arquivo principal não encontrado: {JSON_PATHS[0]}"
    with open(JSON_PATHS[0], "r", encoding="utf-8") as f:
        return json.load(f)


def test_three_json_files_consistency():
    """Confere se os três arquivos JSON contêm rigorosamente os mesmos dados auditados."""
    datasets = []
    for path in JSON_PATHS:
        assert os.path.exists(path), f"Arquivo não encontrado: {path}"
        with open(path, "r", encoding="utf-8") as f:
            datasets.append(json.load(f))

    # Comparação byte-a-byte e estrutural
    assert datasets[0] == datasets[1], "Divergência entre observations.json e amazon_central_series.json"
    assert datasets[0] == datasets[2], "Divergência entre observations.json e amazon_central_real_series.json"


def test_dataset_root_structure(observations_dataset):
    """Valida metadados essenciais na raiz do dataset."""
    assert observations_dataset["region_id"] == "amazon_central"
    assert observations_dataset["product_name"] == "GPM_3IMERGHHE"
    assert observations_dataset["product_version"] == "07B"
    assert observations_dataset["temporal_resolution"] == "30_minutes"
    assert observations_dataset["is_sample"] is False
    assert "observations" in observations_dataset
    assert len(observations_dataset["observations"]) == 6


def test_chronological_timestamps(observations_dataset):
    """Valida se os seis passos temporais em UTC seguem a ordem cronológica estrita de 30 minutos."""
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


def test_indicators_numerical_precision_and_semantics(observations_dataset):
    """Valida precisão numérica, unidades e limites físicos dos indicadores."""
    for idx, obs in enumerate(observations_dataset["observations"]):
        assert obs["step_index"] == idx
        indicators = obs["scientific_indicators"]

        # 1. Taxa média
        mean_rate = indicators["mean_precipitation_rate"]["value"]
        assert mean_rate is not None
        assert isinstance(mean_rate, (int, float))
        assert np.isfinite(mean_rate)
        assert mean_rate >= 0.0
        assert indicators["mean_precipitation_rate"]["unit"] == "mm/h"
        assert indicators["mean_precipitation_rate"]["metric_type"] == "rate"

        # 2. Fração de área
        rain_frac = indicators["rain_area_fraction"]["value"]
        assert rain_frac is not None
        assert isinstance(rain_frac, (int, float))
        assert np.isfinite(rain_frac)
        assert 0.0 <= rain_frac <= 1.0, f"Fração de área fora de [0, 1]: {rain_frac}"
        # Auditoria 3.1: unidade corrigida para 'fraction'
        assert indicators["rain_area_fraction"]["unit"] == "fraction"

        # 3. Diferença temporal (Rt - Rt-1)
        assert "temporal_difference" in indicators
        diff = indicators["temporal_difference"]["value"]
        if idx == 0:
            assert diff is None, "Primeira observação deve ter diferença temporal nula (linha base)"
        else:
            assert diff is not None
            assert np.isfinite(diff)
            assert indicators["temporal_difference"]["unit"] == "mm/h"

        # 4. Pico máximo pontual
        max_rate = indicators["max_precipitation_rate"]["value"]
        assert max_rate is not None
        assert max_rate >= mean_rate

        # 5. Ausência de valores sentinela da NASA nos indicadores
        assert mean_rate != -9999.9 and mean_rate != -9999.0
        assert rain_frac != -9999.9
        assert max_rate != -9999.9


def test_visual_reference_status_unverified(observations_dataset):
    """Auditoria 3.1: se não há frames PNG comprovados em disco, status deve ser pending."""
    for obs in observations_dataset["observations"]:
        vref = obs["visual_frame_reference"]
        assert vref["synchronization_status"] == "pending_official_validation"
        assert vref["image_path"] == ""


def test_availability_and_completeness(observations_dataset):
    """Valida consistência entre as células válidas e o status de disponibilidade."""
    for obs in observations_dataset["observations"]:
        avail = obs["availability"]
        assert avail["status"] == "available"
        assert avail["total_cells_count"] == 750
        assert avail["valid_cells_ratio"] == 1.0
        assert avail["missing_cells_count"] == 0


def test_missing_values_not_treated_as_zero():
    """Garante que células sentinela ausentes nunca sejam imputadas artificialmente como zero."""
    from indicators.precipitation_indicators import calculate_mean_precipitation_rate

    matrix_with_missing = np.array([[-9999.9, -9999.9], [5.0, 5.0]])
    lats = np.array([-3.0, -2.0])
    mean_rate, ratio, valid_count, total = calculate_mean_precipitation_rate(matrix_with_missing, lats)

    assert valid_count == 2
    assert total == 4
    assert ratio == 0.5
    # Média exclusivamente sobre as células válidas (5.0), e NÃO (5+5+0+0)/4 = 2.5
    assert mean_rate == 5.0
