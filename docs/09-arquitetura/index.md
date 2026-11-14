# 09. Arquitetura e Tecnologias

O SONATLAS foi projetado sob o padrão de **Arquitetura Desacoplada Orientada a Dados Estáticos (*Static Data-Driven Decoupled Architecture*)**, garantindo máxima velocidade de execução, portabilidade e independência entre a esteira científica de dados e a interface do usuário.

---

## 1. Visão Geral da Arquitetura

```mermaid
flowchart TD
    subgraph Offline / Pipeline Python
        GES["🛰️ NASA Earthdata GES DISC<br/>(HDF5 / NetCDF IMERG)"] --> EXT["processing/extraction/<br/>gpm_extractor.py"]
        EXT --> CLIP["Recorte Espacial Bounding Box"]
        CLIP --> IND["processing/indicators/<br/>precipitation_indicators.py<br/>(Ponderação Cosseno + RAF)"]
        IND --> VAL["processing/validation/<br/>data_validator.py<br/>(Checagem de Regras e Nulos)"]
        VAL --> EXP["processing/scripts/<br/>run_pipeline.py"]
    end

    EXP -->|Exportação de JSON Estruturado| DATA["frontend/public/data/<br/>amazon_central_series.json"]

    subgraph Runtime / Frontend Web (Cliente)
        DATA --> SERV["frontend/src/services/<br/>dataService.ts (Fetch + Validação)"]
        SERV --> STATE["Gerenciador de Estado do Player<br/>(useAudioPlayer & useKeyboardShortcuts)"]
        
        STATE --> AUDIO["frontend/src/audio/<br/>AudioEngine.ts & sonificationMapping.ts<br/>(Síntese Web Audio API)"]
        STATE --> ACC["frontend/src/accessibility/<br/>AriaLiveAnnouncer.tsx"]
        STATE --> MAP["frontend/src/maps/<br/>MapView.tsx (Leaflet 2D)"]
        STATE --> UI["frontend/src/components/<br/>(AudioPlayer, Timeline, Summary, Legend)"]
    end
```

---

## 2. Tecnologias Utilizadas e Justificativa

| Camada | Tecnologia Adotada | Justificativa Arquitetural |
|---|---|---|
| **Linguagem Frontend** | TypeScript 5.4+ | Tipagem estática rigorosa baseada no dicionário de dados JSON, prevenindo erros em tempo de execução. |
| **Framework Web** | React 18+ com Vite | Criação de componentes modulares de alta performance com *Hot Module Replacement* (HMR) instantâneo. |
| **Motor de Áudio** | Web Audio API (Nativo) | Síntese de áudio paramétrica em tempo real no cliente, sem latência de streaming e sem bibliotecas pesadas. |
| **Visualização 2D** | Leaflet 1.9+ & GeoJSON | Biblioteca cartográfica leve, eficiente e compatível com camadas vetoriais de contorno territorial. |
| **Linguagem Científica** | Python 3.10+ | Ecossistema maduro para manipulação de matrizes geoespaciais e grânulos de satélite. |
| **Tratamento de Matrizes** | NumPy & Pandas | Vetorização de operações de ponderação cosseno e filtros booleanos de células com chuva. |
| **Validação e Contrato** | Pydantic / Schema Custom | Garantia de que nenhum dado fora dos limites físicos seja exportado para o frontend. |
| **Documentação Técnica** | MkDocs Material | Portal de documentação estático, moderno, responsivo e publicado via GitHub Pages. |

---

## 3. Estrutura de Diretórios e Módulos

