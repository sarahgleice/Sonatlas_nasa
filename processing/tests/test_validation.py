import pytest
from validation.data_validator import DataValidator


def test_validator_detects_missing_keys():
    incomplete_dataset = {
        "dataset_version": "1.0.0",
        "region_id": "test_region"
    }
    is_valid, errors = DataValidator.validate_dataset(incomplete_dataset)
    assert not is_valid
    assert any("Chave obrigatória ausente" in err for err in errors)


def test_validator_rejects_missing_status_with_numeric_value():
    # Violação: status é 'missing' mas tem valor numérico
    invalid_obs = {
        "observation_id": "obs_001",
        "timestamp_utc": "2026-10-12T12:00:00Z",
        "availability": {
            "status": "missing",
            "valid_cells_ratio": 0.0
        },
        "scientific_indicators": {
            "mean_precipitation_rate": {
                "value": 15.0,  # Erro: deveria ser null
                "unit": "mm/h"
            }
        }
    }
    errors = DataValidator.validate_observation(invalid_obs, 0)
    assert any("status é 'missing', logo 'mean_precipitation_rate' deve ser null" in err for err in errors)


def test_validator_rejects_incorrect_unit():
    invalid_obs = {
        "observation_id": "obs_002",
        "timestamp_utc": "2026-10-12T12:00:00Z",
        "availability": {
            "status": "available",
            "valid_cells_ratio": 1.0
        },
        "scientific_indicators": {
            "mean_precipitation_rate": {
                "value": 5.0,
                "unit": "mm"  # Erro: deve ser mm/h
            }
        }
    }
    errors = DataValidator.validate_observation(invalid_obs, 0)
    assert any("unidade de taxa de precipitação deve ser 'mm/h'" in err for err in errors)
