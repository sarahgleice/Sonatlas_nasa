"""
Módulo de cálculo de indicadores científicos de precipitação.
"""

from .precipitation_indicators import (
    calculate_mean_precipitation_rate,
    calculate_rain_area_fraction,
    calculate_temporal_variance,
    compute_observation_indicators,
)

__all__ = [
    "calculate_mean_precipitation_rate",
    "calculate_rain_area_fraction",
    "calculate_temporal_variance",
    "compute_observation_indicators",
]
