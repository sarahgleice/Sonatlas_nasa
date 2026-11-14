#!/usr/bin/env python3
"""
SONATLAS — Script de Inspeção e Validação de Dados NASA GPM IMERG V07B.

Objetivo:
    Testar e validar a abertura de arquivos IMERG (HDF5 / NetCDF4), inspecionar dimensões,
    identificar a variável de precipitação (Grid/precipitation ou Grid/precipitationCal),
    verificar atributos físicos (unidades, fill values), extrair coordenadas e timestamps.

Uso:
    python inspect_imerg.py [caminho_para_arquivo.HDF5]
    python inspect_imerg.py --demo (cria e inspeciona um grânulo sintético compatível para validação)

Fontes Oficiais:
    - NASA GPM IMERG: https://gpm.nasa.gov/data/imerg
    - NASA GES DISC: https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHH.07/
"""

import os
import sys
import argparse
from typing import Optional, Dict, Any

try:
    import numpy as np
except ImportError:
    print("[ERRO] NumPy não está instalado. Execute: pip install numpy")
    sys.exit(1)


def inspect_with_h5py(filepath: str) -> Dict[str, Any]:
    """
    Inspeciona arquivo IMERG no formato nativo HDF5 utilizando h5py.
    """
    import h5py

    print(f"\n{'='*70}")
    print(f" [INSPEÇÃO HDF5] Abrindo: {os.path.basename(filepath)}")
    print(f"{'='*70}")

    info: Dict[str, Any] = {}

    with h5py.File(filepath, "r") as h5:
        # 1. Estrutura de Grupos
        groups = list(h5.keys())
        print(f"-> Grupos na raiz do HDF5: {groups}")

        grid_group = h5.get("Grid")
        if grid_group is None:
            raise ValueError("Grupo obrigatório '/Grid' não encontrado no arquivo HDF5 IMERG.")

        grid_vars = list(grid_group.keys())
        print(f"-> Variáveis encontradas em '/Grid': {grid_vars}")

        # 2. Identificação da variável de precipitação
        target_var_name = None
        for candidate in ["precipitationCal", "precipitation", "precipitationUncal"]:
            if candidate in grid_vars:
                target_var_name = candidate
                break

        if not target_var_name:
            raise ValueError("Nenhuma variável de precipitação reconhecida encontrada em '/Grid'.")

        precip_ds = grid_group[target_var_name]
        print(f"\n[VARIÁVEL DE PRECIPITAÇÃO]")
        print(f"  Nome: /Grid/{target_var_name}")
        print(f"  Tipo de dado: {precip_ds.dtype}")
        print(f"  Dimensões (shape): {precip_ds.shape}")

        # Atributos da variável
        units = precip_ds.attrs.get("units", "Não especificado")
        if isinstance(units, bytes):
            units = units.decode("utf-8")
        fill_value = precip_ds.attrs.get("_FillValue", None)
        long_name = precip_ds.attrs.get("long_name", target_var_name)
        if isinstance(long_name, bytes):
            long_name = long_name.decode("utf-8")

        print(f"  Unidade física: {units}")
        print(f"  Valor sentinela (_FillValue): {fill_value}")
        print(f"  Descrição (long_name): {long_name}")

        # 3. Coordenadas
        has_lon = "lon" in grid_group
        has_lat = "lat" in grid_group
        has_time = "time" in grid_group

        lons = grid_group["lon"][:] if has_lon else None
        lats = grid_group["lat"][:] if has_lat else None
        times = grid_group["time"][:] if has_time else None

        print(f"\n[SISTEMA DE COORDENADAS]")
        if lons is not None:
            print(f"  Longitude: shape={lons.shape}, min={lons.min():.2f}°, max={lons.max():.2f}°, amostra={lons[:3]}...")
        if lats is not None:
            print(f"  Latitude:  shape={lats.shape}, min={lats.min():.2f}°, max={lats.max():.2f}°, amostra={lats[:3]}...")
        if times is not None:
            print(f"  Timestamp (/Grid/time): {times}")

        # 4. Metadados Globais e Timestamps
        file_header = h5.attrs.get("FileHeader", None)
        if file_header:
            if isinstance(file_header, bytes):
                file_header = file_header.decode("utf-8", errors="ignore")
            print(f"\n[METADADOS GLOBAIS - FileHeader]")
            # Exibir primeiras linhas relevantes
            for line in str(file_header).split(";")[:6]:
                if any(k in line for k in ["StartGranuleDateTime", "StopGranuleDateTime", "ProductVersion", "AlgorithmID"]):
                    print(f"  {line.strip()}")

        # 5. Amostragem de Valores Numéricos
        data_matrix = precip_ds[:]
        total_cells = data_matrix.size
        
        # Filtro de dados válidos vs ausentes (fill value)
        sentinel = fill_value if fill_value is not None else -9999.0
        valid_mask = (~np.isnan(data_matrix)) & (data_matrix > sentinel)
        valid_count = int(np.sum(valid_mask))
        missing_count = total_cells - valid_count

        print(f"\n[ESTATÍSTICAS DO CONJUNTO DE DADOS]")
        print(f"  Total de células globais: {total_cells:,}")
        print(f"  Células válidas: {valid_count:,} ({valid_count / total_cells * 100:.1f}%)")
        print(f"  Células ausentes / sentinela: {missing_count:,} ({missing_count / total_cells * 100:.1f}%)")

        if valid_count > 0:
            valid_values = data_matrix[valid_mask]
            min_val = float(np.min(valid_values))
            max_val = float(np.max(valid_values))
            mean_val = float(np.mean(valid_values))
            print(f"  Taxa mínima mensurada: {min_val:.2f} {units}")
            print(f"  Taxa máxima mensurada: {max_val:.2f} {units}")
            print(f"  Taxa média (global simples): {mean_val:.2f} {units}")
            
            # Verificar amostragem não-nula
            positive_rain = valid_values[valid_values >= 0.1]
            print(f"  Células com chuva >= 0.1 {units}: {len(positive_rain):,} ({len(positive_rain) / valid_count * 100:.2f}%)")

        # 6. Verificação de Orientação de Dimensões
        # Nota científica: no HDF5 do IMERG, a matriz é frequentemente indexada como (lon, lat) = (3600, 1800)
        # Para convenção GIS/Cartográfica (lat, lon), é necessária a transposição (.T).
        print(f"\n[DIRETRIZ DE TRANSPOSIÇÃO GEOESPACIAL]")
        if precip_ds.shape == (3600, 1800):
            print("  -> Matriz bruta no formato IMERG padrão (lon: 3600, lat: 1800).")
            print("  -> AVISO TÉCNICO: Aplique a transposição (.T) para obter a matriz (lat: 1800, lon: 3600) compatível com GIS e Leaflet.")
        elif precip_ds.shape == (1800, 3600):
            print("  -> Matriz já indexada no formato convencional (lat: 1800, lon: 3600).")

    print(f"\n{'='*70}")
    print(" [SUCESSO] Inspeção concluída. Estrutura e variáveis validadas.")
    print(f"{'='*70}\n")
    return info


