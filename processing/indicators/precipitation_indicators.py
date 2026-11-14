"""
Cálculo de indicadores físicos de precipitação com rigor metodológico:
- Ponderação pelo cosseno da latitude.
- Separação estrita entre taxa instantânea (mm/h) e acumulação (mm).
- Tratamento explícito de dados ausentes (sem converter para zero).
"""

from typing import Dict, Any, Optional, Tuple
import numpy as np


def calculate_mean_precipitation_rate(
    precipitation_matrix: np.ndarray,
    latitudes: np.ndarray,
    missing_value: float = -9999.9,
    min_valid_ratio: float = 0.10
) -> Tuple[Optional[float], float, int, int]:
    """
    Calcula a taxa média espacial ponderada pelo cosseno da latitude (mm/h).
    
    Retorna:
        Tuple: (mean_rate_or_none, valid_cells_ratio, valid_count, total_count)
    """
    total_cells = int(precipitation_matrix.size)
    if total_cells == 0:
        return None, 0.0, 0, 0

    # Identificar células válidas (não NaN e não valor sentinela)
    valid_mask = (~np.isnan(precipitation_matrix)) & (precipitation_matrix > missing_value)
    valid_count = int(np.sum(valid_mask))
    valid_ratio = float(valid_count / total_cells)

    if valid_ratio < min_valid_ratio:
        # Menos do que a razão mínima aceitável de células válidas -> dado ausente
        return None, valid_ratio, valid_count, total_cells

    # Ponderação pela latitude em radianos: cos(lat)
    lat_rad = np.deg2rad(latitudes)
    cos_lat = np.cos(lat_rad)
    
    # Expandir dimensões de latitude para corresponder à matriz (lat, lon)
    if precipitation_matrix.ndim == 2:
        weights = np.repeat(cos_lat[:, np.newaxis], precipitation_matrix.shape[1], axis=1)
    else:
        weights = np.ones_like(precipitation_matrix)

    valid_weights = weights * valid_mask
    sum_weights = np.sum(valid_weights)

    if sum_weights <= 0:
        return None, valid_ratio, valid_count, total_cells

    weighted_precip = np.sum(precipitation_matrix * valid_weights)
    mean_rate = float(weighted_precip / sum_weights)

    return round(mean_rate, 2), round(valid_ratio, 3), valid_count, total_cells


def calculate_rain_area_fraction(
    precipitation_matrix: np.ndarray,
    latitudes: np.ndarray,
    threshold_rate_mm_h: float = 0.1,
    missing_value: float = -9999.9
) -> Optional[float]:
    """
    Calcula a proporção da área com chuva estimada positiva (>= threshold_rate_mm_h),
    ponderada pelo cosseno da latitude sobre as células válidas.
    """
    valid_mask = (~np.isnan(precipitation_matrix)) & (precipitation_matrix > missing_value)
    if not np.any(valid_mask):
        return None

    lat_rad = np.deg2rad(latitudes)
    cos_lat = np.cos(lat_rad)
    
    if precipitation_matrix.ndim == 2:
        weights = np.repeat(cos_lat[:, np.newaxis], precipitation_matrix.shape[1], axis=1)
    else:
        weights = np.ones_like(precipitation_matrix)

    valid_weights = weights * valid_mask
    sum_valid_weights = np.sum(valid_weights)
    if sum_valid_weights <= 0:
        return None

    rain_mask = valid_mask & (precipitation_matrix >= threshold_rate_mm_h)
    rain_weights = weights * rain_mask
    fraction = float(np.sum(rain_weights) / sum_valid_weights)

    return round(fraction, 3)


def calculate_temporal_variance(
    current_mean: Optional[float],
    previous_mean: Optional[float]
) -> Optional[float]:
    """
    Calcula a variação temporal de taxa de precipitação entre observações adjacentes.
    """
    if current_mean is None or previous_mean is None:
        return None
    return round(float(current_mean - previous_mean), 2)


def compute_observation_indicators(
    step_index: int,
    timestamp_utc: str,
    precipitation_matrix: np.ndarray,
    latitudes: np.ndarray,
    previous_mean: Optional[float] = None,
    observation_id_prefix: str = "obs"
) -> Dict[str, Any]:
    """
    Gera o dicionário completo estruturado da observação conforme o data-dictionary.md.
    """
    mean_rate, valid_ratio, valid_count, total_cells = calculate_mean_precipitation_rate(
        precipitation_matrix, latitudes
    )
    rain_fraction = calculate_rain_area_fraction(precipitation_matrix, latitudes)
    temporal_var = calculate_temporal_variance(mean_rate, previous_mean)

    # Determinar status de disponibilidade
    if valid_ratio >= 0.80:
        avail_status = "available"
    elif valid_ratio >= 0.10:
        avail_status = "partial"
    else:
        avail_status = "missing"

    valid_cells = precipitation_matrix[
        (~np.isnan(precipitation_matrix)) & (precipitation_matrix > -9999.0)
    ]
    max_rate = round(float(np.max(valid_cells)), 2) if valid_cells.size > 0 else None

    # Resumo textual amigável e acessível
    if mean_rate is None or avail_status == "missing":
        summary = f"Observação em {timestamp_utc}: Dados científicos não disponíveis para este intervalo."
    else:
        intensity_label = "leve" if mean_rate < 2.5 else "moderada" if mean_rate < 10.0 else "forte"
        pct = round((rain_fraction or 0.0) * 100, 1)
        summary = (
            f"Precipitação {intensity_label} com taxa média de {mean_rate} mm/h cobrindo "
            f"aproximadamente {pct}% da área de estudo."
        )

    return {
        "observation_id": f"{observation_id_prefix}_{step_index:03d}",
        "step_index": step_index,
        "timestamp_utc": timestamp_utc,
        "availability": {
            "status": avail_status,
            "valid_cells_ratio": valid_ratio,
            "missing_cells_count": total_cells - valid_count,
            "total_cells_count": total_cells
        },
        "scientific_indicators": {
            "mean_precipitation_rate": {
                "value": mean_rate,
                "unit": "mm/h",
                "metric_type": "rate",
                "description": "Taxa média espacial de precipitação ponderada pela área da célula"
            },
            "rain_area_fraction": {
                "value": rain_fraction,
                "unit": "percentage",
                "threshold_rate_mm_h": 0.1,
                "description": "Proporção da área com taxa de precipitação >= 0.1 mm/h"
            },
            "max_precipitation_rate": {
                "value": max_rate,
                "unit": "mm/h",
                "description": "Pico máximo pontual de precipitação registrado"
            },
            "temporal_variance": {
                "value": temporal_var,
                "unit": "mm/h",
                "description": "Variação da taxa média em relação à observação anterior"
            }
        },
        "visual_frame_reference": {
            "frame_id": f"frame_{step_index:03d}",
            "image_path": f"/visualizations/frame_{step_index:03d}.png",
            "source_system": "NASA Earth Information Center (EIC)",
            "synchronization_status": "pending_official_validation",
            "alt_text": summary
        },
        "textual_summary": summary
    }
