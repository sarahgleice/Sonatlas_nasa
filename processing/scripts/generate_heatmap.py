"""
Script dedicado para gerar a grade de precipitação GeoJSON otimizada 
para o mapa dinâmico do Leaflet no frontend.
Baseado nos mesmos grânulos vespertinos da Amazônia Central.
"""

import os
import sys
import json
import numpy as np

# Configuração de caminhos para importar os módulos da equipe
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROCESSING_DIR = os.path.dirname(SCRIPT_DIR)
REPO_ROOT = os.path.dirname(PROCESSING_DIR)

if PROCESSING_DIR not in sys.path:
    sys.path.insert(0, PROCESSING_DIR)

# Reutilizar as funções e lógicas que a equipe já usa
from extraction.gpm_extractor import GPMExtractor
from scripts.process_amazon_afternoon import get_afternoon_granules, load_amazon_geometry

def exportar_geojson_heatmap() -> None:
    print("Iniciando extração do heatmap (Amazônia Vespertina)...")
    
    hdf5_files = get_afternoon_granules()
    bbox = load_amazon_geometry()
    extractor = GPMExtractor()

    # Dicionário para acumular as séries temporais de cada célula ao longo dos arquivos
    cell_series = {}
    
    # 1. Agrupar as grades dos 6 passos de tempo
    for fpath in hdf5_files:
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
        
        for i, lat in enumerate(lats):
            for j, lon in enumerate(lons):
                cell_id = f"{round(float(lat), 4)}_{round(float(lon), 4)}"
                val = float(matrix[i, j])
                
                # Tratar valores inválidos
                if val == -9999.0 or val == -9999.9 or np.isnan(val):
                    clean_val = None
                else:
                    clean_val = round(val, 2)
                
                if cell_id not in cell_series:
                    cell_series[cell_id] = {"lat": float(lat), "lon": float(lon), "timeline": []}
                
                cell_series[cell_id]["timeline"].append(clean_val)

    # 2. Construir o formato GeoJSON final
    features = []
    half_cell = 0.05  # Metade da resolução do IMERG (0.1 graus)
    
    for cell_id, data in cell_series.items():
        lat = data["lat"]
        lon = data["lon"]
        timeline = data["timeline"]
        
        # Omitir se a célula não teve qualquer dado válido em toda a série
        if all(v is None for v in timeline):
            continue
            
        polygon = [[
            [lon - half_cell, lat - half_cell],
            [lon + half_cell, lat - half_cell],
            [lon + half_cell, lat + half_cell],
            [lon - half_cell, lat + half_cell],
            [lon - half_cell, lat - half_cell]
        ]]
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": polygon
            },
            "properties": {
                "id": f"cell_{cell_id}",
                "precip_timeline": timeline
            }
        }
        features.append(feature)

    geojson_output = {
        "type": "FeatureCollection",
        "features": features
    }

    # 3. Salvar diretamente na pasta pública do Frontend
    frontend_dir = os.path.join(REPO_ROOT, "frontend", "public", "data", "amazon")
    os.makedirs(frontend_dir, exist_ok=True)
    out_frontend = os.path.join(frontend_dir, "amazon_heatmap_cells.json")
    
    with open(out_frontend, "w", encoding="utf-8") as f:
        json.dump(geojson_output, f, ensure_ascii=False)
        
    print(f"Heatmap gerado com sucesso!")
    print(f"Total de células ativas: {len(features)}")
    print(f"Arquivo salvo em: {out_frontend}")

if __name__ == "__main__":
    exportar_geojson_heatmap()