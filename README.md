# SONATLAS — Explore Earth Through Sound 🌍🔊

> **NASA Space Apps Challenge 2026**  
> **Challenge:** *The Earth Information Jukebox*  
> **Status do Projeto:** Fase Inicial de Arquitetura e Fundação (Sprint 0)

---

## 📌 Visão Geral

O **SONATLAS** é uma aplicação web acessível que converte observações e indicadores científicos da NASA em experiências sonoras e visuais dinâmicas. 

A plataforma transforma dados geofísicos em representações auditivas calibradas perceptivamente, permitindo que usuários explorem a dinâmica do nosso planeta por meio da audição e da visão. O projeto foi projetado com prioridade máxima para **pessoas cegas ou com baixa visão**, além de atender estudantes, educadores, cientistas e entusiastas da ciência da Terra.

O primeiro fenômeno abordado é a **precipitação atmosférica**, comparando duas regiões bioclimáticas fundamentais:
1. **Região Nacional:** Amazônia Central (Brasil) — bacia florestal tropical úmida de alta relevância climática global.
2. **Região Internacional:** Região de estudo em processo de validação pela equipe científica (candidata em avaliação: Bacia do Congo, sem dados fictícios associados).

---

## 🎯 O Problema que Resolvemos

A esmagadora maioria das ferramentas de divulgação e análise de dados de observação da Terra (como NASA Earth Information Center - EIC e Giovanni) baseia-se exclusivamente em representações visuais: mapas de calor, globos 3D colorimétricos e gráficos estáticos.

Esse modelo apresenta duas grandes limitações:
1. **Exclusão de Acessibilidade:** Pessoas cegas ou com deficiência visual encontram barreiras intransponíveis para compreender a distribuição espacial e a variabilidade temporal dos dados da Terra.
2. **Saturação Visual:** Mesmo para usuários videntes, a audição humana é extraordinariamente sensível a padrões temporais, ritmos, variações sutis e transições dinâmicas que passam despercebidas em telas estáticas.

O SONATLAS resolve isso através de **sonificação orientada por dados com rigor científico**, garantindo que toda representação sonora reflita proporções reais de medição física.

---

## 🔬 Rigor Científico e Fontes de Dados

- **Fonte Oficial Primária:** Missão **NASA GPM (Global Precipitation Measurement)** / produto **IMERG Early Run V07B (`GPM_3IMERGHHE`)**, obtido do repositório oficial NASA GES DISC.
- **Série Temporal da Amazônia Central:** Sequência de 6 observações reais de 30 minutos em 01/01/2024 (00:00 a 02:59 UTC), recortadas para a bounding box $[-4.0^\circ, -1.5^\circ] \times [-61.5^\circ, -58.5^\circ]$ (750 células espaciais de $0.1^\circ \times 0.1^\circ$).
- **Grandezas Físicas Tratadas:**
  - **Taxa média de precipitação (`mm/h`)**: calculada com ponderação pelo cosseno da latitude sobre células válidas, diferenciada de precipitação acumulada (`mm`).
  - **Fração de área com chuva (`fraction` entre 0 e 1)**: proporção da área com taxa $\ge 0.1\text{ mm/h}$ (limiar instrumental do sensor GMI).
  - **Diferença temporal (`mm/h`)**: variação contínua entre passos adjacentes ($\Delta R_t = \bar{R}_t - \bar{R}_{t-1}$).
- **Tratamento Rigoroso de Dados:** Células ausentes ou sob controle de qualidade deficiente (`_FillValue: -9999.9`) **não são tratadas como precipitação zero**. Valores zero indicam calmaria real (`0.0 mm/hr`).
- **Diferenciação Real vs. Sintético:**
  - `frontend/public/data/amazon/observations.json`: dados autênticos extraídos dos grânulos HDF5 reais (`is_sample: false`).
  - `processing/scripts/run_pipeline.py --demo`: gera dados demonstrativos sintéticos para testes rápidos offline (`processing/data/samples/amazon_central_sample.json`).