def create_mock_hdf5(filepath: str):
    """
    Cria um grânulo sintético que emula perfeitamente a hierarquia interna
    de grupos, variáveis e metadados do NASA GPM IMERG V07B Half-Hourly HDF5.
    Útil para testes unitários em ambientes de desenvolvimento sem acesso à internet.
    """
    import h5py

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    print(f"[GERAÇÃO DE TESTE] Criando grânulo simulado com schema oficial IMERG V07 em: {filepath}")

    with h5py.File(filepath, "w") as h5:
        # Metadados globais compatíveis com a especificação da NASA
        file_header = (
            "AlgorithmID=3IMERGHH; "
            "AlgorithmVersion=07B; "
            "ProductVersion=07B; "
            "StartGranuleDateTime=2026-10-12T13:00:00.000Z; "
            "StopGranuleDateTime=2026-10-12T13:29:59.999Z; "
            "GranuleDayOfYear=285; "
        )
        h5.attrs["FileHeader"] = file_header

        # Grupo /Grid
        grid = h5.create_group("Grid")

        # Coordenadas oficiais: resolução 0.1 grau
        lons = np.linspace(-179.95, 179.95, 360, dtype=np.float32)  # 360 para teste rápido (1 grau)
        lats = np.linspace(-89.95, 89.95, 180, dtype=np.float32)    # 180 para teste rápido (1 grau)

        ds_lon = grid.create_dataset("lon", data=lons)
        ds_lon.attrs["units"] = "degrees_east"
        ds_lon.attrs["long_name"] = "Longitude at the center of grid cell"

        ds_lat = grid.create_dataset("lat", data=lats)
        ds_lat.attrs["units"] = "degrees_north"
        ds_lat.attrs["long_name"] = "Latitude at the center of grid cell"

        ds_time = grid.create_dataset("time", data=np.array([1791810000], dtype=np.int64))
        ds_time.attrs["units"] = "seconds since 1970-01-01 00:00:00 UTC"

        # Variável oficial de precipitação calibrada: Grid/precipitationCal
        # Formato nativo: (lon, lat)
        precip_data = np.full((360, 180), -9999.9, dtype=np.float32)

        # Preencher setor correspondente à Amazônia (-61.5 a -58.5 lon, -4.0 a -1.5 lat) com valores realistas
        lon_indices = np.where((lons >= -62.0) & (lons <= -58.0))[0]
        lat_indices = np.where((lats >= -4.5) & (lats <= -1.0))[0]

        for i in lon_indices:
            for j in lat_indices:
                precip_data[i, j] = np.random.uniform(1.5, 18.5)

        # Alguns pontos no oceano com chuva zero
        precip_data[:50, :50] = 0.0

        ds_precip = grid.create_dataset(
            "precipitationCal",
            data=precip_data,
            fillvalue=-9999.9
        )
        ds_precip.attrs["units"] = "mm/hr"
        ds_precip.attrs["_FillValue"] = -9999.9
        ds_precip.attrs["long_name"] = "Multi-satellite precipitation estimate with gauge calibration"

        # Variável secundária para compatibilidade com outros formatos
        ds_precip_alias = grid.create_dataset(
            "precipitation",
            data=precip_data,
            fillvalue=-9999.9
        )
        ds_precip_alias.attrs["units"] = "mm/hr"
        ds_precip_alias.attrs["_FillValue"] = -9999.9
        ds_precip_alias.attrs["long_name"] = "Precipitation rate alias"

    print("[GERAÇÃO DE TESTE] Grânulo de teste criado com sucesso.")


