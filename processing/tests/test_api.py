import importlib.util
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_FILE = Path(__file__).resolve().parent.parent / "api" / "main.py"


def _carregar_app():
    spec = importlib.util.spec_from_file_location("sonatlas_geo_api", API_FILE)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo.app


client = TestClient(_carregar_app())

MANAUS = {"lat": -3.119, "lon": -60.0217}
KISANGANI = {"lat": 0.5153, "lon": 25.191}
ORIGEM = {"lat": 0, "lon": 0}
ATIVAS = {"amazon_central", "congo_basin_kisangani"}


def ids(resposta):
    return {r["region_id"] for r in resposta.json()}


def bbox_de(region_id):
    regiao = next(r for r in client.get("/regions").json() if r["region_id"] == region_id)
    return regiao["bbox"]


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["status"] == "ok"
    assert corpo["regioes_carregadas"] >= 3
    assert corpo["regioes_ativas"] >= 2


def test_regions_padrao_so_ativas():
    r = client.get("/regions")
    assert r.status_code == 200
    assert ATIVAS <= ids(r)
    assert all(item["is_active"] for item in r.json())


def test_regions_candidatas():
    r = client.get("/regions", params={"scope": "candidate"})
    assert r.status_code == 200
    assert "international_candidate" in ids(r)
    assert not (ATIVAS & ids(r))
    assert not any(item["is_active"] for item in r.json())


def test_regions_all_inclui_ativas_e_candidatas():
    r = client.get("/regions", params={"scope": "all"})
    assert ATIVAS | {"international_candidate"} <= ids(r)


def test_regions_scope_invalido():
    assert client.get("/regions", params={"scope": "qualquer"}).status_code == 422


@pytest.mark.parametrize("region_id", sorted(ATIVAS))
def test_regiao_ativa_por_id(region_id):
    r = client.get(f"/regions/{region_id}")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["type"] == "Feature"
    assert corpo["geometry"]["type"] == "Polygon"
    assert corpo["properties"]["availability"] == "active"


def test_candidata_exige_flag():
    # international_candidate é o placeholder: candidata e sem geometria
    assert client.get("/regions/international_candidate").status_code == 404


def test_placeholder_sem_geometria():
    r = client.get("/regions/international_candidate", params={"include_candidates": True})
    assert r.status_code == 409


def test_regiao_inexistente():
    assert client.get("/regions/nao_existe").status_code == 404


def test_locate_manaus():
    r = client.post("/locate", json=MANAUS)
    assert r.status_code == 200
    assert r.json()["regioes"] == ["amazon_central"]


def test_locate_kisangani():
    r = client.post("/locate", json=KISANGANI)
    assert r.status_code == 200
    assert r.json()["regioes"] == ["congo_basin_kisangani"]


def test_locate_fora_de_tudo():
    corpo = client.post("/locate", json=ORIGEM).json()
    assert corpo["regioes"] == []
    assert corpo["dentro_de_alguma"] is False


def test_locate_coordenada_invalida():
    assert client.post("/locate", json={"lat": 91, "lon": 0}).status_code == 422
    assert client.post("/locate", json={"lat": 0, "lon": 181}).status_code == 422


def test_bbox_da_amazonia_igual_ao_do_pipeline():
    bbox = bbox_de("amazon_central")
    assert bbox["south"] == pytest.approx(-4.0)
    assert bbox["north"] == pytest.approx(-1.5)
    assert bbox["west"] == pytest.approx(-61.5)
    assert bbox["east"] == pytest.approx(-58.5)


def test_bbox_do_congo_igual_ao_dataset():
    bbox = bbox_de("congo_basin_kisangani")
    assert bbox["south"] == pytest.approx(-0.8)
    assert bbox["north"] == pytest.approx(1.7)
    assert bbox["west"] == pytest.approx(23.7)
    assert bbox["east"] == pytest.approx(26.7)