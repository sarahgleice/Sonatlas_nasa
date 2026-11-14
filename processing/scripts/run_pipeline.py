"""
Pipeline principal de processamento e exportação do SONATLAS.
Uso:
    python run_pipeline.py --demo
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List
import numpy as np

# Garantir importações relativas de processing
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from indicators.precipitation_indicators import compute_observation_indicators
from validation.data_validator import DataValidator


def generate_sample_dataset() -> Dict[str, Any]:
    """
    Gera um conjunto demonstrativo rigorosamente formatado para a Amazônia Central,
    respeitando os limites físicos e o dicionário de dados do projeto.
    Todos os dados são rotulados explicitamente como amostras técnicas demonstrativas.
    """
    # Grade sintética de 10x10 células representando a bounding box da Amazônia Central
    latitudes = np.linspace(-4.0, -1.5, 10)
    longitudes = np.linspace(-61.5, -58.5, 10)

    # 6 instantes de observação representando a passagem de uma linha de instabilidade tropical
    timestamps = [
        "2026-10-12T12:00:00Z",
        "2026-10-12T12:30:00Z",
        "2026-10-12T13:00:00Z",
        "2026-10-12T13:30:00Z",
        "2026-10-12T14:00:00Z",
        "2026-10-12T14:30:00Z",
    ]

    observations: List[Dict[str, Any]] = []
    previous_mean = None

    # Simulação controlada de ciclo convectivo:
    # 0: Chuva fraca isolada
    # 1: Expansão convectiva
    # 2: Pico da tempestade
    # 3: Chuva moderada disseminada
    # 4: Dado parcialmente ausente (para teste de resiliência e acessibilidade)
    # 5: Dissipação final
    scenarios = [
        {"mean_target": 1.2, "coverage": 0.15, "missing": False},
        {"mean_target": 4.5, "coverage": 0.45, "missing": False},
        {"mean_target": 16.8, "coverage": 0.85, "missing": False},
        {"mean_target": 8.2, "coverage": 0.60, "missing": False},
        {"mean_target": None, "coverage": 0.0, "missing": True},  # Caso de teste: dado ausente
        {"mean_target": 0.4, "coverage": 0.10, "missing": False},
    ]

    for idx, (ts, scn) in enumerate(zip(timestamps, scenarios)):
        if scn["missing"]:
            # Matriz quase toda preenchida com valores sentinela (-9999.9)
            matrix = np.full((10, 10), -9999.9)
        else:
            # Gerar matriz com valores em torno da taxa alvo e cobertura especificada
            matrix = np.zeros((10, 10))
            num_rain_cells = int(100 * scn["coverage"])
            rain_indices = np.random.RandomState(42 + idx).choice(100, num_rain_cells, replace=False)
            flat_matrix = np.zeros(100)
            # Amostra em torno da média
            flat_matrix[rain_indices] = np.random.RandomState(42 + idx).exponential(
                scale=scn["mean_target"], size=num_rain_cells
            )
            matrix = flat_matrix.reshape((10, 10))

        obs = compute_observation_indicators(
            step_index=idx,
            timestamp_utc=ts,
            precipitation_matrix=matrix,
            latitudes=latitudes,
            previous_mean=previous_mean,
            observation_id_prefix="obs_amazon"
        )
        observations.append(obs)
        previous_mean = obs["scientific_indicators"]["mean_precipitation_rate"]["value"]

    dataset = {
        "dataset_version": "1.0.0",
        "region_id": "amazon_central",
        "region_name": "Amazônia Central",
        "country": "Brasil",
        "bounding_box": {
            "min_latitude": -4.0,
            "max_latitude": -1.5,
            "min_longitude": -61.5,
            "max_longitude": -58.5
        },
        "data_source": "NASA Earthdata GES DISC",
        "product_name": "GPM_3IMERGHHE",
        "product_version": "07B",
        "phenomenon": "precipitation",
        "temporal_resolution": "30_minutes",
        "is_sample": True,
        "validation_status": "preliminary_verified",
        "metadata_url": "https://gpm.nasa.gov/data/imerg",
        "observations": observations
    }

    return dataset


def generate_international_placeholder_dataset() -> Dict[str, Any]:
    """
    Gera a estrutura placeholder para a região internacional candidata (Bacia do Congo),
    sem dados fictícios nem falsas observações.
    """
    return {
        "dataset_version": "1.0.0",
        "region_id": "international_candidate",
        "region_name": "Região Internacional Candidata (Bacia do Congo)",
        "country": "África Central",
        "bounding_box": {
            "min_latitude": -2.0,
            "max_latitude": 2.0,
            "min_longitude": 18.0,
            "max_longitude": 24.0
        },
        "data_source": "NASA Earthdata GES DISC",
        "product_name": "GPM_3IMERGHHE",
        "product_version": "07B",
        "phenomenon": "precipitation",
        "temporal_resolution": "30_minutes",
        "is_sample": True,
        "is_placeholder": True,
        "validation_status": "candidate_under_review",
        "note": "Área de estudo internacional sob validação da equipe científica. Dados reais em processo de homologação.",
        "observations": []
    }


def main():
    parser = argparse.ArgumentParser(description="Pipeline de processamento e exportação SONATLAS")
    parser.add_argument("--demo", action="store_true", help="Gera datasets demonstrativos de referência")
    args = parser.parse_args()

    print("[SONATLAS Pipeline] Iniciando processamento...")

    dataset = generate_sample_dataset()
    is_valid, errors = DataValidator.validate_dataset(dataset)

    if not is_valid:
        print("[ERRO] Falha na validação do dataset:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    print(f"[OK] Dataset validado com sucesso ({len(dataset['observations'])} observações).")

    # Exportar para samples no processing e data no frontend
    repo_root = os.path.dirname(parent_dir)
    samples_dir = os.path.join(parent_dir, "data", "samples")
    frontend_data_dir = os.path.join(repo_root, "frontend", "public", "data")

    os.makedirs(samples_dir, exist_ok=True)
    os.makedirs(frontend_data_dir, exist_ok=True)

    sample_path = os.path.join(samples_dir, "amazon_central_sample.json")
    frontend_path = os.path.join(frontend_data_dir, "amazon_central_series.json")

    with open(sample_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"[Export] Amostra salva em: {sample_path}")

    with open(frontend_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"[Export] Dataset exportado para frontend: {frontend_path}")

    # Exportar placeholder internacional
    intl_dataset = generate_international_placeholder_dataset()
    intl_frontend_path = os.path.join(frontend_data_dir, "international_candidate_series.json")
    with open(intl_frontend_path, "w", encoding="utf-8") as f:
        json.dump(intl_dataset, f, indent=2, ensure_ascii=False)
    print(f"[Export] Placeholder internacional exportado para: {intl_frontend_path}")

    print("[SONATLAS Pipeline] Concluído com sucesso.")


if __name__ == "__main__":
    main()