- **Limitações Científicas:** A sequência de 6 grânulos (3 horas) constitui uma prova de conceito funcional da pipeline e sonificação, e não uma caracterização climatológica de longo prazo da Amazônia. Utiliza o produto Early Run V07B (latência rápida), sem calibração tardia de pluviômetros de solo do Final Run.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia | Finalidade |
|---|---|---|
| **Frontend Framework** | React 18+ com TypeScript & Vite | Aplicação web rápida, modular e tipada com rigor |
| **Interface & Acessibilidade** | HTML5 semântico, CSS3, WAI-ARIA | Padrões WCAG 2.1 AA/AAA, regiões `aria-live`, foco gerenciado |
| **Visualização Geográfica** | Leaflet 2D / React-Leaflet & GeoJSON | Delimitação territorial das áreas de estudo e visualização 2D |
| **Sonificação Web** | Web Audio API (nativo) & Tone.js | Síntese de áudio paramétrica em tempo real no navegador |
| **Processamento Científico** | Python 3.10+ (NumPy, Xarray, Pandas) | Extração, validação estatística e cálculo de indicadores climáticos |
| **Armazenamento de Dados** | Arquivos estáticos JSON estruturados | Modelo desacoplado e escalável sem dependência de banco de dados no MVP |
| **CI / Automação** | GitHub Actions | Validação contínua de tipos TypeScript, compilação e testes |

---

## 📂 Estrutura do Repositório

```text
sonatlas/
├── frontend/                     # Aplicação web React + Vite + TypeScript
│   ├── public/
│   │   ├── data/                 # JSONs de dados científicos consumidos pelo frontend
│   │   └── visualizations/       # Referências visuais e quadros estáticos
│   ├── src/
│   │   ├── assets/               # Ícones e identidades visuais estáticas
│   │   ├── components/           # Componentes modulares reutilizáveis (Player, Legenda, Seletores)
│   │   ├── pages/                # Páginas principais da aplicação
│   │   ├── maps/                 # Módulo de visualização cartográfica Leaflet + GeoJSON
│   │   ├── audio/                # Motor de sonificação (Web Audio API / Tone.js)
│   │   ├── accessibility/        # Provedores de leitor de tela, foco e navegação assistiva
│   │   ├── services/             # Clientes de carregamento de dados e validação de schema
│   │   ├── hooks/                # Hooks customizados para áudio, dados e acessibilidade
│   │   ├── types/                # Definições de tipos TypeScript compartilhados
│   │   ├── utils/                # Formatadores de unidades (mm/h, datas, escalas)
│   │   ├── styles/               # Estilos globais e variáveis de alto contraste
│   │   ├── App.tsx               # Componente raiz da aplicação
│   │   └── main.tsx              # Ponto de entrada React
│   ├── tests/                    # Testes unitários do frontend
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── processing/                   # Pipeline científico em Python
│   ├── data/
│   │   ├── raw/                  # Diretório para arquivos brutos IMERG/HDF5/NetCDF
│   │   ├── processed/            # Séries temporais intermediárias processadas
│   │   └── samples/              # Amostras validadas no formato do dicionário de dados
│   ├── geometry/
│   │   ├── amazon/               # GeoJSON e metadados da Amazônia Central
│   │   └── international/        # Orientações e placeholders da região internacional candidata
│   ├── extraction/               # Extração de dados da NASA Earthdata (GES DISC)
│   ├── indicators/               # Algoritmos de cálculo de indicadores (taxa média, fração de área)
│   ├── validation/               # Validação de integridade, flags de qualidade e dados ausentes
│   ├── scripts/                  # Scripts executáveis de automação da esteira
│   ├── tests/                    # Testes unitários do pipeline científico
│   └── requirements.txt          # Dependências do ecossistema científico Python
│
├── docs/                         # Documentação completa de engenharia e ciência
│   ├── product/                  # Visão do produto, personas, user stories e fluxos
│   ├── architecture/             # Arquitetura do sistema e dicionário de dados JSON
│   ├── science/                  # Metodologia científica, fontes de dados e sonificação
│   ├── accessibility/            # Requisitos WCAG e matriz de testes não-visuais
│   └── development/              # Guias de instalação e contribuição
│
├── .github/                      # Automações e governança no GitHub
│   ├── ISSUE_TEMPLATE/           # Templates padronizados para User Stories, Bugs e Tarefas
│   ├── workflows/ci.yml          # Pipeline de integração contínua
│   └── PULL_REQUEST_TEMPLATE.md  # Template para submissão de Pull Requests
│
├── .gitignore
├── .editorconfig
├── .gitattributes
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── .env.example
```

