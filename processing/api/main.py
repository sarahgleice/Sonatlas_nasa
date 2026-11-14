"""API geoespacial do SONATLAS: serve as regiões de estudo."""
import json
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from shapely.geometry import Point, shape

GEOMETRY_DIR = Path(__file__).resolve().parent.parent / "geometry"

# Status que o time trata como "região ativa" (limites e dados aprovados).
# Qualquer outro status (ex.: proposed_pending_validation) é "candidata".
ACTIVE_STATUSES = {"verified", "preliminary_verified"}

app = FastAPI(title="SONATLAS Geo API", version="0.2.0")

# CORS aberto só para desenvolvimento. Em produção, liste a origem do front.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def calcular_disponibilidade(props: dict) -> str:
    ativa = props.get("status") in ACTIVE_STATUSES and not props.get("is_placeholder", False)
    return "active" if ativa else "candidate"


def carregar_regioes() -> dict:
    """Lê todos os .geojson da pasta geometry e guarda por region_id."""
    regioes = {}
    for caminho in sorted(GEOMETRY_DIR.rglob("*.geojson")):
        try:
            dados = json.loads(caminho.read_text(encoding="utf-8"))
        except json.JSONDecodeError as erro:
            raise RuntimeError(f"GeoJSON inválido ou vazio: {caminho}") from erro

        for feature in dados.get("features", []):
            props = feature.get("properties", {})
            region_id = props.get("region_id")
            if not region_id:
                continue
            if region_id in regioes:
                raise RuntimeError(f"region_id duplicado: {region_id} ({caminho.name})")

            geom = feature.get("geometry")
            forma = shape(geom) if geom else None
            if forma is not None and not forma.is_valid:
                raise RuntimeError(f"Geometria inválida em {caminho.name} ({region_id})")

            regioes[region_id] = {
                "feature": feature,
                "forma": forma,
                "arquivo": caminho.name,
                "availability": calcular_disponibilidade(props),
            }
    return regioes


REGIOES = carregar_regioes()


def no_escopo(regiao: dict, scope: str) -> bool:
    return scope == "all" or regiao["availability"] == scope


def resumo(region_id: str, regiao: dict) -> dict:
    props = regiao["feature"].get("properties", {})
    forma = regiao["forma"]
    saida = {
        "region_id": region_id,
        "region_name": props.get("region_name"),
        "country": props.get("country"),
        "status": props.get("status"),
        "availability": regiao["availability"],
        "is_active": regiao["availability"] == "active",
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


@app.get("/")
def raiz():
    return {"servico": "SONATLAS Geo API", "documentacao": "/docs"}


@app.get("/health")
def health():
    ativas = sum(1 for r in REGIOES.values() if r["availability"] == "active")
    return {
        "status": "ok",
        "regioes_carregadas": len(REGIOES),
        "regioes_ativas": ativas,
    }


@app.get("/regions")
def listar_regioes(
    scope: Literal["active", "candidate", "all"] = Query(
        "active", description="active (padrão), candidate ou all"
    ),
):
    """Lista as regiões. Por padrão, só as ativas."""
    return [resumo(rid, r) for rid, r in REGIOES.items() if no_escopo(r, scope)]


@app.get("/regions/{region_id}")
def obter_regiao(region_id: str, include_candidates: bool = False):
    """Devolve a região em GeoJSON (Feature). Candidatas exigem include_candidates=true."""
    regiao = REGIOES.get(region_id)
    if regiao is None:
        raise HTTPException(status_code=404, detail="Região não encontrada")
    if regiao["availability"] != "active" and not include_candidates:
        raise HTTPException(
            status_code=404,
            detail="Região candidata, ainda não disponível. Use include_candidates=true para consultá-la.",
        )
    if regiao["forma"] is None:
        raise HTTPException(
            status_code=409, detail="Região ainda sem geometria (em validação científica)"
        )
    feature = json.loads(json.dumps(regiao["feature"]))  # cópia, para não alterar o original
    feature["properties"]["availability"] = regiao["availability"]
    return feature


@app.post("/locate")
def localizar(c: Coordenada, include_candidates: bool = False):
    """Diz em qual região de estudo um ponto (lat, lon) cai. Por padrão, só as ativas."""
    ponto = Point(c.lon, c.lat)  # atenção: lon primeiro, lat depois
    dentro = [
        rid
        for rid, r in REGIOES.items()
        if r["forma"] is not None
        and (include_candidates or r["availability"] == "active")
        and r["forma"].covers(ponto)
    ]
    return {
        "lat": c.lat,
        "lon": c.lon,
        "regioes": dentro,
        "dentro_de_alguma": bool(dentro),
        "inclui_candidatas": include_candidates,
    }