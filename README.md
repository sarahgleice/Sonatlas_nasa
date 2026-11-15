# 🌍 SONATLAS

### Explore Earth Through Sound

> 🏆 **1º Lugar — NASA Space Apps Challenge 2026 | Brasília Local**

[![GitHub stars](https://img.shields.io/github/stars/sarahgleice/Sonatlas_nasa?style=for-the-badge&logo=github)](https://github.com/sarahgleice/Sonatlas_nasa/stargazers)
[![Licença MIT](https://img.shields.io/github/license/sarahgleice/Sonatlas_nasa?style=for-the-badge)](LICENSE)
[![Último commit](https://img.shields.io/github/last-commit/sarahgleice/Sonatlas_nasa?style=for-the-badge)](https://github.com/sarahgleice/Sonatlas_nasa/commits/main)

**Transformando dados científicos da Terra em experiências visuais e sonoras.**

**NASA Space Apps Challenge 2026**  
**Challenge:** The Earth Information Jukebox  
**Team:** UNICEPLAC Developers · **Location:** Brasília, Brazil

O **Sonatlas** é o projeto vencedor do **1º lugar na edição local de Brasília do NASA Space Apps Challenge 2026**, desenvolvido pela equipe **UNICEPLAC Developers**, formada por cinco estudantes de Engenharia de Software da UNICEPLAC.

O projeto foi desenvolvido para o desafio **The Earth Information Jukebox**, com a proposta de transformar dados científicos de observação da Terra em experiências interativas de visualização e sonificação.

Nossa solução utiliza dados reais da missão GPM da NASA, permitindo explorar a precipitação atmosférica na Amazônia Central e na região de Kisangani, na Bacia do Congo.

---

---

## Sobre o projeto

O **Sonatlas** é uma aplicação web interativa que permite explorar fenômenos ambientais da Terra por meio de mapas, visualizações científicas e sonificação de dados.

Desenvolvido para o **NASA Space Apps Challenge 2026**, o projeto busca transformar informações complexas de observação da Terra em uma experiência mais acessível, intuitiva e imersiva.

A proposta é simples:

**E se pudéssemos ouvir as mudanças que acontecem no nosso planeta?**

No Sonatlas, dados ambientais são convertidos em características sonoras, permitindo que usuários explorem variações geográficas e temporais de uma maneira diferente.

O projeto combina ciência de dados, desenvolvimento web, cartografia digital, acessibilidade e processamento de áudio.

## Reconhecimento e Conquistas

Em **15/11/2026**, o Sonatlas conquistou o **1º lugar na etapa local de Brasília do NASA Space Apps Challenge 2026**, representando a UNICEPLAC como equipe **UNICEPLAC Developers**.

O reconhecimento celebra uma proposta que combina exploração geográfica em mapa 2D e globo 3D, séries temporais e visualizações de precipitação, sonificação sincronizada e recursos de acessibilidade. O resultado foi construído coletivamente pelos **cinco integrantes**, que colaboraram entre engenharia de software, dados científicos, cartografia, áudio, acessibilidade e qualidade.

Esta conquista corresponde à etapa local de Brasília; não representa uma premiação global da NASA. O Sonatlas é um projeto independente e não é um produto oficial da NASA.

## O desafio

Grande parte das informações científicas sobre a Terra é apresentada por meio de gráficos, tabelas e mapas.

Essas representações são importantes, mas podem apresentar barreiras para pessoas com deficiência visual e para usuários sem familiaridade com indicadores científicos.

O Sonatlas explora uma abordagem complementar: a **sonificação de dados**.

Em vez de depender exclusivamente de representações visuais, a aplicação utiliza o som como mais uma ferramenta de interpretação científica.

Nosso objetivo é aproximar as pessoas da ciência da Terra, tornando a exploração de dados mais interativa e inclusiva.

## Como o Sonatlas funciona?

A experiência é organizada em quatro etapas:

**1. Explore o planeta**

Navegue pelo mapa interativo e selecione uma região geográfica disponível.

**2. Selecione os dados**

Explore informações ambientais associadas à região, começando pela precipitação atmosférica.

**3. Navegue pelo tempo**

Observe como os indicadores variam ao longo dos períodos disponíveis na série temporal.

**4. Ouça os dados**

A aplicação transforma as medições científicas em parâmetros sonoros, permitindo explorar mudanças por meio de uma representação auditiva sincronizada com as visualizações.

A sonificação é complementar aos dados originais e não substitui suas unidades ou interpretações científicas.

---

## Demonstração

O MVP reúne um fluxo navegável de exploração geográfica, seleção de períodos, indicadores e visualizações científicas, sonificação e recursos de acessibilidade. As funcionalidades e a disponibilidade dos dados podem variar por região e série temporal; consulte os estados de validação descritos nesta documentação e nos dados publicados.

A interface utiliza uma abordagem visual inspirada em **Mission Control + Cosmic Sound**, combinando mapas geográficos, indicadores ambientais e controles interativos.

O explorador geográfico é o elemento central da experiência.

*Uma captura de tela ou demonstração em vídeo poderá ser adicionada aqui.*

---

## Funcionalidades

### Exploração geográfica

- Mapa interativo utilizando Leaflet.
- Seleção de regiões geográficas.
- Visualização de limites territoriais e dados espaciais.
- Suporte a camadas GeoJSON.
- Componentes para visualização em globo 3D.

### Visualização científica

- Apresentação de indicadores ambientais.
- Exploração de séries temporais.
- Visualização de variações de precipitação.
- Diferenciação entre medições válidas e dados ausentes.
- Representações geográficas associadas aos dados.

### Sonificação

- Motor de áudio baseado em Web Audio API.
- Conversão de indicadores em parâmetros sonoros.
- Mapeamento de variáveis científicas.
- Controles de reprodução e interação.
- Integração entre visualizações e experiências auditivas.

### Acessibilidade

O Sonatlas considera acessibilidade desde a concepção.

Entre as prioridades estão a navegação por teclado, a legibilidade, os controles acessíveis e a apresentação de alternativas textuais às informações sonoras.

A conformidade com padrões de acessibilidade depende de validação e testes específicos.

---

## Dados científicos

A fonte principal utilizada no processamento de precipitação é a missão **NASA Global Precipitation Measurement (GPM)**.

O projeto trabalha com dados do produto **IMERG Early Run V07B**, disponibilizados pelo NASA Earthdata/GES DISC.

### Fenômeno inicial

**Precipitação atmosférica**

Os indicadores processados incluem:

| Indicador | Unidade | Descrição |
|---|---|---|
| Taxa média de precipitação | mm/h | Intensidade média da precipitação na região |
| Fração de área com chuva | 0–1 | Proporção da área com precipitação acima do limiar definido |
| Variação temporal | mm/h | Diferença entre taxas de precipitação de observações consecutivas |
| Precipitação máxima | mm/h | Maior taxa registrada no recorte espacial |

### Regiões de estudo

**Amazônia Central — Brasil**

Região com observações e grades espaciais processadas a partir de dados reais de precipitação. O manifesto publicado identifica a validação como **preliminarmente verificada**.

O repositório contém séries referentes a 1º de janeiro de 2024, em janelas da madrugada e da tarde, além da série combinada do dia.

**Bacia do Congo — África Central**

Região de comparação internacional com uma série de observações e grades espaciais candidatas para a janela de Kisangani. O manifesto mantém o estado **candidata em revisão**.

A disponibilidade dos arquivos não substitui a validação científica nem garante equivalência temporal entre as séries comparadas.

### Integridade científica

O projeto segue princípios de rastreabilidade e interpretação responsável:

- Dados ausentes não são automaticamente convertidos em precipitação zero.
- Taxa de precipitação (`mm/h`) não é equivalente a precipitação acumulada (`mm`).
- Dados demonstrativos devem ser identificados como sintéticos.
- Séries temporais precisam preservar suas referências de data e horário.
- Transformações sonoras devem possuir regras explícitas.
- Os resultados representam os períodos observados, não necessariamente tendências climáticas de longo prazo.

**Fontes de referência:**

- [NASA GPM / IMERG](https://gpm.nasa.gov/data/imerg)
- [NASA Earthdata](https://www.earthdata.nasa.gov/)
- [NASA GES DISC](https://disc.gsfc.nasa.gov/)

---

## Tecnologias

O Sonatlas utiliza uma arquitetura web com processamento científico separado da interface.

| Categoria | Tecnologias |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Interface | HTML5, CSS3, Lucide React |
| Mapas | Leaflet, GeoJSON |
| Áudio | Web Audio API |
| Processamento científico | Python, NumPy e bibliotecas de leitura HDF5 |
| Dados | JSON, GeoJSON, HDF5 |
| Testes frontend | Vitest |
| Versionamento | Git e GitHub |

A arquitetura do MVP utiliza arquivos processados disponibilizados ao frontend, sem exigir um banco de dados para as séries científicas.

---

## Estrutura do projeto

```text
Sonatlas_nasa/
├── frontend/
│   ├── public/
│   │   └── data/
│   │       ├── amazon/
│   │       └── congo/
│   ├── src/
│   │   ├── accessibility/
│   │   ├── audio/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── maps/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── processing/
│   ├── api/
│   ├── data/
│   ├── extraction/
│   ├── geometry/
│   ├── indicators/
│   ├── scripts/
│   ├── tests/
│   ├── validation/
│   └── requirements.txt
│
├── docs/
├── .github/
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

**Frontend:** responsável pela experiência do usuário, visualização geográfica, interação e reprodução sonora.

**Processing:** responsável pela extração, validação e transformação dos dados científicos.

**Docs:** reúne documentação de produto, metodologia, arquitetura, sonificação, acessibilidade e desenvolvimento.

---

## Executando localmente

### Pré-requisitos

- Git
- Node.js compatível com o projeto
- npm
- Python 3.10 ou superior, para o processamento científico

### 1. Clonar o repositório

```bash
git clone https://github.com/sarahgleice/Sonatlas_nasa.git
cd Sonatlas_nasa
```

### 2. Executar o frontend

```bash
cd frontend
npm install
npm run dev
```

O servidor Vite normalmente estará disponível em:

`http://localhost:5173`

Para gerar a versão de produção:

```bash
npm run build
```

Para executar os testes:

```bash
npm run test
```

### 3. Configurar o processamento científico

Em outro terminal, a partir da raiz do repositório:

```bash
cd processing
python -m venv .venv
```

Ative o ambiente virtual.

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Linux/macOS:**

```bash
source .venv/bin/activate
```

Instale as dependências:

```bash
python -m pip install -r requirements.txt
```

### 4. Processar dados

Os scripts estão disponíveis em `processing/scripts/`.

Alguns processamentos dependem de arquivos HDF5 reais obtidos da NASA, que não necessariamente estão incluídos no repositório.

Para executar o processamento existente da Amazônia:

```bash
python scripts/process_amazon_real.py
```

Para gerar dados demonstrativos, quando necessário:

```bash
python scripts/run_pipeline.py --demo
```

A preparação dos dados científicos deve respeitar as instruções dos scripts e a documentação de processamento.

### 5. Executar testes Python

Dentro de `processing/`, com o ambiente virtual ativo:

```bash
python -m pytest tests/
```

---

## Arquitetura

O fluxo principal do Sonatlas conecta processamento científico, visualização geográfica e geração sonora.

```text
NASA GPM / IMERG
       |
       v
Extração de dados HDF5
       |
       v
Validação e processamento Python
       |
       v
Exportação JSON / GeoJSON
       |
       v
Aplicação React
       |
       +--> Mapas e visualizações
       |
       +--> Indicadores científicos
       |
       +--> Motor de sonificação
       |
       v
Experiência interativa
```

A separação entre processamento e interface favorece a organização do projeto e permite que os dados sejam preparados antes de sua utilização no navegador.

---

## Equipe

### UNICEPLAC - Software Developers

O Sonatlas é desenvolvido por uma equipe de **cinco estudantes de Engenharia de Software**, representando a instituição na modalidade presencial do NASA Space Apps Challenge 2026, em Brasília.

O desenvolvimento envolve as áreas de:

- Engenharia de software e frontend.
- Cartografia digital e visualização geográfica.
- Áudio e sonificação.
- Processamento e análise de dados científicos.
- Acessibilidade, testes e qualidade.

As responsabilidades são colaborativas e podem envolver contribuições entre diferentes módulos.

A equipe é independente, e a referência à UNICEPLAC identifica sua representação acadêmica no evento.

---

## Contribuições

Contribuições são bem-vindas.

Antes de desenvolver uma alteração, consulte o [Guia de Contribuição](CONTRIBUTING.md).

O projeto utiliza branches, Pull Requests e revisão de código para manter a qualidade das entregas.

---

## Licença

Este projeto é distribuído sob a [Licença MIT](LICENSE).

**Copyright © 2026 UNICEPLAC - Software Developers (SONATLAS Team)**

A licença do código não substitui as condições de uso de datasets, marcas, imagens e outros recursos de terceiros.

O Sonatlas é um projeto independente desenvolvido por participantes do NASA Space Apps Challenge, não sendo um produto oficial da NASA ou da UNICEPLAC.

---

### SONATLAS — Explore Earth Through Sound

*Transformando dados do nosso planeta em novas formas de descobrir, compreender e experimentar a ciência.*
