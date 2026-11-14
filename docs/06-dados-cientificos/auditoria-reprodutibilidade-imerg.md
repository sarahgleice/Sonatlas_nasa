# Relatório de Auditoria Científica Independente de Reprodutibilidade — NASA GPM IMERG Early V07B

**Projeto:** SONATLAS — Sonificação de Dados de Precipitação  
**Data da Auditoria:** 14 de Novembro de 2026  
**Auditor Independente:** Especialista em Validação e Auditoria Científica Independente  
**Escopo da Auditoria:** Janela vespertina de 01/01/2024 (17:00:00 às 19:59:59 UTC)  
**Regiões Auditadas:**
1. **Amazônia Central (Brasil):** Latitude $[-4.0^\circ, -1.5^\circ]$, Longitude $[-61.5^\circ, -58.5^\circ]$ ($25 \times 30 = 750$ células)
2. **Kisangani — Bacia do Congo (RDC):** Latitude $[-0.8^\circ, +1.7^\circ]$, Longitude $[+23.7^\circ, +26.7^\circ]$ ($25 \times 30 = 750$ células)

---

## 1. Proveniência e Integridade dos Arquivos Originais da NASA

Foram auditados os seis grânulos globais HDF5 armazenados no diretório oficial de dados brutos [`processing/data/raw/`](file:///c:/Users/sarah/OneDrive/Desktop/nasa/processing/data/raw/). Todos os arquivos foram abertos, inspecionados byte a byte e validados criptograficamente via hash **SHA-256**:

| Arquivo Bruto HDF5 | Tamanho (Bytes) | SHA-256 | Intervalo de Observação (UTC) |
| :--- | :---: | :---: | :---: |
| `3B-HHR-E.MS.MRG.3IMERG.20240101-S170000-E172959.1020.V07B.HDF5` | 7.368.591 | `c75522b05f801ec408e8bebff687dd95343003fbdaa00b9ee7927a49786dbea3` | 2024-01-01 17:00:00 a 17:29:59 |
| `3B-HHR-E.MS.MRG.3IMERG.20240101-S173000-E175959.1050.V07B.HDF5` | 7.481.393 | `c86bc588d8968e760ebe9b0ba21abce08b772300409c504fe20755926b73b477` | 2024-01-01 17:30:00 a 17:59:59 |
| `3B-HHR-E.MS.MRG.3IMERG.20240101-S180000-E182959.1080.V07B.HDF5` | 7.410.037 | `9d08932d17c4f1c2bd294585ea63db96d475a53819cab2f0f948585728131059` | 2024-01-01 18:00:00 a 18:29:59 |
| `3B-HHR-E.MS.MRG.3IMERG.20240101-S183000-E185959.1110.V07B.HDF5` | 7.344.364 | `f006835f727637259be768a9ab282f0feb18791033a72eb408413b94d8f23a7b` | 2024-01-01 18:30:00 a 18:59:59 |
| `3B-HHR-E.MS.MRG.3IMERG.20240101-S190000-E192959.1140.V07B.HDF5` | 7.418.861 | `c973b2202557ef00045fe18670b3e747a0dd4af70039cb8732e9b6cc035ad215` | 2024-01-01 19:00:00 a 19:29:59 |
| `3B-HHR-E.MS.MRG.3IMERG.20240101-S193000-E195959.1170.V07B.HDF5` | 7.385.318 | `e3f7d2057a6984d2d002bd2d958492e0482477aeb6a9c84a519e99a1b3bde4b4` | 2024-01-01 19:30:00 a 19:59:59 |

---

## 2. Metadados Extraídos Diretamente da Estrutura HDF5

A inspeção direta dos atributos internos dos cabeçalhos (`FileHeader`, `FileInfo`, `GridHeader` e `/Grid/precipitation`) confirmou os seguintes parâmetros oficiais registrados pela NASA:

- **DOI Oficial:** `10.5067/GPM/IMERG/3B-HH-E/07`
- **Autoridade DOI:** `http://dx.doi.org/`
- **Nome Curto do Produto:** `3IMERGHH_EARLY` (IMERG Half-Hourly Early Run)
- **AlgorithmID:** `3IMERGHH`
- **AlgorithmVersion:** `3IMERGH_7.0` (V07B)
- **DataFormatVersion:** `7e`
- **Formato Estrutural:** HDF5 release 1.10.9, Little Endian
- **Data de Geração pela NASA:** Reprocessamento oficial V07B executado em 03/07/2024 entre 23:06 e 23:10 UTC
- **Dataset Auditado:** `/Grid/precipitation`
  - **Dimensões e Shape:** Matriz tridimensional `(time, lon, lat)` com formato `(1, 3600, 1800)`.
  - **LongName:** `Complete merged microwave-infrared (gauge-adjusted) precipitation estimate; formerly precipitationCal`.
  - **Unidade Física (`units` / `Units`):** `mm/hr` (taxa de precipitação instantânea em milímetros por hora).
  - **Sentinela de Dado Ausente (`_FillValue` / `CodeMissingValue`):** `-9999.9` (float32 IEEE 754).
- **Sistema de Coordenadas e Grade:**
  - **Origem dos Eixos:** `SOUTHWEST` com alinhamento de grade centralizado (`Registration=CENTER`).
  - **Latitude (`/Grid/lat`):** 1800 pontos regulares, de $-89.95^\circ$ a $+89.95^\circ$, com passo $\Delta \phi = 0.1^\circ$.
  - **Longitude (`/Grid/lon`):** 3600 pontos regulares, de $-179.95^\circ$ a $+179.95^\circ$, com passo $\Delta \lambda = 0.1^\circ$.
  - **Transposição Obrigatória:** Como a matriz em disco está no arranjo `(lon, lat)`, a transposição matricial $(.)^T$ é estritamente necessária para obter a orientação cartográfica convencional `(lat, lon) = (1800, 3600)`.

---

## 3. Metodologia da Reprodução Independente

A auditoria implementou um script totalmente autônomo ([`processing/scripts/audit_imerg_reproducibility.py`](file:///c:/Users/sarah/OneDrive/Desktop/nasa/processing/scripts/audit_imerg_reproducibility.py)), sem importar nenhuma biblioteca ou função do pipeline de produção do projeto.

### 3.1. Recorte Espacial
- **Amazônia Central:** Latitude $[-4.0^\circ, -1.5^\circ]$ (25 células: $-3.95^\circ$ a $-1.55^\circ$), Longitude $[-61.5^\circ, -58.5^\circ]$ (30 células: $-61.45^\circ$ a $-58.55^\circ$). Total: **750 células espaciais**.
- **Kisangani (Congo):** Latitude $[-0.8^\circ, 1.7^\circ]$ (25 células: $-0.75^\circ$ a $+1.65^\circ$), Longitude $[23.7^\circ, 26.7^\circ]$ (30 células: $+23.75^\circ$ a $+26.65^\circ$). Total: **750 células espaciais**.

### 3.2. Tratamento Ético de Dados Ausentes
- Máscara de validade booleana: $M_{i,j} = 1$ se $R_{i,j} \ge 0.0$ e $R_{i,j} > -9000.0$ e $\neg \text{isnan}(R_{i,j})$.
- Células com chuva zero ($0.0\text{ mm/h}$) foram integralmente preservadas como eventos de calmaria válida.
- Células com valor sentinela $-9999.9$ não foram convertidas em zero.
- Em ambos os recortes e nos seis timestamps, foram encontradas **750 células válidas em 750 (100.0% de disponibilidade)**.

### 3.3. Ponderação Espacial pelo Cosseno da Latitude
Como a área superficial terrestre das células da grade decresce proporcionalmente ao cosseno da latitude ($\phi$), cada célula recebeu o peso $w_i = \cos(\phi_i)$:
$$\bar{R} = \frac{\sum_{i=1}^{N} R_i \cdot w_i \cdot M_i}{\sum_{i=1}^{N} w_i \cdot M_i}$$

### 3.4. Fração de Área com Chuva ($\text{Rain Area Fraction}$)
Calculada sobre as células válidas que atingem ou superam o limiar mínimo de detecção de micro-ondas ($0.1\text{ mm/h}$):
$$\text{RAF} = \frac{\sum_{i=1}^{N} \mathbb{I}(R_i \ge 0.1) \cdot w_i \cdot M_i}{\sum_{i=1}^{N} w_i \cdot M_i}$$

### 3.5. Variação Temporal ($\Delta R$)
$$\Delta R_t = \bar{R}_t - \bar{R}_{t-1} \quad (\text{com } \Delta R_0 = \text{null})$$

### 3.6. Pico Máximo Pontual
Identificação do valor máximo pontual $R_{\max} = \max_i(R_i \cdot M_i)$ e sua respectiva coordenada geográfica $(\text{lat}, \text{lon})$.

---

## 4. Resultados da Recalculação Independente

### 4.1. Amazônia Central (Recorte de 750 células)

| Passo | Timestamp UTC | Horário Local | Taxa Média ($\text{mm/h}$) | Fração de Área ($\%$) | Variação Temporal ($\text{mm/h}$) | Pico Máximo ($\text{mm/h}$) | Coordenada do Pico |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0 | 2024-01-01T17:00:00Z | 13:00 | 0.161311 | 8.2602% | *null* (base) | 6.79 | (-2.5°, -60.8°) |
| 1 | 2024-01-01T17:30:00Z | 13:30 | 0.139074 | 12.5337% | -0.022237 | 4.24 | (-2.5°, -60.8°) |
| 2 | 2024-01-01T18:00:00Z | 14:00 | 0.104627 | 11.0591% | -0.034447 | 3.21 | (-3.9°, -59.8°) |
| 3 | 2024-01-01T18:30:00Z | 14:30 | 0.140267 | 14.6604% | +0.035640 | 4.21 | (-2.6°, -60.8°) |
| 4 | 2024-01-01T19:00:00Z | 15:00 | 0.177948 | 14.5271% | +0.037680 | 7.94 | (-2.8°, -60.5°) |
| 5 | 2024-01-01T19:30:00Z | 15:30 | 0.173580 | 15.0604% | -0.004368 | 7.57 | (-3.4°, -60.3°) |

### 4.2. Kisangani — Bacia do Congo (Recorte de 750 células)

| Passo | Timestamp UTC | Horário Local | Taxa Média ($\text{mm/h}$) | Fração de Área ($\%$) | Variação Temporal ($\text{mm/h}$) | Pico Máximo ($\text{mm/h}$) | Coordenada do Pico |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0 | 2024-01-01T17:00:00Z | 19:00 | 0.037214 | 6.0002% | *null* (base) | 3.91 | (-0.3°, +25.8°) |
| 1 | 2024-01-01T17:30:00Z | 19:30 | 0.016921 | 3.8668% | -0.020293 | 1.75 | (+0.2°, +23.9°) |
| 2 | 2024-01-01T18:00:00Z | 20:00 | 0.041657 | 7.8669% | +0.024736 | 4.10 | (+0.2°, +23.9°) |
| 3 | 2024-01-01T18:30:00Z | 20:30 | 0.041842 | 7.0670% | +0.000186 | 1.69 | (+0.2°, +26.6°) |
| 4 | 2024-01-01T19:00:00Z | 21:00 | 0.116087 | 9.8670% | +0.074245 | 4.07 | (+0.3°, +26.6°) |
| 5 | 2024-01-01T19:30:00Z | 21:30 | 0.049375 | 0.9334% | -0.066712 | **12.70** | (-0.6°, +23.8°) |

---

## 5. Tabela Comparativa entre os Cálculos Independentes e os JSONs

Os valores recalculados de forma independente foram confrontados diretamente contra os quatro arquivos JSON do projeto:
- `frontend/public/data/amazon/observations_afternoon.json`
- `processing/data/processed/amazon_central_afternoon_series.json`
- `frontend/public/data/congo/observations.json`
- `processing/data/processed/congo_kisangani_real_series.json`

### 5.1. Amazônia Central Vespertina

| Timestamp UTC | Indicador Auditado | Valor HDF5 Independente | Valor no JSON | Diferença Absoluta | Diferença Relativa | Parecer |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **17:00** | Taxa Média (mm/h) | 0.161311 | 0.161311 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.082602 | 0.082602 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | *null* | *null* | $0.00$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 6.790000 | 6.790000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **17:30** | Taxa Média (mm/h) | 0.139074 | 0.139074 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.125337 | 0.125337 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | -0.022237 | -0.022237 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 4.240000 | 4.240000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **18:00** | Taxa Média (mm/h) | 0.104627 | 0.104627 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.110591 | 0.110591 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | -0.034447 | -0.034447 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 3.210000 | 3.210000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **18:30** | Taxa Média (mm/h) | 0.140267 | 0.140267 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.146604 | 0.146604 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | +0.035640 | +0.035640 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 4.210000 | 4.210000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **19:00** | Taxa Média (mm/h) | 0.177948 | 0.177948 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.145271 | 0.145271 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | +0.037680 | +0.037680 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 7.940000 | 7.940000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **19:30** | Taxa Média (mm/h) | 0.173580 | 0.173580 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.150604 | 0.150604 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | -0.004368 | -0.004368 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 7.570000 | 7.570000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |

### 5.2. Kisangani — Bacia do Congo

| Timestamp UTC | Indicador Auditado | Valor HDF5 Independente | Valor no JSON | Diferença Absoluta | Diferença Relativa | Parecer |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **17:00** | Taxa Média (mm/h) | 0.037214 | 0.037214 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.060002 | 0.060002 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | *null* | *null* | $0.00$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 3.910000 | 3.910000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **17:30** | Taxa Média (mm/h) | 0.016921 | 0.016921 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.038668 | 0.038668 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | -0.020293 | -0.020293 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 1.750000 | 1.750000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **18:00** | Taxa Média (mm/h) | 0.041657 | 0.041657 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.078669 | 0.078669 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | +0.024736 | +0.024736 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 4.100000 | 4.100000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **18:30** | Taxa Média (mm/h) | 0.041842 | 0.041842 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.070670 | 0.070670 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | +0.000186 | +0.000186 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 1.690000 | 1.690000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **19:00** | Taxa Média (mm/h) | 0.116087 | 0.116087 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.098670 | 0.098670 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | +0.074245 | +0.074245 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | 4.070000 | 4.070000 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| **19:30** | Taxa Média (mm/h) | 0.049375 | 0.049375 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Fração de Área | 0.009334 | 0.009334 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Delta Temporal | -0.066712 | -0.066712 | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |
| | Pico Máximo (mm/h) | **12.700000** | **12.700000** | $0.00 \times 10^0$ | $0.00\%$ | **APROVADA** |

---

## 6. Análise de Divergências

- **Divergências Numéricas:** **ZERO**. Em todas as 24 observações auditadas (6 timestamps $\times$ 4 datasets), a diferença entre os cálculos independentes e os dados armazenados nos JSONs foi idêntica a zero dentro do limite de precisão de ponto flutuante de 64 bits da serialização JSON.
- **Divergências Espaciais:** **ZERO**. O total de células (750) e a resolução ($0.1^\circ$) coincidem perfeitamente com os recortes e os atributos da grade da NASA.
- **Consistência entre Cópias:** Os arquivos em `frontend/public/data/` e seus espelhos intermediários em `processing/data/processed/` são rigorosamente idênticos (verificado por diff byte-a-byte).

---

## 7. Auditoria do Contrato e Metadados dos Datasets

A checagem dos metadados dos quatro arquivos JSON confirmou total integridade:

1. **`is_sample: false`:** Ambos os datasets registram explicitamente que não se tratam de mocks ou dados demonstrativos.
2. **`validation_status: "preliminary_verified"`:** Classificação consistente com a homologação dos dados reais da NASA.
3. **Identificadores das Regiões:**
   - Amazônia: `"region_id": "amazon_central"`.
   - Kisangani: `"region_id": "congo_basin_kisangani"`.
4. **Delimitação de Kisangani:**
   O campo `note` documenta expressamente:
   > *"Janela amostral de controle em torno de Kisangani (RDC) para comparação bioclimática 1:1 controlada com a Amazônia Central. Mesma área de 750 células e mesmos timestamps UTC. Não representa a totalidade da Bacia do Rio Congo."*
5. **Rastreabilidade dos Grânulos:**
   Os timestamps ISO 8601 (`2024-01-01T17:00:00Z` até `T19:30:00Z`) correspondem de forma unívoca aos nomes dos grânulos IMERG `20240101-S170000` a `S193000`, permitindo auditoria reversa imediata.
6. **Unidades Físicas:**
   - Taxa de precipitação: `mm/h` (milímetros por hora).
   - Fração de área: `fraction` (adimensional entre $0.0$ e $1.0$).
   - Variação temporal: `mm/h`.

---

## 8. Compatibilidade com o Motor de Sonificação

A auditoria verificou o acoplamento entre os indicadores reproduzidos e a função `createObservationSonificationParams` em `frontend/src/audio/sonificationMapping.ts`:

1. **Frequência Fundamental ($f(R)$):**
   - Utiliza estritamente a taxa média espacial ($\bar{R}$), sem sofrer contaminação pelo pico máximo pontual ($R_{\max}$).
   - **Caso de Calmaria / Chuva Leve no Congo:** No passo das 19:30 UTC em Kisangani, a taxa média é de $0.0494\text{ mm/h}$ ($< 0.1\text{ mm/h}$). O motor de sonificação gera o tom de repouso C3 ($130\text{ Hz}$), mesmo com a presença de uma célula convectiva pontual de $12.70\text{ mm/h}$. Esse comportamento respeita o design de síntese da Hazel, no qual o tom tonal reflete a condição geral da bacia, enquanto o pico é disponibilizado visualmente e textualmente.
   - **Caso de Pico Médio no Congo:** No passo das 19:00 UTC, a média atinge $0.1161\text{ mm/h}$ ($\ge 0.1\text{ mm/h}$), ativando a frequência de $238\text{ Hz}$ e 2 pulsos rítmicos.
   - **Amazônia Central:** Em todos os seis passos vespertinos, a taxa média permanece entre $0.104$ e $0.178\text{ mm/h}$, gerando frequências ativas entre $237\text{ Hz}$ e $247\text{ Hz}$ e ritmo de 1 a 2 pulsos (coberturas entre $8.3\%$ e $15.1\%$).
2. **Diferenciação Ética:** Nenhuma célula ausente foi mascarada como zero. Como a disponibilidade foi de 100% em todas as observações, nenhum tom de alerta ($300\text{ Hz}$) precisou ser emitido.

---

## 9. Limitações Científicas

1. **Algoritmo Early Run (Latência Rápida):**
   O produto utilizado (`GPM_3IMERGHHE`) é calibrado com base primária em micro-ondas e infravermelho de satélite com latência de ~4 horas. Para estudos hidrológicos definitivos, a NASA recomenda a posterior validação cruzada com o produto *Final Run* (`GPM_3IMERGHH`), que incorpora a rede global de pluviômetros de superfície (GPCC).
2. **Janela Amostral de Kisangani:**
   O recorte de Kisangani cobre $3.0^\circ \times 2.5^\circ$ ($23.7^\circ$ a $26.7^\circ$ E, $-0.8^\circ$ a $1.7^\circ$ N), abrangendo $\sim 90.000\text{ km}^2$. A Bacia Hidrográfica do Rio Congo possui aproximadamente $3.700.000\text{ km}^2$. Portanto, os dados representam a convecção tropical da área de Kisangani e não o regime fluvial da bacia inteira.

---

## 10. Parecer Final de Reprodutibilidade

| Item Auditado | Critério de Avaliação | Resultado | Parecer |
| :--- | :--- | :---: | :---: |
| **Proveniência dos Grânulos** | Integridade dos 6 HDF5 oficiais NASA IMERG Early V07B | 100% íntegros | **APROVADA** |
| **Recorte Espacial** | 750 células regulares ($0.1^\circ$) em ambas as regiões | 1:1 exato | **APROVADA** |
| **Tratamento de Sentinelas** | Sem conversão de $-9999.9$ em zero; 100% válidas | Conforme | **APROVADA** |
| **Taxa Média Ponderada** | $\sum R_i \cos(\phi_i) / \sum \cos(\phi_i)$ | Concordância bit a bit | **APROVADA** |
| **Fração de Área com Chuva** | Células válidas $\ge 0.1\text{ mm/h}$ ponderadas | Concordância bit a bit | **APROVADA** |
| **Variação Temporal ($\Delta R$)** | $\bar{R}_t - \bar{R}_{t-1}$ com linha base nula | Concordância bit a bit | **APROVADA** |
| **Pico Máximo Pontual** | Identificação exata da célula e coordenadas | Concordância bit a bit | **APROVADA** |
| **Contrato dos JSONs** | `is_sample: false`, proveniência e ressalvas | Conforme | **APROVADA** |
| **Sonificação** | Compatibilidade dos parâmetros com motor da Hazel | Conforme | **APROVADA** |

**PARECER DEFINITIVO:**  
Os dados científicos publicados nas séries vespertinas da **Amazônia Central** e de **Kisangani** foram **100% reproduzidos de forma independente a partir dos arquivos HDF5 originais da NASA**. Não foi detectada nenhuma inconsistência numérica, manipulação sintética ou desvio metodológico. A integração científica e o contrato de dados do SONATLAS estão **HOMOLOGADOS COM GRAU MÁXIMO DE REPRODUTIBILIDADE**.
