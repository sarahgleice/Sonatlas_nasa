"""
Processamento espacial dos dados reais NASA GPM IMERG Early V07B para a Bacia do Congo
(Janela Amostral de Kisangani, República Democrática do Congo).

Gera a série temporal oficial com 6 observações de 30 minutos em formato JSON,
estritamente compatível com o motor de sonificação e contrato TypeScript do SONATLAS.
Utiliza os mesmos timestamps vespertinos da Amazônia Central:
01/01/2024 de 17:00 a 19:30 UTC.
"""

import os
import sys
import glob
import json
from typing import Dict, Any, List
import numpy as np

# Configurar caminhos do projeto
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROCESSING_DIR = os.path.dirname(SCRIPT_DIR)
REPO_ROOT = os.path.dirname(PROCESSING_DIR)

if PROCESSING_DIR not in sys.path:
    sys.path.insert(0, PROCESSING_DIR)

from extraction.gpm_extractor import GPMExtractor
from indicators.precipitation_indicators import (
    calculate_mean_precipitation_rate,
    calculate_rain_area_fraction,
    calculate_temporal_difference
)
from validation.data_validator import DataValidator


def load_congo_geometry() -> Dict[str, float]:
    """Carrega as coordenadas da bounding box oficial de Kisangani a partir do GeoJSON."""
    geojson_path = os.path.join(
        PROCESSING_DIR, "geometry", "international", "congo_basin_kisangani_bbox.geojson"
    )
    with open(geojson_path, "r", encoding="utf-8") as f:
        geom_data = json.load(f)

    coords = geom_data["features"][0]["geometry"]["coordinates"][0]
    lons = [p[0] for p in coords]
    lats = [p[1] for p in coords]

    return {
        "min_latitude": float(min(lats)),
        "max_latitude": float(max(lats)),
        "min_longitude": float(min(lons)),
        "max_longitude": float(max(lons))
    }


def get_afternoon_granules() -> List[str]:
    """Identifica os 6 grânulos vespertinos ordenados cronologicamente."""
    raw_dir = os.path.join(PROCESSING_DIR, "data", "raw")
    afternoon_files = sorted(glob.glob(os.path.join(raw_dir, "3B-HHR-E.*-S1[7-9]*.V07B.HDF5")))
    if len(afternoon_files) != 6:
        raise FileNotFoundError(
            f"Esperado exatamente 6 grânulos vespertinos (17:00 a 19:30 UTC) em '{raw_dir}', encontrados {len(afternoon_files)}."
        )
    return afternoon_files


def generate_qualitative_summary(mean_rate: float, rain_fraction: float, step: int, time_str: str) -> str:
    """Gera resumo textual acessível para leitor de tela focado no contexto bioclimático de Kisangani."""
    time_fmt = f"{time_str[:2]}:{time_str[2:4]} UTC"
    local_hour = (int(time_str[:2]) + 2) % 24
    local_fmt = f"{local_hour:02d}:{time_str[2:4]} (Horário local de Kisangani, CAT)"

    if mean_rate == 0.0 or rain_fraction == 0.0:
        desc = "Ausência total de precipitação na janela de Kisangani (tempo estável e seco)."
    elif mean_rate < 0.05:
        desc = f"Atividade convectiva muito leve com garoa localizada cobrindo {rain_fraction * 100:.1f}% da área."
    elif mean_rate < 0.15:
        desc = f"Chuva leve disseminada com taxa média de {mean_rate:.2f} mm/h e cobertura de {rain_fraction * 100:.1f}%."
    else:
        desc = f"Convecção equatorial moderada a forte com taxa média de {mean_rate:.2f} mm/h cobrindo {rain_fraction * 100:.1f}% da janela amostral."

    return f"Observação {step + 1} de 6 — {time_fmt} [{local_fmt}]: {desc}"


