"""Consistência entre datasets reais, GeoJSON (via API) e validador do time."""
import importlib.util
import json
import sys
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
PROCESSING = ROOT / "processing"
sys.path.insert(0, str(PROCESSING))

API_FILE = PROCESSING / "api" / "main.py"
PASTAS_DADOS = [
    ROOT / "frontend" / "public" / "data",
    PROCESSING / "data" / "processed",
]
CIDADES_DE_REFERENCIA = {
    "amazon_central": (-3.119, -60.0217),       # Manaus (lat, lon)
    "congo_basin_kisangani": (0.5153, 25.191),  # Kisangani (lat, lon)
}


def _carregar_app():
    spec = importlib.util.spec_from_file_location("sonatlas_geo_api_consistencia", API_FILE)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo.app


client = TestClient(_carregar_app())
REGIOES_API = {
    r["region_id"]: r for r in client.get("/regions", params={"scope": "all"}).json()
}


def _nome(caminho):
    return str(caminho.relative_to(ROOT)).replace("\\", "/")


def _arquivos_json():
    for pasta in PASTAS_DADOS:
        if pasta.exists():
            yield from sorted(pasta.rglob("*.json"))


def _datasets_reais():
    casos = []
    for caminho in _arquivos_json():
        try:
            dados = json.loads(caminho.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue  # o teste de JSON válido acusa o arquivo
        if (
            isinstance(dados, dict)
            and "region_id" in dados
            and dados.get("observations")
            and not dados.get("is_placeholder")
        ):
            casos.append(pytest.param(dados, id=_nome(caminho)))
    return casos


DATASETS = _datasets_reais()


def _instante(texto):
    return datetime.fromisoformat(str(texto).replace("Z", "+00:00"))


def test_existem_datasets_reais():
    assert DATASETS, "nenhum dataset real encontrado nas pastas esperadas"


@pytest.mark.parametrize(
    "caminho", [pytest.param(c, id=_nome(c)) for c in _arquivos_json()]
)
def test_json_valido(caminho):
    json.loads(caminho.read_text(encoding="utf-8"))


@pytest.mark.parametrize("ds", DATASETS)
def test_regiao_do_dataset_existe_na_api_e_a_caixa_bate(ds):
    regiao = REGIOES_API.get(ds["region_id"])
    assert regiao is not None, f"region_id {ds['region_id']} não existe na API"
    api = regiao["bbox"]
    assert api is not None, "a região da API não tem geometria"
    bb = ds["bounding_box"]
    assert api["south"] == pytest.approx(bb["min_latitude"])
    assert api["north"] == pytest.approx(bb["max_latitude"])
    assert api["west"] == pytest.approx(bb["min_longitude"])
    assert api["east"] == pytest.approx(bb["max_longitude"])


@pytest.mark.parametrize("ds", DATASETS)
def test_cidade_de_referencia_dentro_da_caixa(ds):
    ref = CIDADES_DE_REFERENCIA.get(ds["region_id"])
    if ref is None:
        pytest.skip("sem cidade de referência cadastrada")
    lat, lon = ref
    bb = ds["bounding_box"]
    assert bb["min_latitude"] <= lat <= bb["max_latitude"]
    assert bb["min_longitude"] <= lon <= bb["max_longitude"]


@pytest.mark.parametrize("ds", DATASETS)
def test_timestamps_em_ordem_crescente(ds):
    instantes = [_instante(o["timestamp_utc"]) for o in ds["observations"]]
    assert all(b > a for a, b in zip(instantes, instantes[1:]))


@pytest.mark.parametrize("ds", DATASETS)
def test_taxas_plausiveis(ds):
    for i, obs in enumerate(ds["observations"]):
        valor = obs["scientific_indicators"]["mean_precipitation_rate"]["value"]
        if valor is None:
            continue
        assert 0 <= valor <= 300, f"passo {i}: {valor} mm/h"


@pytest.mark.parametrize("ds", DATASETS)
def test_validador_do_time(ds):
    from validation.data_validator import DataValidator

    valido, erros = DataValidator.validate_dataset(ds)
    assert valido, erros