def find_imerg_files(raw_dir: str) -> list:
    """Busca arquivos IMERG na pasta raw."""
    valid_exts = (".hdf5", ".h5", ".nc4", ".nc")
    found = []
    if os.path.exists(raw_dir):
        for f in os.listdir(raw_dir):
            if f.lower().endswith(valid_exts):
                found.append(os.path.join(raw_dir, f))
    return found


def main():
    parser = argparse.ArgumentParser(description="Inspeção de dados de satélite NASA GPM IMERG V07")
    parser.add_argument("file", nargs="?", help="Caminho para arquivo IMERG HDF5/NetCDF4")
    parser.add_argument("--demo", action="store_true", help="Gera um arquivo HDF5 demonstrativo com schema oficial e o inspeciona")
    args = parser.parse_args()

    current_dir = os.path.dirname(os.path.abspath(__file__))
    processing_dir = os.path.dirname(current_dir)
    raw_dir = os.path.join(processing_dir, "data", "raw")

    target_file = args.file

    if args.demo:
        demo_file = os.path.join(raw_dir, "mock_imerg_v07b_sample.h5")
        create_mock_hdf5(demo_file)
        target_file = demo_file

    if not target_file:
        files = find_imerg_files(raw_dir)
        if files:
            target_file = files[0]
            print(f"[INFO] Nenhum arquivo especificado. Utilizando grânulo encontrado: {target_file}")
        else:
            print("\n" + "="*70)
            print(" [AVISO] Nenhum arquivo IMERG encontrado na pasta 'processing/data/raw/'.")
            print("="*70)
            print("\nPara executar este teste técnico com um arquivo real:")
            print("1. Crie uma conta no NASA Earthdata: https://urs.earthdata.nasa.gov/")
            print("2. Autorize a aplicação 'NASA GESDISC DATA ARCHIVE' nas suas configurações.")
            print("3. Baixe um grânulo IMERG V07B Half-Hourly (.HDF5 ou .nc4) em:")
            print("   https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHH.07/")
            print(f"4. Salve o arquivo em: {raw_dir}")
            print("5. Execute novamente:")
            print(f"   python {os.path.basename(__file__)} caminho/do/arquivo.HDF5")
            print("\nPara rodar uma validação imediata com grânulo simulado no schema exato da NASA:")
            print(f"   python {os.path.basename(__file__)} --demo\n")
            sys.exit(0)

    try:
        inspect_with_h5py(target_file)
    except Exception as e:
        print(f"[ERRO] Falha ao inspecionar o arquivo '{target_file}': {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
