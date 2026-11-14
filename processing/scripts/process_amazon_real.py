"""
Processamento espacial dos dados reais NASA GPM IMERG Early V07B para a Amazônia Central.
Gera a série temporal oficial com 6 observações de 30 minutos em formato JSON,
estritamente compatível com o motor de sonificação e contrato TypeScript do SONATLAS.
Auditado na Etapa 3.1:
- Preservação da precisão numérica em mean_precipitation_rate (sem truncamento/arredondamento forçado).
- Unidade 'fraction' para rain_area_fraction (adimensional entre 0 e 1).
- Renomeação semântica para 'temporal_difference' (diferença entre passos adjacentes) com alias retrocompatível.
- synchronization_status: 'pending_official_validation' para referências visuais não homologadas.
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


def load_amazon_geometry() -> Dict[str, float]:
    """Carrega as coordenadas da bounding box oficial a partir do GeoJSON."""
    geojson_path = os.path.join(
        PROCESSING_DIR, "geometry", "amazon", "central_amazon_bbox.geojson"
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


def process_real_observations() -> Dict[str, Any]:
    """Lê os grânulos reais, recorta a grade e calcula os indicadores físicos com alta fidelidade."""
    raw_dir = os.path.join(PROCESSING_DIR, "data", "raw")
    hdf5_files = sorted(glob.glob(os.path.join(raw_dir, "3B-HHR-E.*.V07B.HDF5")))

    if len(hdf5_files) < 6:
        raise FileNotFoundError(
            f"Esperado pelo menos 6 grânulos HDF5 em '{raw_dir}', encontrados {len(hdf5_files)}."
        )

    # Selecionar exatamente a sequência temporal contínua das 6 primeiras observações
    hdf5_files = hdf5_files[:6]

    bbox = load_amazon_geometry()
    extractor = GPMExtractor()

    observations: List[Dict[str, Any]] = []
    previous_mean: float = None

    for idx, fpath in enumerate(hdf5_files):
        # 1. Leitura com transposição matricial .T garantida
        raw_data = GPMExtractor.read_imerg_hdf5(fpath)
        
        # 2. Recorte espacial estrito para a Bounding Box da Amazônia Central
        clipped = extractor.clip_bounding_box(
            raw_data["latitudes"],
            raw_data["longitudes"],
            raw_data["precipitation_matrix"],
            bbox
        )

        matrix = clipped["precipitation_matrix"]
        lats = clipped["latitudes"]
        lons = clipped["longitudes"]

        # 3. Formatação do Timestamp UTC a partir do padrão de nomenclatura oficial da NASA
        filename = os.path.basename(fpath)
        date_part = filename.split("3IMERG.")[1].split("-S")[0]   # 20240101
        time_part = filename.split("-S")[1].split("-E")[0]       # 000000, 003000...
        timestamp_utc = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}T{time_part[:2]}:{time_part[2:4]}:{time_part[4:6]}Z"

        # 4. Cálculo dos Indicadores Científicos com ponderação pelo cosseno da latitude
        # Preserva a precisão original de ponto flutuante (sem arredondamento forçado que descaracteriza traços)
        mean_rate, valid_ratio, valid_count, total_cells = calculate_mean_precipitation_rate(
            matrix, lats, missing_value=-9999.0
        )
        rain_fraction = calculate_rain_area_fraction(
            matrix, lats, threshold_rate_mm_h=0.1, missing_value=-9999.0
        )
        temp_diff = calculate_temporal_difference(mean_rate, previous_mean)

        # Células válidas e pico máximo pontual
        valid_cells = matrix[(~np.isnan(matrix)) & (matrix > -9999.0)]
        max_rate = float(np.max(valid_cells)) if valid_cells.size > 0 else None

        # Status de disponibilidade conforme contrato da equipe
        if valid_ratio >= 0.80:
            avail_status = "available"
        elif valid_ratio >= 0.10:
            avail_status = "partial"
        else:
            avail_status = "missing"

        # Resumo textual acessível para leitores de tela
        if mean_rate is None or avail_status == "missing":
            textual_summary = (
                f"Observação em {timestamp_utc}: Dados científicos de precipitação não disponíveis."
            )
        elif mean_rate == 0.0 and (rain_fraction or 0.0) == 0.0:
            textual_summary = (
                f"Observação em {timestamp_utc}: Condições de calmaria sem precipitação detectada "
                f"na Amazônia Central."
            )
        else:
            intensity_label = (
                "leve" if mean_rate < 2.5 else "moderada" if mean_rate < 10.0 else "forte"
            )
            pct = round((rain_fraction or 0.0) * 100, 1)
            rate_disp = f"{mean_rate:.3f}" if (0.0 < mean_rate < 0.01) else f"{mean_rate:.2f}"
            textual_summary = (
                f"Precipitação {intensity_label} com taxa média de {rate_disp} mm/h cobrindo "
                f"aproximadamente {pct}% da área da Amazônia Central."
            )

        temporal_metric = {
            "value": temp_diff,
            "unit": "mm/h",
            "description": "Diferença temporal da taxa média em relação à observação anterior (Rt - Rt-1)"
        }

        observation_entry: Dict[str, Any] = {
            "observation_id": f"obs_amazon_{idx:03d}",
            "step_index": idx,
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
                "frame_id": f"frame_amazon_{idx:03d}",
                "image_path": "",
                "source_system": "NASA Scientific Visualization Studio (SVS 4285) / Earth Information Center",
                "synchronization_status": "pending_official_validation",
                "alt_text": textual_summary
            },
            "textual_summary": textual_summary
        }

        observations.append(observation_entry)
        previous_mean = mean_rate

    dataset: Dict[str, Any] = {
        "dataset_version": "1.0.0",
        "region_id": "amazon_central",
        "region_name": "Amazônia Central",
        "country": "Brasil",
        "bounding_box": bbox,
        "data_source": "NASA Earthdata GES DISC",
        "product_name": "GPM_3IMERGHHE",
        "product_version": "07B",
        "phenomenon": "precipitation",
        "temporal_resolution": "30_minutes",
        "is_sample": False,
        "validation_status": "preliminary_verified",
        "metadata_url": "https://gpm.nasa.gov/data/imerg",
        "observations": observations
    }

    return dataset


def main():
    print("[SONATLAS Etapa 3.1] Iniciando auditoria e reprocessamento com semântica corrigida...")
    dataset = process_real_observations()

    # Validação com DataValidator
    is_valid, errors = DataValidator.validate_dataset(dataset)
    if not is_valid:
        print("[ERRO CRÍTICO] Falha na validação do dataset gerado:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    print(f"[OK] Validação científica concluída: {len(dataset['observations'])} observações aprovadas.")

    # Destinos de exportação
    dest_amazon_dir = os.path.join(REPO_ROOT, "frontend", "public", "data", "amazon")
    dest_data_dir = os.path.join(REPO_ROOT, "frontend", "public", "data")
    dest_processed_dir = os.path.join(PROCESSING_DIR, "data", "processed")

    os.makedirs(dest_amazon_dir, exist_ok=True)
    os.makedirs(dest_processed_dir, exist_ok=True)

    # 1. Arquivo oficial: frontend/public/data/amazon/observations.json
    observations_file = os.path.join(dest_amazon_dir, "observations.json")
    with open(observations_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"[Export] Arquivo oficial gerado em: {observations_file}")

    # 2. Atualizar amazon_central_series.json para manter consistência absoluta
    series_file = os.path.join(dest_data_dir, "amazon_central_series.json")
    with open(series_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"[Export] Série do frontend atualizada em: {series_file}")

    # 3. Cópia no repositório científico processing/data/processed/
    processed_file = os.path.join(dest_processed_dir, "amazon_central_real_series.json")
    with open(processed_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"[Export] Cópia persistida em: {processed_file}")

    print("\n--- RESUMO DAS OBSERVAÇÕES AUDITADAS ---")
    for obs in dataset["observations"]:
        idx = obs["step_index"]
        ts = obs["timestamp_utc"]
        rate = obs["scientific_indicators"]["mean_precipitation_rate"]["value"]
        cov = obs["scientific_indicators"]["rain_area_fraction"]["value"]
        max_r = obs["scientific_indicators"]["max_precipitation_rate"]["value"]
        diff = obs["scientific_indicators"]["temporal_difference"]["value"]
        status = obs["availability"]["status"]
        diff_str = f"{diff:+.6f}" if diff is not None else "N/A"
        print(f"Passo {idx} | {ts} | Média: {rate:.6f} mm/h | Fração: {cov:.6f} | Delta: {diff_str} | Máx: {max_r:.2f} mm/h | Status: {status}")


if __name__ == "__main__":
    main()
