import pytest
import numpy as np
from indicators.precipitation_indicators import (
    calculate_mean_precipitation_rate,
    calculate_rain_area_fraction,
    calculate_temporal_variance,
    compute_observation_indicators,
)


def test_mean_precipitation_rate_positive():
    # 2x2 matrix with uniform rain 10.0 mm/h around equator (lat 0.0)
    matrix = np.array([[10.0, 10.0], [10.0, 10.0]])
    latitudes = np.array([0.0, 0.0])
    mean_val, valid_ratio, valid_count, total = calculate_mean_precipitation_rate(matrix, latitudes)

    assert mean_val == 10.0
    assert valid_ratio == 1.0
    assert valid_count == 4
    assert total == 4


def test_mean_precipitation_rate_missing_data_not_zero():
    # Regra Científica: Células ausentes (-9999.9 ou NaN) NÃO devem virar zero!
    matrix = np.array([[-9999.9, -9999.9], [-9999.9, -9999.9]])
    latitudes = np.array([0.0, 0.0])
    mean_val, valid_ratio, valid_count, total = calculate_mean_precipitation_rate(matrix, latitudes)

    assert mean_val is None  # Não pode retornar 0.0
    assert valid_ratio == 0.0
    assert valid_count == 0


def test_rain_area_fraction():
    # 4 células: duas com 5.0 mm/h (acima de 0.1) e duas com 0.0 mm/h
    matrix = np.array([[5.0, 0.0], [5.0, 0.0]])
    latitudes = np.array([0.0, 0.0])
    fraction = calculate_rain_area_fraction(matrix, latitudes, threshold_rate_mm_h=0.1)

    assert fraction == 0.5


def test_temporal_variance():
    assert calculate_temporal_variance(12.5, 10.0) == 2.5
    assert calculate_temporal_variance(None, 10.0) is None
    assert calculate_temporal_variance(5.0, None) is None
