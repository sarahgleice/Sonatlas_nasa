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


def ids(resposta):
    return {r["region_id"] for r in resposta.json()}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["status"] == "ok"
    assert corpo["regioes_carregadas"] >= 2
    assert corpo["regioes_ativas"] >= 1


def test_regions_padrao_so_ativas():
    r = client.get("/regions")
    assert r.status_code == 200
    assert ids(r) == {"amazon_central"}
    assert all(item["is_active"] for item in r.json())


def test_regions_candidatas():
    r = client.get("/regions", params={"scope": "candidate"})
    assert r.status_code == 200
    assert "congo_basin_kisangani" in ids(r)
    assert "amazon_central" not in ids(r)
    assert not any(item["is_active"] for item in r.json())


def test_regions_all_inclui_ativas_e_candidatas():
    r = client.get("/regions", params={"scope": "all"})
    assert {"amazon_central", "congo_basin_kisangani"} <= ids(r)


def test_regions_scope_invalido():
    assert client.get("/regions", params={"scope": "qualquer"}).status_code == 422


def test_regiao_ativa_por_id():
    r = client.get("/regions/amazon_central")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["type"] == "Feature"
    assert corpo["geometry"]["type"] == "Polygon"
    assert corpo["properties"]["availability"] == "active"


def test_regiao_candidata_exige_flag():
    assert client.get("/regions/congo_basin_kisangani").status_code == 404
    r = client.get("/regions/congo_basin_kisangani", params={"include_candidates": True})
    assert r.status_code == 200
    assert r.json()["properties"]["availability"] == "candidate"


def test_placeholder_sem_geometria():
    r = client.get("/regions/international_candidate", params={"include_candidates": True})
    assert r.status_code == 409


def test_regiao_inexistente():
    assert client.get("/regions/nao_existe").status_code == 404


def test_locate_manaus():
    r = client.post("/locate", json=MANAUS)
    assert r.status_code == 200
    assert r.json()["regioes"] == ["amazon_central"]


def test_locate_kisangani_so_com_candidatas():
    assert client.post("/locate", json=KISANGANI).json()["regioes"] == []
    r = client.post("/locate", params={"include_candidates": True}, json=KISANGANI)
    assert r.json()["regioes"] == ["congo_basin_kisangani"]


def test_locate_fora_de_tudo():
    corpo = client.post("/locate", json=ORIGEM).json()
    assert corpo["regioes"] == []
    assert corpo["dentro_de_alguma"] is False


def test_locate_coordenada_invalida():
    assert client.post("/locate", json={"lat": 91, "lon": 0}).status_code == 422
    assert client.post("/locate", json={"lat": 0, "lon": 181}).status_code == 422


def test_bbox_da_amazonia_igual_ao_do_pipeline():
    bbox = client.get("/regions").json()[0]["bbox"]
    assert bbox["south"] == pytest.approx(-4.0)
    assert bbox["north"] == pytest.approx(-1.5)
    assert bbox["west"] == pytest.approx(-61.5)
    assert bbox["east"] == pytest.approx(-58.5)