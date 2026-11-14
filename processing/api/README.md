# SONATLAS Geo API

API geoespacial que serve as regiões de estudo (GeoJSON de `processing/geometry/`).

## Requisitos

- Python 3.10 ou mais novo
- Dependências em `processing/requirements.txt` (principais: `fastapi`, `uvicorn`, `shapely`; para os testes: `pytest`, `httpx2`)

## Como rodar (Windows, Git Bash)

Na raiz do projeto:

```bash
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r processing/requirements.txt
cd processing/api
python -m uvicorn main:app --reload --port 8000
```

Em PowerShell, a ativação é `.\.venv\Scripts\Activate.ps1`. No Linux/macOS, `source .venv/bin/activate`.

A API sobe em `http://localhost:8000`, e a documentação interativa fica em `http://localhost:8000/docs`.
Os GeoJSON são lidos **ao iniciar**: se alterar um arquivo de `processing/geometry/`, reinicie o servidor.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Estado da API e contagem de regiões |
| GET | `/regions` | Lista regiões ativas. `?scope=candidate` ou `?scope=all` inclui as candidatas |
| GET | `/regions/{region_id}` | Região em GeoJSON. Candidatas exigem `?include_candidates=true` |
| POST | `/locate` | Corpo `{"lat": -3.119, "lon": -60.0217}`. Informa em qual região ativa o ponto cai. `?include_candidates=true` inclui candidatas |

## Regiões ativas e candidatas

Uma região é **ativa** quando o `status` do GeoJSON é `verified` ou `preliminary_verified`
e ela não é placeholder. As demais são **candidatas** (em validação científica).
Hoje só a Amazônia Central (`amazon_central`) é ativa. Para ativar outra região,
atualize o `status` no GeoJSON dela e reinicie a API.

## Convenções

- Latitude e longitude em graus decimais (WGS84). No GeoJSON a ordem é **[longitude, latitude]**.
- Latitude entre -90 e 90, longitude entre -180 e 180. Fora disso a API responde 422.
- Os limites são recortes de **amostragem**, não representam a Amazônia ou a Bacia do Congo inteiras.

## Testes

```bash
python -m pytest processing/tests/test_api.py -v
```

## Observações

- O CORS está aberto (`*`) para desenvolvimento. Antes de publicar, restrinja à origem do front.