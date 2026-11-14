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
    min_valid_ratio: float = 0.10,
    round_decimals: Optional[int] = None
) -> Tuple[Optional[float], float, int, int]:
    """
    Calcula a taxa média espacial ponderada pelo cosseno da latitude (mm/h).
    Preserva a precisão original de ponto flutuante por padrão (sem arredondamento forçado).
    
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

    if round_decimals is not None:
        mean_rate = round(mean_rate, round_decimals)

    return mean_rate, round(valid_ratio, 4), valid_count, total_cells


def calculate_rain_area_fraction(
    precipitation_matrix: np.ndarray,
    latitudes: np.ndarray,
    threshold_rate_mm_h: float = 0.1,
    missing_value: float = -9999.9,
    round_decimals: Optional[int] = None
) -> Optional[float]:
    """
    Calcula a proporção da área com chuva estimada positiva (>= threshold_rate_mm_h),
    ponderada pelo cosseno da latitude sobre as células válidas.
    Retorna uma fração adimensional entre 0.0 e 1.0.
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

    if round_decimals is not None:
        fraction = round(fraction, round_decimals)

    return fraction


def calculate_temporal_difference(
    current_mean: Optional[float],
    previous_mean: Optional[float],
    round_decimals: Optional[int] = None
) -> Optional[float]:
    """
    Calcula a diferença temporal de taxa média de precipitação entre observações adjacentes (Rt - Rt-1).
    """
    if current_mean is None or previous_mean is None:
        return None
    diff = float(current_mean - previous_mean)
    if round_decimals is not None:
        diff = round(diff, round_decimals)
    return diff


# Alias semântico para retrocompatibilidade
calculate_temporal_variance = calculate_temporal_difference


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
    elif mean_rate == 0.0 and (rain_fraction or 0.0) == 0.0:
        summary = f"Observação em {timestamp_utc}: Condições de calmaria sem precipitação detectada na Amazônia Central."
    else:
        intensity_label = "leve" if mean_rate < 2.5 else "moderada" if mean_rate < 10.0 else "forte"
        pct = round((rain_fraction or 0.0) * 100, 1)
        rate_str = f"{mean_rate:.3f}" if (0.0 < mean_rate < 0.01) else f"{mean_rate:.2f}"
        summary = (
            f"Precipitação {intensity_label} com taxa média de {rate_str} mm/h cobrindo "
            f"aproximadamente {pct}% da área de estudo."
        )

    temporal_metric = {
        "value": temporal_var,
        "unit": "mm/h",
        "description": "Diferença temporal da taxa média em relação à observação anterior (Rt - Rt-1)"
    }

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
                "unit": "fraction",
                "threshold_rate_mm_h": 0.1,
                "description": "Fração da área com taxa de precipitação >= 0.1 mm/h (adimensional entre 0 e 1)"
            },
            "max_precipitation_rate": {
                "value": max_rate,
                "unit": "mm/h",
                "description": "Pico máximo pontual de precipitação registrado"
            },
            "temporal_difference": temporal_metric,
            "temporal_variance": temporal_metric
        },
        "visual_frame_reference": {
            "frame_id": f"frame_{step_index:03d}",
            "image_path": "",
            "source_system": "NASA Scientific Visualization Studio (SVS 4285) / Earth Information Center",
            "synchronization_status": "pending_official_validation",
            "alt_text": summary
        },
        "textual_summary": summary
    }