```text
sonatlas/
├── frontend/                     # Aplicação Web (Interface e Síntese Sonora)
│   ├── public/
│   │   ├── data/                 # Séries temporais em JSON consumidas pelo DataService
│   │   └── visualizations/       # Quadros visuais e imagens de apoio do EIC
│   ├── src/
│   │   ├── audio/                # Motor de áudio (AudioEngine) e mapeamentos (sonificationMapping)
│   │   ├── accessibility/        # Provedores de leitor de tela (AriaLive) e modais de atalhos
│   │   ├── components/           # Componentes atômicos (Player, Legenda, Seletor, Timeline, Sumário)
│   │   ├── hooks/                # Hooks customizados de ciclo de vida e atalhos de teclado
│   │   ├── maps/                 # Visualizador cartográfico 2D Leaflet
│   │   ├── pages/                # Páginas principais (HomePage)
│   │   ├── services/             # Clientes de dados HTTP e validação
│   │   ├── styles/               # CSS global e variáveis do tema escuro de alto contraste
│   │   ├── types/                # Interfaces TypeScript sincronizadas com o data-dictionary
│   │   └── utils/                # Formatadores de unidades físicas (mm/h, %) e geometria
│   ├── tests/                    # Suíte de testes unitários com Vitest
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── processing/                   # Pipeline Científico em Python (Offline)
│   ├── data/
│   │   ├── raw/                  # Arquivos brutos HDF5/NetCDF (ignorados no git)
│   │   ├── processed/            # Matrizes intermediárias de processamento
│   │   └── samples/              # Amostras técnicas de referência validadas
│   ├── geometry/
│   │   ├── amazon/               # GeoJSON da bounding box da Amazônia Central
│   │   └── international/        # Placeholders de orientação da Bacia do Congo
│   ├── extraction/               # Extrator e integrador com NASA Earthdata GES DISC
│   ├── indicators/               # Funções de cálculo de taxa média ponderada e RAF
│   ├── validation/               # Validador de integridade e rejeição de nulos falsos
│   ├── scripts/                  # Script CLI orquestrador da esteira (run_pipeline.py)
│   ├── tests/                    # Testes unitários com Pytest
│   └── requirements.txt          # Dependências do ecossistema Python
│
├── docs/                         # Portal de Documentação Oficial (MkDocs Material)
│   ├── 01-visao-produto/
│   ├── 02-personas/
│   ├── 03-requisitos/
│   ├── 04-historias-usuario/
│   ├── 05-metodologia/
│   ├── 06-dados-cientificos/
│   ├── 07-sonificacao/
│   ├── 08-acessibilidade/
│   ├── 09-arquitetura/
│   ├── 10-testes/
│   ├── 11-desenvolvimento/
│   ├── 12-equipe/
│   └── index.md
│
├── mkdocs.yml                    # Configuração central do portal de documentação
├── requirements-docs.txt         # Dependências Python para compilar o portal
└── .github/
    └── workflows/                # Automações de CI e deploy do GitHub Pages
```

---

## 4. Contratos de integração do frontend

`frontend/src/types/dataset.ts` é o contrato compartilhado para a integração:

- **Ciência / dados:** publica `RegionDataset` em JSON em `frontend/public/data/`. `region_id`, `observations`, `timestamp_utc`, `availability` e `scientific_indicators` mantêm o formato definido pelas interfaces existentes. Marque `is_sample: true` para amostras; a interface as identifica como demonstrativas.
- **Mapa:** recebe `boundingBox`, `regionName` e `isPlaceholder` em `MapView`; a página apenas encaminha a região e seus limites.
- **Sonificação e player:** `TemporalObservation` é a unidade temporal compartilhada. O player recebe os passos e o índice selecionado; o motor de áudio permanece no módulo `audio/`.
- **Composição:** `HomePage` seleciona uma região, carrega seu dataset e encaminha a mesma observação ativa ao resumo e aos controles temporais.

Estados da interface: carregamento e falha do fetch são estados da página; série vazia é indisponibilidade de observações; `availability` descreve células ausentes dentro de uma observação; `is_sample` identifica dados demonstrativos. Não interprete nenhum desses estados como precipitação zero.

Os módulos de mapa, processamento científico e áudio/player mantêm seus arquivos e implementação próprios; esta integração consome seus contratos existentes.

### Estado da integração IMERG

O contrato de integração do frontend é o `RegionDataset` em `frontend/src/types/dataset.ts`, publicado como JSON estático em `frontend/public/data/`.

A integração com **dados reais da NASA** para a Amazônia Central foi implementada e auditada tecnicamente:

- **Fonte Oficial:** NASA Earthdata GES DISC — Missão Global Precipitation Measurement (GPM).
- **Produto e Versão:** `GPM_3IMERGHHE` (IMERG Early Run), versão **V07B**.
- **Data e Janela Temporal:** 01/01/2024, cobrindo seis passos consecutivos de 30 minutos das 00:00:00 às 02:59:59 UTC (horários de início em 00:00, 00:30, 01:00, 01:30, 02:00 e 02:30 UTC).
- **Variável e Unidade:** `/Grid/precipitation` em taxa instantânea de **`mm/hr`**.
- **Recorte Espacial da Amazônia Central:** Bounding box delimitada pelas latitudes $-4.0^\circ$ a $-1.5^\circ$ Sul e longitudes $-61.5^\circ$ a $-58.5^\circ$ Oeste, totalizando **750 células espaciais** ($25 \times 30$ células de $0.1^\circ \times 0.1^\circ$).
- **Dataset Real Publicado:** [`frontend/public/data/amazon/observations.json`](file:///c:/Users/sarah/OneDrive/Desktop/nasa/frontend/public/data/amazon/observations.json) (espelhado em [`frontend/public/data/amazon_central_series.json`](file:///c:/Users/sarah/OneDrive/Desktop/nasa/frontend/public/data/amazon_central_series.json)), com `is_sample: false` comprovado por proveniência direta dos grânulos HDF5.
- **Pipeline Científico Oficial:** [`processing/scripts/process_amazon_real.py`](file:///c:/Users/sarah/OneDrive/Desktop/nasa/processing/scripts/process_amazon_real.py), responsável pela leitura dos grânulos HDF5, tratamento de `_FillValue`, transposição matricial `(lat, lon)` e cálculo de média ponderada por cosseno da latitude.

#### Diferenciação entre Dados Reais e Sintéticos

Para preservar a rastreabilidade e integridade científica do projeto:
- **`processing/scripts/run_pipeline.py --demo`:** Script de bootstrap que gera a amostra sintética [`processing/data/samples/amazon_central_sample.json`](file:///c:/Users/sarah/OneDrive/Desktop/nasa/processing/data/samples/amazon_central_sample.json) (`is_sample: true`), voltado a testes rápidos offline de desenvolvimento sem necessidade de credenciais NASA.
- **`processing/scripts/process_amazon_real.py`:** Orquestrador científico oficial que processa grânulos brutos HDF5 reais baixados do GES DISC (`processing/data/raw/*.HDF5`) e gera observações oficiais auditadas (`is_sample: false`).
- Nenhum arquivo é considerado real unicamente pela flag `is_sample: false`; a autenticidade é garantida pela proveniência dos grânulos brutos baixados e verificados numericamente.

#### Limitações Científicas da Prova de Conceito

1. **Janela Temporal:** A demonstração atual processa uma sequência de seis observações de 30 minutos (janela de 3 horas), servindo como prova de conceito da esteira ponta a ponta e da sonificação, não constituindo uma caracterização climatológica de longo prazo da Amazônia.
2. **Delimitação Espacial:** O recorte adotado é uma *bounding box* retangular de referência geofísica, e não o contorno hidrográfico ou biomático exato da floresta amazônica.
3. **Produto Early Run:** Utiliza o produto `GPM_3IMERGHHE` (Early Run, latência de ~4h), voltado a monitoramento rápido, e não o `GPM_3IMERGHH` (Final Run), cuja calibração com a rede global de pluviômetros de superfície (GPCC) requer meses de consolidação.

## 5. Registro de Decisões Arquiteturais (ADRs)

### ADR-01: Desacoplamento Total via Arquivos JSON Estáticos
- **Contexto:** Necessidade de permitir que o frontend funcione com latência mínima, zero custo de hospedagem de backend e total portabilidade para o hackathon.
- **Decisão:** O processamento Python gera arquivos estáticos JSON que são servidos diretamente pela pasta `public/data/` do frontend.
- **Consequência:** Simplifica o deploy no GitHub Pages, elimina custos de servidor e isola as dependências complexas de geoprocessamento da interface web.

### ADR-02: Síntese de Áudio no Cliente via Web Audio API Nativa
- **Contexto:** Evitar download massivo de arquivos de áudio MP3/WAV pré-renderizados para cada combinação de dados.
- **Decisão:** Utilizar a Web Audio API nativa com osciladores senoidais e nós de ganho dinâmicos programados no navegador.
- **Consequência:** Economia radical de largura de banda (< 50 KB de dados por série) e latência de resposta acústica instantânea (< 50 ms).

### ADR-03: Não Utilização de Banco de Dados no MVP
- **Contexto:** O projeto necessita de velocidade de entrega e reprodutibilidade imediata pelos jurados e comunidade.
- **Decisão:** Proibição de introdução de bancos relacionais (PostgreSQL/MySQL) ou NoSQL na Sprint inicial.
- **Consequência:** Qualquer desenvolvedor ou avaliador pode clonar o repositório e executar a aplicação imediatamente com `npm run dev`.