def process_congo_observations() -> Dict[str, Any]:
    """Processa os 6 grânulos vespertinos para a janela de Kisangani na Bacia do Congo."""
    hdf5_files = get_afternoon_granules()
    bbox = load_congo_geometry()
    extractor = GPMExtractor()

    observations: List[Dict[str, Any]] = []
    previous_mean: float = None

    for idx, fpath in enumerate(hdf5_files):
        raw_data = GPMExtractor.read_imerg_hdf5(fpath)

        clipped = extractor.clip_bounding_box(
            raw_data["latitudes"],
            raw_data["longitudes"],
            raw_data["precipitation_matrix"],
            bbox
        )

        matrix = clipped["precipitation_matrix"]
        lats = clipped["latitudes"]
        lons = clipped["longitudes"]

        filename = os.path.basename(fpath)
        date_part = filename.split("3IMERG.")[1].split("-S")[0]   # 20240101
        time_part = filename.split("-S")[1].split("-E")[0]       # 170000, 173000...
        timestamp_utc = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}T{time_part[:2]}:{time_part[2:4]}:{time_part[4:6]}Z"

        mean_rate, valid_ratio, valid_count, total_cells = calculate_mean_precipitation_rate(
            matrix, lats, missing_value=-9999.0
        )
        rain_fraction = calculate_rain_area_fraction(
            matrix, lats, threshold_rate_mm_h=0.1, missing_value=-9999.0
        )
        temporal_diff = calculate_temporal_difference(mean_rate, previous_mean)
        previous_mean = mean_rate

        valid_values = matrix[(matrix != -9999.0) & (matrix != -9999.9) & (matrix >= 0.0)]
        max_rate = float(np.max(valid_values)) if valid_values.size > 0 else 0.0

        if valid_ratio >= 0.80:
            status = "available"
        elif valid_ratio >= 0.10:
            status = "partial"
        else:
            status = "missing"
        missing_count = int(total_cells - valid_count)

        summary_text = generate_qualitative_summary(mean_rate, rain_fraction, idx, time_part)

        obs_record: Dict[str, Any] = {
            "observation_id": f"obs_congo_{idx:03d}",
            "step_index": idx,
            "timestamp_utc": timestamp_utc,
            "availability": {
                "status": status,
                "valid_cells_ratio": float(valid_ratio),
                "missing_cells_count": missing_count,
                "total_cells_count": int(total_cells)
            },
            "scientific_indicators": {
                "mean_precipitation_rate": {
                    "value": float(mean_rate),
                    "unit": "mm/h",
                    "metric_type": "rate",
                    "description": "Taxa média espacial de precipitação ponderada pela área da célula (cosseno da latitude)"
                },
                "rain_area_fraction": {
                    "value": float(rain_fraction),
                    "unit": "fraction",
                    "threshold_rate_mm_h": 0.1,
                    "description": "Fração da área com taxa de precipitação >= 0.1 mm/h (adimensional entre 0 e 1)"
                },
                "max_precipitation_rate": {
                    "value": float(max_rate),
                    "unit": "mm/h",
                    "description": "Pico máximo pontual de precipitação registrado no recorte"
                },
                "temporal_difference": {
                    "value": float(temporal_diff) if temporal_diff is not None else None,
                    "unit": "mm/h",
                    "description": "Variação da taxa média em relação à observação imediatamente anterior"
                },
                "temporal_variance": {
                    "value": float(temporal_diff) if temporal_diff is not None else None,
                    "unit": "mm/h",
                    "description": "Alias retrocompatível para variação temporal entre passos"
                }
            },
            "visual_frame_reference": {
                "frame_id": f"frame_congo_{idx:03d}",
                "image_path": "",
                "source_system": "NASA Scientific Visualization Studio (SVS) / Earth Information Center",
                "synchronization_status": "pending_official_validation",
                "alt_text": summary_text
            },
            "textual_summary": summary_text
        }

        observations.append(obs_record)

    dataset: Dict[str, Any] = {
        "dataset_version": "1.0.0",
        "region_id": "congo_basin_kisangani",
        "region_name": "Bacia do Congo (Janela de Kisangani)",
        "country": "República Democrática do Congo",
        "data_source": "NASA Earthdata GES DISC",
        "product_name": "GPM_3IMERGHHE",
        "product_version": "07B",
        "phenomenon": "precipitation",
        "temporal_resolution": "30_minutes",
        "is_sample": False,
        "validation_status": "preliminary_verified",
        "metadata_url": "https://gpm.nasa.gov/data/imerg",
        "bounding_box": bbox,
        "note": (
            "Janela amostral de controle em torno de Kisangani (RDC) para comparação bioclimática 1:1 controlada "
            "com a Amazônia Central. Mesma área de 750 células e mesmos timestamps UTC. "
            "Não representa a totalidade da Bacia do Rio Congo."
        ),
        "observations": observations
    }

    return dataset


def save_congo_dataset(dataset: Dict[str, Any]) -> List[str]:
    """Exporta o JSON nos destinos oficiais do projeto."""
    frontend_dir = os.path.join(REPO_ROOT, "frontend", "public", "data", "congo")
    os.makedirs(frontend_dir, exist_ok=True)
    out_frontend = os.path.join(frontend_dir, "observations.json")

    processed_dir = os.path.join(PROCESSING_DIR, "data", "processed")
    os.makedirs(processed_dir, exist_ok=True)
    out_processed = os.path.join(processed_dir, "congo_kisangani_real_series.json")

    paths = [out_frontend, out_processed]
    for p in paths:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(dataset, f, indent=2, ensure_ascii=False)
        print(f"Salvo com sucesso: {p}")

    return paths


if __name__ == "__main__":
    data = process_congo_observations()
    saved = save_congo_dataset(data)
    print("\nResumo das observações do Congo (Kisangani):")
    for o in data["observations"]:
        ts = o["timestamp_utc"]
        m = o["scientific_indicators"]["mean_precipitation_rate"]["value"]
        frac = o["scientific_indicators"]["rain_area_fraction"]["value"]
        diff = o["scientific_indicators"]["temporal_difference"]["value"]
        print(f"  [{ts}] Média: {m:.6f} mm/h | Fração: {frac * 100:.2f}% | Delta: {diff}")
