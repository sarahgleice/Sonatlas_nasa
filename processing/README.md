# Módulo de Processamento de Dados Científicos — SONATLAS

Este módulo é responsável pela pesquisa, validação, extração e tratamento dos dados de satélite da missão **NASA GPM (Global Precipitation Measurement)**, especificamente o algoritmo **IMERG (Integrated Multi-satellitE Retrievals for GPM)**, versão **07B**.

---

## 1. Fontes Oficiais da NASA

- **NASA SVS 4285:** [https://svs.gsfc.nasa.gov/4285/](https://svs.gsfc.nasa.gov/4285/)  
  *Nota metodológica:* A visualização do Scientific Visualization Studio (SVS) é uma referência visual e de divulgação. Os indicadores científicos do SONATLAS são extraídos diretamente das matrizes numéricas do IMERG e **nunca estimados visualmente a partir das cores da animação**.
- **NASA GPM IMERG:** [https://gpm.nasa.gov/data/imerg](https://gpm.nasa.gov/data/imerg)
- **NASA GPM Data Directory:** [https://gpm.nasa.gov/data/directory](https://gpm.nasa.gov/data/directory)
- **NASA GES DISC (Distribuição Oficial):** [https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHH.07/](https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHH.07/)

---

## 2. Investigação Técnica da Variável e Formato

### 2.1. Variável de Precipitação: `/Grid/precipitationCal` vs `/Grid/precipitation`
Na versão **IMERG V07B** (Half-Hourly L3 - produtos `GPM_3IMERGHHE`, `GPM_3IMERGHHL` e `GPM_3IMERGHH`):
- O arquivo é estruturado no formato hierárquico **HDF5** sob o grupo raiz `/Grid`.
- **Variável Principal de Pesquisa:** `/Grid/precipitationCal`  
  Trata-se da taxa de precipitação multissatélite calibrada por pluviômetros de superfície (quando no produto Final) e sensores de micro-ondas combinados.
- **Unidade de Medida:** **`mm/hr`** (milímetros por hora — taxa instantânea).
- **Variável Secundária / Alias:** `/Grid/precipitation` é utilizada em alguns produtos derivados diários (em mm/day) ou em subsetters de NetCDF/GIS. Nossos leitores dão prioridade a `/Grid/precipitationCal`, com fallback para `/Grid/precipitation`, sempre validando o atributo `units == "mm/hr"`.

### 2.2. Sistema de Coordenadas e Transposição Espacial
- **Resolução Espacial:** Grade regular global de $0.1^\circ \times 0.1^\circ$.
- **Latitude (`lat`):** 1800 pontos, de $-89.95^\circ$ a $+89.95^\circ$.
- **Longitude (`lon`):** 3600 pontos, de $-179.95^\circ$ a $+179.95^\circ$.
- :warning: **Peculiaridade Crítica do HDF5 da NASA:**  
  A matriz bruta armazenada no HDF5 está ordenada como `(lon, lat)` com dimensões `(3600, 1800)`. Para compatibilidade com bibliotecas geoespaciais, arrays cartográficos convencionais (como Leaflet e GeoTIFF), é **obrigatória a aplicação da transposição matricial (`.T`)** para obter as dimensões `(lat, lon)` = `(1800, 3600)`.

### 2.3. Tratamento Rigoroso de Dados Ausentes (*Missing Data*)
- **Valor Sentinela (`_FillValue`):** `-9999.9` (ou `-9999.0`).
- **Regra Científica:** Células ausentes ou sob controle de qualidade deficiente **NUNCA são tratadas como precipitação zero**.
- Células com chuva zero possuem o valor numérico exato `0.0 mm/hr`. Valores negativos inferiores a zero ou iguais a `-9999.9` são convertidos em `NaN` / `null` e contabilizados separadamente na taxa de disponibilidade do grânulo.

---

## 3. Estrutura de Pastas do Módulo

```text
processing/
├── data/
│   ├── raw/                  # Grânulos brutos HDF5 / NetCDF baixados da NASA (ignorados no git)
│   ├── processed/            # Séries temporais intermediárias processadas
│   └── samples/              # Amostras técnicas JSON estruturadas conforme data-dictionary.md
│
├── extraction/               # Módulos de conexão e recorte espacial de grânulos
│   ├── __init__.py
│   └── gpm_extractor.py
│
├── geometry/                 # Geometrias GeoJSON oficiais das áreas de estudo
│   ├── amazon/               # Amazônia Central (Brasil) — delimitada e verificada
│   │   ├── central_amazon_bbox.geojson
│   │   └── README.md
│   └── international/        # Bacia do Congo — área candidata sob validação técnica
│       ├── candidate_orientation_placeholder.geojson
│       └── README.md
│
├── indicators/               # Algoritmos de cálculo de indicadores físicos
│   ├── __init__.py
│   └── precipitation_indicators.py
│
├── scripts/                  # Scripts executáveis de inspeção e pipeline
│   ├── __init__.py
│   ├── inspect_imerg.py      # Script de inspeção de arquivos IMERG (Etapa 1)
│   └── run_pipeline.py       # Orquestrador de geração e exportação de datasets
│
├── tests/                    # Suíte de testes automatizados com Pytest
│   ├── __init__.py
│   ├── test_indicators.py
│   └── test_validation.py
│
├── validation/               # Validador de conformidade e integridade científica
│   ├── __init__.py
│   └── data_validator.py
│
├── requirements.txt          # Dependências Python estritamente avaliadas
└── README.md                 # Esta documentação técnica
```

---

## 4. Como Configurar o Ambiente Python

### Passo 4.1: Criar e ativar o ambiente virtual
```bash
# Na pasta processing/:
python -m venv venv

# No Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# No Linux/macOS:
source venv/bin/activate
```

### Passo 4.2: Instalar as dependências selecionadas
```bash
pip install -r requirements.txt
```

### Bibliotecas Utilizadas e Justificativa:
| Biblioteca | Finalidade Técnica |
|---|---|
| **`h5py`** | Abertura direta e leitura de grupos e datasets hierárquicos em arquivos HDF5 nativos da NASA sem sobrecarga de memória. |
| **`netCDF4`** | Suporte à leitura de grânulos disponibilizados em formato NetCDF-4 (`.nc4`) e acesso a serviços OPeNDAP. |
| **`xarray`** | Manipulação de conjuntos de dados multidimensionais com coordenadas nomeadas (`lat`, `lon`, `time`). |
| **`numpy`** | Operações matriciais vetorizadas de alto desempenho, máscaras booleanas e cálculo de transposição. |
| **`pandas`** | Estruturação de séries temporais de indicadores e exportação tabular. |
| **`shapely`** | Geometria vetorial leve para leitura e validação dos polígonos GeoJSON das *bounding boxes*. |
| **`pydantic`** | Validação estrita de contratos de dados antes da exportação JSON. |
| **`requests`** | Download autenticado de grânulos via API REST da NASA Earthdata. |
| **`pytest`** | Garantia de qualidade e testes unitários dos algoritmos. |

---

## 5. Como Acessar os Dados Reais da NASA (Autenticação)

Para acessar e baixar dados reais do GPM IMERG no GES DISC, a NASA exige autenticação gratuita via **Earthdata Login**:

1. Crie uma conta no portal [https://urs.earthdata.nasa.gov/](https://urs.earthdata.nasa.gov/).
2. Em **Applications** > **Authorized Apps**, autorize a aplicação:
   - **`NASA GESDISC DATA ARCHIVE`**
3. Configure o arquivo de credenciais `.netrc` na pasta do seu usuário (sem expor suas senhas em arquivos de código):
   - No Linux/macOS: `~/.netrc` (permissão `chmod 600 ~/.netrc`)
   - No Windows: `%USERPROFILE%\_netrc`
   ```text
   machine urs.earthdata.nasa.gov
   login SEU_USUARIO_EARTHDATA
   password SUA_SENHA_EARTHDATA
   ```
4. Baixe os arquivos desejados e salve-os em `processing/data/raw/`.

---

## 6. Como Executar o Teste Técnico de Inspeção

Para inspecionar um arquivo real baixado:
```bash
python scripts/inspect_imerg.py data/raw/3B-HHR.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5
```

Para validar a esteira imediatamente utilizando o gerador de grânulo sintético compatível com o schema da NASA:
```bash
python scripts/inspect_imerg.py --demo
```

O script exibirá:
- Os grupos do HDF5 (`/Grid`).
- A variável localizada (`/Grid/precipitationCal` ou `/Grid/precipitation`).
- As unidades físicas (`mm/hr`) e atributos (`_FillValue: -9999.9`).
- As dimensões espaciais (3600 x 1800) e a necessidade de transposição `.T`.
- A contagem de células válidas e ausentes.
