# Contrato de grade espacial para o mapa

## Estado dos dados

Até 14/11/2026, `frontend/public/data/` contém séries de indicadores agregados, mas não contém manifesto nem matriz de precipitação por célula. O mapa, portanto, mantém os tiles e a geometria existentes e informa que a camada temática está indisponível. Nenhuma grade é sintetizada a partir da média, do gráfico ou das cores do mapa.

## Arquivos esperados

Para um dataset em `/data/amazon/observations.json`, publicar:

- `/data/amazon/spatial/manifest.json`
- as matrizes JSON apontadas pelo manifesto, por exemplo `matrices/2024-01-01T00-00-00Z.json`

O Congo usa o mesmo formato em `/data/congo/spatial/`. Cada entrada do manifesto associa o timestamp UTC exato da observação a uma matriz.

```json
{
  "schema_version": "1.0.0",
  "region_id": "amazon_central",
  "units": "mm/h",
  "data_source": "NASA Earthdata GES DISC",
  "product_name": "GPM_3IMERGHHE",
  "product_version": "07B",
  "validation_status": "preliminary_verified",
  "spatial_resolution_degrees": 0.1,
  "bounding_box": {
    "min_latitude": -4.0,
    "max_latitude": -1.5,
    "min_longitude": -61.5,
    "max_longitude": -58.5
  },
  "latitude_centers": [-3.95, -3.85],
  "longitude_centers": [-61.45, -61.35],
  "timestamps": [{
    "timestamp_utc": "2024-01-01T00:00:00Z",
    "matrix_path": "matrices/2024-01-01T00-00-00Z.json"
  }]
}
```

```json
{
  "timestamp_utc": "2024-01-01T00:00:00Z",
  "values": [[0.0, 0.12], [null, 1.4]]
}
```

## Orientação e validação

- Eixos são centros de célula em graus WGS84: latitude crescente de sul para norte e longitude crescente de oeste para leste.
- `values[latitude_index][longitude_index]` deve corresponder a esses eixos. A primeira linha é a faixa mais ao sul.
- Célula sem valor válido é `null`; sentinelas, valores negativos, `NaN` e infinitos não são aceitos. Zero é uma medição válida.
- O timestamp da matriz deve ser idêntico ao timestamp pedido. Região, bounding box, dimensões, monotonicidade dos eixos e unidade são validados antes do desenho.
- Os centros definem o interior das células; as bordas externas são limitadas pela bounding box, e as bordas internas ficam no ponto médio entre centros adjacentes.
- Não incluir células agregadas nem preencher ausências com zero.

## Geração e validação

Use `processing/scripts/generate_spatial_export.py`. O comando sem argumentos valida as séries e os granules locais sem escrever JSON; `--publish` publica somente depois de validar as duas regiões. Ele combina os timestamps únicos de `amazon/observations.json`, `amazon/observations_afternoon.json` e `amazon/observations_day_windows.json`. A janela vazia entre 02:30 e 17:00 UTC permanece sem grade. O Congo é exportado separadamente em `data/congo/spatial/` com status `candidate_under_review`.

```powershell
python -m pip install -r processing/requirements.txt
python processing/scripts/download_sequence.py
python processing/scripts/download_afternoon_granules.py
python processing/scripts/generate_spatial_export.py
python processing/scripts/generate_spatial_export.py --publish
```

Os scripts de download usam autenticação NASA Earthdata configurada localmente em `_netrc`/`.netrc`; não coloque credenciais no repositório. Os granules IMERG são globais, portanto os seis arquivos da janela vespertina atendem tanto à Amazônia quanto à janela de Kisangani. O exportador confere os timestamps contra os JSONs publicados e interrompe sem publicar se houver arquivo faltante, adicional ou inconsistente. Nenhum desses comandos substitui observações ausentes.

O exportador valida a variável HDF5, atributos `units` e `_FillValue`, dimensões, 750 células, limites derivados dos GeoJSONs, orientação e resolução dos eixos, valores finitos e contagens. Os centros de latitude/longitude são armazenados pelo IMERG em float32; o exportador confere o erro de representação e normaliza somente as coordenadas à grade nominal de 0,01°, sem alterar os valores de precipitação. Recalcula disponibilidade, média com pesos `cos(latitude)` e fração de chuva com o limiar publicado, registrando a divergência sem editar indicadores. Mantém a precisão original da precipitação; zero continua zero e valores inválidos viram `null`. Matrizes novas são gravadas atomicamente antes do manifesto; nomes incluem timestamp e hash do conteúdo. Matrizes antigas não referenciadas podem permanecer como arquivos órfãos e não são carregadas pelo frontend.

Não use `processing/scripts/generate_heatmap.py` para alimentar `SpatialDataService`: esse script exporta o GeoJSON legado com `precip_timeline`. O protótipo local `generate_spatial_grid.py` foi preservado; o gerador documentado para reprodução é `generate_spatial_export.py`.

## Legenda

A unidade visual é taxa instantânea (`mm/h`). Zero usa cinza claro, valores positivos usam faixas visuais fixas `>0–<0.5`, `0.5–<1`, `1–<2.5`, `2.5–<5` e `≥5 mm/h`, e `null` usa hachura. Essas faixas são apenas quantização da escala cartográfica, não classes científicas. O limiar sonoro de `0.1 mm/h` não é um limite de detecção nem uma fronteira de cor; valores positivos abaixo dele permanecem positivos.

O tile cartográfico permanece visível sob as células. A legenda textual e o estado de carregamento/indisponibilidade ficam fora da região Leaflet marcada como decorativa para leitores de tela.

Quando a grade está disponível, a interface oferece também uma tabela expansível com coordenadas, timestamp UTC e cada valor (incluindo zero e “Sem dado”) como alternativa textual ao mapa.
