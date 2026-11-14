"""
Download e validação dos 6 grânulos globais NASA GPM IMERG Early V07B
para a janela vespertina de 01/01/2024 (17:00 às 19:30 UTC).
"""

import os
import sys
import netrc
import requests
import h5py

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROCESSING_DIR = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(PROCESSING_DIR, "data", "raw")
os.makedirs(RAW_DIR, exist_ok=True)

BASE_URL = "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHHE.07/2024/001"

GRANULES = [
    "3B-HHR-E.MS.MRG.3IMERG.20240101-S170000-E172959.1020.V07B.HDF5",
    "3B-HHR-E.MS.MRG.3IMERG.20240101-S173000-E175959.1050.V07B.HDF5",
    "3B-HHR-E.MS.MRG.3IMERG.20240101-S180000-E182959.1080.V07B.HDF5",
    "3B-HHR-E.MS.MRG.3IMERG.20240101-S183000-E185959.1110.V07B.HDF5",
    "3B-HHR-E.MS.MRG.3IMERG.20240101-S190000-E192959.1140.V07B.HDF5",
    "3B-HHR-E.MS.MRG.3IMERG.20240101-S193000-E195959.1170.V07B.HDF5"
]

def download_and_verify():
    netrc_path = os.path.expanduser("~/_netrc")
    if not os.path.exists(netrc_path):
        netrc_path = os.path.expanduser("~/.netrc")
    if not os.path.exists(netrc_path):
        raise FileNotFoundError("Arquivo de autenticação .netrc / _netrc não encontrado.")

    secrets = netrc.netrc(netrc_path)
    auth = secrets.authenticators("urs.earthdata.nasa.gov")
    if not auth:
        raise ValueError("Credenciais para urs.earthdata.nasa.gov não encontradas no _netrc.")

    session = requests.Session()
    session.auth = (auth[0], auth[2])

    print("=== Iniciando Download e Validação dos Grânulos Vespertinos ===")
    print(f"Destino: {RAW_DIR}")

    for idx, fname in enumerate(GRANULES, start=1):
        target_path = os.path.join(RAW_DIR, fname)
        url = f"{BASE_URL}/{fname}"

        # 1. Verificar HEAD primeiro para saber o tamanho esperado
        head_resp = session.head(url, allow_redirects=True)
        if head_resp.status_code != 200:
            raise RuntimeError(f"Falha ao acessar {url}: status {head_resp.status_code}")

        expected_size = int(head_resp.headers.get("Content-Length", 0))

        if os.path.exists(target_path) and os.path.getsize(target_path) == expected_size:
            print(f"[{idx}/6] Já existe e tamanho confere ({expected_size} bytes): {fname}")
        else:
            print(f"[{idx}/6] Baixando {fname} ({expected_size} bytes)...")
            with session.get(url, stream=True, allow_redirects=True) as r:
                r.raise_for_status()
                with open(target_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=128 * 1024):
                        if chunk:
                            f.write(chunk)
            print(f"      Concluído: {os.path.getsize(target_path)} bytes gravados.")

        # 2. Validação HDF5
        with h5py.File(target_path, "r") as h5:
            if "Grid" not in h5:
                raise ValueError(f"Arquivo corrompido: grupo /Grid não encontrado em {fname}")
            grid = h5["Grid"]
            if "precipitation" not in grid:
                raise ValueError(f"Variável /Grid/precipitation não encontrada em {fname}")
            precip = grid["precipitation"]
            shape = precip.shape
            units = precip.attrs.get("units")
            if hasattr(units, "decode"):
                units = units.decode("utf-8")
            import numpy as np
            raw_fill = precip.attrs.get("_FillValue")
            fill_val = float(np.squeeze(raw_fill)) if raw_fill is not None else -9999.9
            print(f"      Validado HDF5: shape={shape}, units='{units}', _FillValue={fill_val}")

    print("\n=== Todos os 6 grânulos vespertinos baixados e validados com sucesso! ===")

if __name__ == "__main__":
    download_and_verify()
