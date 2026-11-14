"""API geoespacial do SONATLAS: serve as regiões de estudo."""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from shapely.geometry import Point, shape

GEOMETRY_DIR = Path(__file__).resolve().parent.parent / "geometry"

app = FastAPI(title="SONATLAS Geo API", version="0.1.0")

# Permite que o front (outro endereço) converse com a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def carregar_regioes():
    """Lê todos os .geojson da pasta geometry e guarda por region_id."""
    regioes = {}
    for caminho in sorted(GEOMETRY_DIR.rglob("*.geojson")):
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        for feature in dados.get("features", []):
            region_id = feature.get("properties", {}).get("region_id")
            if not region_id:
                continue
            geom = feature.get("geometry")
            regioes[region_id] = {
                "feature": feature,
                "forma": shape(geom) if geom else None,
                "arquivo": caminho.name,
            }
    return regioes


REGIOES = carregar_regioes()


def resumo(region_id, regiao):
    props = regiao["feature"]["properties"]
    forma = regiao["forma"]
    saida = {
        "region_id": region_id,
        "region_name": props.get("region_name"),
        "country": props.get("country"),
        "status": props.get("status"),
        "is_placeholder": props.get("is_placeholder", False),
        "has_geometry": forma is not None,
        "bbox": None,
        "center": None,
    }
    if forma is not None:
        oeste, sul, leste, norte = forma.bounds
        saida["bbox"] = {"south": sul, "west": oeste, "north": norte, "east": leste}
        centro = forma.centroid
        saida["center"] = {"lat": centro.y, "lon": centro.x}
    return saida


class Coordenada(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


@app.get("/health")
def health():
    return {"status": "ok", "regioes_carregadas": len(REGIOES)}


@app.get("/regions")
def listar_regioes():
    """Lista as regiões (inclui o placeholder, marcado como tal)."""
    return [resumo(rid, r) for rid, r in REGIOES.items()]


@app.get("/regions/{region_id}")
def obter_regiao(region_id: str):
    """Devolve a região completa em GeoJSON."""
    regiao = REGIOES.get(region_id)
    if regiao is None:
        raise HTTPException(status_code=404, detail="Região não encontrada")
    return regiao["feature"]


@app.post("/locate")
def localizar(c: Coordenada):
    """Diz em qual região de estudo um ponto (lat, lon) cai."""
    ponto = Point(c.lon, c.lat)  # atenção: lon primeiro, lat depois
    dentro = [
        rid for rid, r in REGIOES.items()
        if r["forma"] is not None and r["forma"].covers(ponto)
    ]
    return {"lat": c.lat, "lon": c.lon, "regioes": dentro, "dentro_de_alguma": bool(dentro)}