---

## 👥 Organização da Equipe de Desenvolvimento

| Papel | Responsabilidade Primária | Módulo Principal |
|---|---|---|
| **Dev 1 — UI & Frontend Core** | Estrutura da aplicação, player, páginas, layout responsivo e controles visuais. | `frontend/src/components`, `frontend/src/pages` |
| **Dev 2 — Cartografia & Geoespacial** | Integração Leaflet, camadas GeoJSON, sincronização espacial e rendering 2D. | `frontend/src/maps`, `processing/geometry` |
| **Dev 3 — Engenharia de Áudio** | Síntese de áudio na Web Audio API, mapeamento paramétrico perceptivo e calibração de frequências. | `frontend/src/audio` |
| **Dev 4 — Ciência & Processamento de Dados** | Ingestão IMERG/GPM, cálculo de indicadores climáticos, tratamento de nulos e exportação JSON. | `processing/` |
| **Dev 5 — Acessibilidade & QA** | Suporte a leitores de tela (NVDA/JAWS/Orca), navegação estrita por teclado, testes unitários e CI. | `frontend/src/accessibility`, `tests/` |

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- **Node.js** v18+ (recomendado v20+) e **npm** v9+
- **Python** 3.10+ (para execução dos scripts de processamento)
- Git instalado

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/sonatlas.git
cd sonatlas
```

### 2. Executar o Frontend
```bash
cd frontend
npm install
npm run dev
```
Acesse a aplicação no seu navegador em `http://localhost:5173`.

Para validar a tipagem e compilação do frontend:
```bash
npm run build
```

Para rodar os testes do frontend:
```bash
npm run test
```

### 3. Executar o Módulo de Processamento (Python)
```bash
cd processing
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# No Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# No Linux/macOS:
source venv/bin/activate

# Instalar dependências científicas
pip install -r requirements.txt

# Processar grânulos HDF5 reais da NASA para a Amazônia Central
python scripts/process_amazon_real.py

# Alternativa: gerar amostra demonstrativa sintética offline
python scripts/run_pipeline.py --demo

# Executar testes automatizados do processamento
pytest tests/
```

---

## 📋 Status Atual do Desenvolvimento

- [x] Arquitetura inicial do repositório estruturada e padronizada.
- [x] Configurações de governança, Git, CI e templates de PR/Issues criados.
- [x] Base React + Vite + TypeScript configurada com acessibilidade nativa e Web Audio API.
- [x] Documentação completa de produto, arquitetura, ciência, acessibilidade e setup redigida.
- [x] Dicionário de dados JSON especificado e validado com schema formal.
- [x] Conexão e download de grânulos brutos IMERG V07B via NASA Earthdata GES DISC.
- [x] Ingestão científica, recorte espacial e cálculo de indicadores ponderados da Amazônia Central (`process_amazon_real.py`).
- [x] Integração completa dos dados reais com o motor de sonificação Web Audio API da Hazel (`AudioEngine`).
- [ ] Validação oficial e escolha da segunda região geográfica internacional (Bacia do Congo).
- [ ] Calibração psicoacústica das frequências e timbres com usuários de leitores de tela.

---

## 📜 Licença

Distribuído sob a licença **MIT**. Veja [LICENSE](LICENSE) para mais detalhes.
