"""Confere a consistência entre os datasets, os GeoJSON e a API das regiões do SONATLAS.
Somente leitura: não altera nenhum arquivo.

Uso, na raiz do projeto:
    python processing/scripts/check_regions.py
"""
import importlib.util
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROCESSING = ROOT / "processing"
sys.path.insert(0, str(PROCESSING))

EPS = 1e-6
PONTOS = {"Manaus": (-3.119, -60.0217), "Kisangani": (0.5153, 25.191)}
PASTAS_DADOS = [
    ROOT / "frontend" / "public" / "data",
    PROCESSING / "data" / "processed",
    PROCESSING / "data" / "samples",
]


def carregar_api():
    from fastapi.testclient import TestClient

    caminho = PROCESSING / "api" / "main.py"
    spec = importlib.util.spec_from_file_location("sonatlas_geo_api", caminho)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return TestClient(modulo.app)


def achar_datasets():
    for pasta in PASTAS_DADOS:
        if not pasta.exists():
            continue
        for caminho in sorted(pasta.rglob("*.json")):
            try:
                dados = json.loads(caminho.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                print(f"[ERRO] JSON inválido ou vazio: {caminho.relative_to(ROOT)}")
                continue
            if isinstance(dados, dict) and "observations" in dados and "region_id" in dados:
                yield caminho, dados


def bbox_do_dataset(ds):
    """Devolve (sul, oeste, norte, leste) ou None."""
    bb = ds.get("bounding_box") or {}
    try:
        return (bb["min_latitude"], bb["min_longitude"], bb["max_latitude"], bb["max_longitude"])
    except KeyError:
        return None


def bbox_da_api(regiao):
    b = regiao.get("bbox")
    if not b:
        return None
    return (b["south"], b["west"], b["north"], b["east"])


def iguais(a, b):
    return a is not None and b is not None and all(abs(x - y) < EPS for x, y in zip(a, b))


def dentro(bbox, lat, lon):
    s, w, n, e = bbox
    return s <= lat <= n and w <= lon <= e


def taxa(obs):
    try:
        return obs["scientific_indicators"]["mean_precipitation_rate"]["value"]
    except (KeyError, TypeError):
        return None


def conferir_observacoes(observacoes, problemas, avisos):
    instantes = []
    for i, obs in enumerate(observacoes):
        bruto = obs.get("timestamp_utc")
        try:
            instantes.append(datetime.fromisoformat(str(bruto).replace("Z", "+00:00")))
        except ValueError:
            problemas.append(f"passo {i}: timestamp_utc inválido ({bruto})")

    if len(instantes) == len(observacoes):
        if any(b <= a for a, b in zip(instantes, instantes[1:])):
            problemas.append("timestamps fora de ordem ou repetidos")
        passos = {round((b - a).total_seconds() / 60) for a, b in zip(instantes, instantes[1:])}
        if passos and passos != {30}:
            avisos.append(f"intervalos entre passos diferentes de 30 min: {sorted(passos)} min")

    valores = [taxa(o) for o in observacoes]
    ausentes = [i for i, v in enumerate(valores) if v is None]
    if ausentes:
        avisos.append(f"passos sem taxa média (dado ausente ou formato diferente): {ausentes}")
    for i, v in enumerate(valores):
        if isinstance(v, (int, float)) and (v < 0 or v > 300):
            problemas.append(f"passo {i}: taxa média fora da faixa plausível ({v} mm/h)")

    primeiro = instantes[0] if instantes else "?"
    ultimo = instantes[-1] if instantes else "?"
    print(f"  {len(observacoes)} observações, de {primeiro} a {ultimo}")
    print(f"  taxas médias (mm/h): {valores}")


def main():
    try:
        client = carregar_api()
    except Exception as erro:
        print(f"[ERRO] Não foi possível carregar a API: {erro}")
        return 1

    regioes = client.get("/regions", params={"scope": "all"}).json()
    print("== Regiões na API (scope=all) ==")
    for r in regioes:
        print(f"  {r['region_id']:<26} {r['availability']:<10} status={r['status']}  bbox(S,W,N,E)={bbox_da_api(r)}")

    print("\n== Pontos de referência (com candidatas) ==")
    for nome, (lat, lon) in PONTOS.items():
        r = client.post(
            "/locate", params={"include_candidates": True}, json={"lat": lat, "lon": lon}
        ).json()
        print(f"  {nome} ({lat}, {lon}) -> {r['regioes']}")

    total_problemas = 0
    encontrou = False
    print("\n== Datasets ==")
    for caminho, ds in achar_datasets():
        encontrou = True
        problemas, avisos = [], []
        print(f"\n{caminho.relative_to(ROOT)}")
        print(
            f"  region_id={ds.get('region_id')}  validation_status={ds.get('validation_status')}  "
            f"is_sample={ds.get('is_sample')}  is_placeholder={ds.get('is_placeholder', False)}"
        )
        print(
            f"  produto={ds.get('product_name')} versão={ds.get('product_version')}  "
            f"fonte={ds.get('data_source')}"
        )

        real = not ds.get("is_placeholder") and bool(ds.get("observations"))
        bb = bbox_do_dataset(ds)
        print(f"  bounding_box do dataset (S,W,N,E) = {bb}")

        if bb is None:
            avisos.append("dataset sem bounding_box completo")
        else:
            casam = [r["region_id"] for r in regioes if iguais(bb, bbox_da_api(r))]
            if casam:
                print(f"  bbox igual ao da API em: {casam}")
                if ds["region_id"] not in casam:
                    avisos.append(f"region_id do dataset ({ds['region_id']}) difere do id na API {casam}")
            elif real:
                problemas.append("bounding_box do dataset não bate com nenhuma região da API")
            else:
                avisos.append("bounding_box do placeholder não bate com nenhuma região da API")
            dentro_de = [nome for nome, (lat, lon) in PONTOS.items() if dentro(bb, lat, lon)]
            print(f"  pontos de referência dentro da caixa do dataset: {dentro_de}")

        if real:
            conferir_observacoes(ds["observations"], problemas, avisos)
            try:
                from validation.data_validator import DataValidator

                valido, erros = DataValidator.validate_dataset(ds)
                if valido:
                    print("  validador do time: OK")
                else:
                    problemas.extend(f"validador do time: {e}" for e in erros)
            except Exception as erro:
                avisos.append(f"validador do time não executou ({erro})")
        else:
            avisos.append("dataset placeholder ou sem observações (sem dados reais)")

        for p in problemas:
            print(f"  [PROBLEMA] {p}")
        for a in avisos:
            print(f"  [AVISO] {a}")
        if not problemas:
            print("  resultado: sem problemas bloqueantes")
        total_problemas += len(problemas)

    if not encontrou:
        print("  nenhum dataset encontrado nas pastas esperadas")
    print(f"\nTotal de problemas: {total_problemas}")
    return 1 if total_problemas else 0


if __name__ == "__main__":
    sys.exit(main())