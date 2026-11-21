---
title: Início — SONATLAS
description: Portal institucional e científico oficial do SONATLAS — Explore Earth Through Sound. NASA Space Apps Challenge 2026.
---

<div class="sonatlas-hero">
  <span class="sonatlas-hero-badge">
    :material-rocket-launch: NASA Space Apps Challenge 2026 &bull; The Earth Information Jukebox
  </span>
  <h1 class="sonatlas-hero-title">SONATLAS</h1>
  <p class="sonatlas-hero-slogan">Explore Earth Through Sound</p>
  <p class="sonatlas-hero-desc">
    Uma plataforma científica e inclusiva que converte dados de observação da Terra da NASA em experiências auditivas calibradas e multissensoriais. Concebida sob os princípios do <strong>Design Universal</strong> e com prioridade para pessoas cegas ou com baixa visão, tornando fenômenos atmosféricos perceptíveis, mensuráveis e auditáveis por qualquer pessoa.
  </p>
  <div class="sonatlas-cta-group">
    <a href="https://sonatlas-nasa.vercel.app/" target="_blank" rel="noopener noreferrer" class="sonatlas-btn-primary">
      <span>Acessar a Aplicação Web</span> &rarr;
    </a>
    <a href="06-dados-cientificos/" class="sonatlas-btn-secondary">
      <span>Metodologia Científica</span>
    </a>
    <a href="07-sonificacao/" class="sonatlas-btn-secondary">
      <span>Sonificação Psicoacústica</span>
    </a>
    <a href="08-acessibilidade/" class="sonatlas-btn-secondary">
      <span>Acessibilidade Universal</span>
    </a>
    <a href="https://github.com/sarahgleice/Sonatlas_nasa" target="_blank" rel="noopener noreferrer" class="sonatlas-btn-accent">
      <span>GitHub Oficial</span>
    </a>
  </div>
</div>

---

## :material-chart-timeline-variant: O Projeto em Números

<div class="sonatlas-stats-grid">
  <div class="sonatlas-stat-card">
    <div class="sonatlas-stat-number">750</div>
    <div class="sonatlas-stat-label">Células Espaciais</div>
    <div class="sonatlas-stat-desc">Grade regular de 0,1° (~11 km) por recorte geográfico analisado.</div>
  </div>

  <div class="sonatlas-stat-card">
    <div class="sonatlas-stat-number">30 min</div>
    <div class="sonatlas-stat-label">Cadência Orbital</div>
    <div class="sonatlas-stat-desc">Observações temporais de alta resolução do produto NASA GPM IMERG.</div>
  </div>

  <div class="sonatlas-stat-card">
    <div class="sonatlas-stat-number">130 a 880 Hz</div>
    <div class="sonatlas-stat-label">Faixa Psicoacústica</div>
    <div class="sonatlas-stat-desc">Mapeamento logarítmico não-linear do tom de repouso (C3) a tempestades (A5).</div>
  </div>

  <div class="sonatlas-stat-card">
    <div class="sonatlas-stat-number">WCAG 2.1</div>
    <div class="sonatlas-stat-label">Nível AA (com AAA)</div>
    <div class="sonatlas-stat-desc">Conformidade AA com contraste aprimorado no padrão AAA e operação com tela desligada.</div>
  </div>

  <div class="sonatlas-stat-card">
    <div class="sonatlas-stat-number">Zero Streaming</div>
    <div class="sonatlas-stat-label">Síntese Local</div>
    <div class="sonatlas-stat-desc">Síntese paramétrica pura em tempo real via Web Audio API, sem streaming de áudio.</div>
  </div>

  <div class="sonatlas-stat-card">
    <div class="sonatlas-stat-number">2 Regiões</div>
    <div class="sonatlas-stat-label">Estudo Tropical</div>
    <div class="sonatlas-stat-desc">Amazônia Central (piloto verificada) e Bacia do Congo (candidata sob revisão).</div>
  </div>
</div>

---

## :material-lightbulb-on: Visão Geral do Projeto

O **SONATLAS** foi desenvolvido para responder ao desafio global **The Earth Information Jukebox** no **NASA Space Apps Challenge 2026**.

Historicamente, a exploração de dados científicos de observação da Terra depende de representações visuais hegemônicas — mapas de calor coloridos (*colormaps*), telas de alta densidade e globos interativos. Essa abordagem cria uma barreira de acesso para mais de **2,2 bilhões de pessoas com deficiência visual** no mundo (OMS) e subutiliza a alta resolução temporal do sistema auditivo humano para reconhecer ritmos, ciclos e padrões complexos.

Ao integrar dados de satélites da NASA, modelagem matemática rigorosa, síntese de áudio paramétrica em tempo real e acessibilidade universal, o SONATLAS transforma grandezas físicas de precipitação em uma narrativa sonora analítica e compreensível.

### Pipeline de Transformação de Dados

```mermaid
flowchart LR
    subgraph Satelites ["🛰️ Observação da Terra (NASA)"]
        NASA["NASA GES DISC<br/>GPM IMERG V07B Early Run"]
    end

    subgraph Processamento ["⚙️ Processamento Científico (Python)"]
        ENG["Motor Geoespacial Universal<br/>Ponderação cos(lat) + Máscaras"]
        VAL["Validação de Integridade<br/>Preservação Estrita de Nulos"]
    end

    subgraph Plataforma ["🌐 Aplicação Web SONATLAS"]
        MAP2D["Cartografia 2D<br/>Leaflet + Grid"]
        GLOBE["Globo 3D<br/>NASA Blue Marble"]
        AUDIO["Motor Web Audio API<br/>Síntese Paramétrica em Tempo Real"]
        A11Y["Acessibilidade First<br/>ARIA-Live + Modos de Daltonismo"]
    end

    NASA --> ENG
    ENG --> VAL
    VAL --> MAP2D
    VAL --> GLOBE
    VAL --> AUDIO
    VAL --> A11Y
```

---

## :material-earth: Regiões de Estudo e Status de Validação

O SONATLAS adota critérios rigorosos de governança científica. As regiões tropicais analisadas possuem estados de validação distintos, refletindo o grau de verificação e auditoria de cada recorte amostral:

| Região de Estudo | Recorte Geográfico | Grade & Amostragem | Status de Validação | Produto Satelital |
| :--- | :--- | :--- | :--- | :--- |
| **Amazônia Central (Brasil)** | `4.0°S – 1.5°S`<br/>`61.5°W – 58.5°W` | Grade regular de 750 células (25×30 a 0,1°)<br/>12 passos temporais de 30 min (duas janelas de 6 passos) | <span class="badge-verified">preliminary_verified</span><br/>*Piloto com pipeline e reprodutibilidade auditados* | NASA GPM IMERG V07B Early Run |
| **Bacia do Congo (Kisangani, RDC)** | `0.8°S – 1.7°N`<br/>`23.7°E – 26.7°E` | Grade regular de 750 células (25×30 a 0,1°)<br/>6 passos temporais de 30 min (janela vespertina) | <span class="badge-review">candidate_under_review</span><br/>*Janela amostral em avaliação sob revisão técnica* | NASA GPM IMERG V07B Early Run |

> :material-shield-check: **Rigor Científico:**  
> Apenas a região da Amazônia Central possui status de piloto preliminarmente verificado. A janela amostral da Bacia do Congo permanece formalmente como candidata sob revisão técnica, garantindo transparência metodológica e reprodutibilidade científica.

---

## :material-shield-star: Os Quatro Pilares do SONATLAS

<div class="sonatlas-pillars-grid">
  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-satellite-variant:</span>
    <h3 class="sonatlas-pillar-title">1. Dados Científicos Reais da NASA</h3>
    <p class="sonatlas-pillar-text">
      Extraídos da missão <strong>GPM IMERG V07</strong> via NASA GES DISC. Distinguimos rigorosamente taxa instantânea ($\text{mm/h}$) de acumulação acumulada ($\text{mm}$). Células sem informação observacional são tratadas como <em>missing data</em> (com tom sonoro de alerta próprio), nunca mascaradas como chuva zero.
    </p>
  </div>

  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-waveform:</span>
    <h3 class="sonatlas-pillar-title">2. Sonificação Psicoacústica Calibrada</h3>
    <p class="sonatlas-pillar-text">
      A taxa média ponderada governa a <strong>frequência fundamental</strong> (pitch de 130 Hz a 880 Hz em escala logarítmica), enquanto a fração de área chuvosa modula a <strong>densidade rítmica de pulsos</strong> (de 1 a 7 pulsos por ciclo de 1,5s). Síntese paramétrica pura executada localmente no navegador via Web Audio API.
    </p>
  </div>

  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-human:</span>
    <h3 class="sonatlas-pillar-title">3. Acessibilidade Universal (WCAG 2.1 AA)</h3>
    <p class="sonatlas-pillar-text">
      Concebida sob a diretriz de operação orientada a áudio (tela desligada). Navegação por atalhos de teclado, canal centralizado <code>aria-live</code> para leitores de tela, síntese de voz opcional com descrição de períodos, três paletas adaptadas (Padrão, Daltonismo seguro Okabe-Ito e Monocromático) e modos de Alto Contraste.
    </p>
  </div>

  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-map-legend:</span>
    <h3 class="sonatlas-pillar-title">4. Cartografia Multissensorial</h3>
    <p class="sonatlas-pillar-text">
      Integração simultânea de mapa cartográfico 2D (Leaflet) com inspeção interativa de células da grade e Globo 3D interativo com textura oficial NASA Blue Marble. Os dados visuais e acústicos permanecem estritamente sincronizados a cada passo temporal de 30 minutos.
    </p>
  </div>
</div>

---

## :material-compass: Trilhas de Navegação Institucional

Documentação técnica, científica e institucional estruturada nas quatro áreas do portal:

<div class="sonatlas-grid">
  <a href="01-visao-produto/" class="sonatlas-card">
    <div class="sonatlas-card-number">Institucional &bull; 01</div>
    <div class="sonatlas-card-title">Visão do Produto</div>
    <div class="sonatlas-card-text">Origem, desafio Space Apps, público-alvo, objetivos estratégicos e proposta de valor.</div>
  </a>

  <a href="06-dados-cientificos/" class="sonatlas-card">
    <div class="sonatlas-card-number">Ciência &bull; 06</div>
    <div class="sonatlas-card-title">Dados Científicos NASA</div>
    <div class="sonatlas-card-text">Metodologia GPM IMERG, cadência de 30 min, ponderação geodésica cos(lat) e integridade de nulos.</div>
  </a>

  <a href="07-sonificacao/" class="sonatlas-card">
    <div class="sonatlas-card-number">Ciência &bull; 07</div>
    <div class="sonatlas-card-title">Sonificação Psicoacústica</div>
    <div class="sonatlas-card-text">Mapeamento físico-acústico, escala logarítmica de pitch, densidade temporal e tons de alerta.</div>
  </a>

  <a href="08-acessibilidade/" class="sonatlas-card">
    <div class="sonatlas-card-number">Acessibilidade &bull; 08</div>
    <div class="sonatlas-card-title">Inclusão e Baixa Visão</div>
    <div class="sonatlas-card-text">Diretrizes WCAG 2.1 AA (contraste AAA), canal aria-live, paleta Okabe-Ito e navegação sem tela.</div>
  </a>

  <a href="09-arquitetura/" class="sonatlas-card">
    <div class="sonatlas-card-number">Engenharia &bull; 09</div>
    <div class="sonatlas-card-title">Arquitetura de Software</div>
    <div class="sonatlas-card-text">Arquitetura desacoplada, Web Audio API, React 18, Leaflet, Three.js e pipeline Python.</div>
  </a>

  <a href="12-equipe/" class="sonatlas-card">
    <div class="sonatlas-card-number">Governança &bull; 12</div>
    <div class="sonatlas-card-title">Equipe e Governança</div>
    <div class="sonatlas-card-text">Equipe de desenvolvedores de software da UNICEPLAC e trajetória no NASA Space Apps Challenge.</div>
  </a>
</div>

---

## :material-school: Reconhecimento e Equipe

O **SONATLAS** foi concebido e implementado por uma equipe de estudantes de **Engenharia de Software** representando o **Centro Universitário UNICEPLAC** na etapa presencial de Brasília do **NASA Space Apps Challenge 2026**.

* **Equipe de Desenvolvimento:** UNICEPLAC Software Developers (SONATLAS Team)
* **Desafio Global:** *The Earth Information Jukebox*
* **Repositório de Código Aberto:** [github.com/sarahgleice/Sonatlas_nasa](https://github.com/sarahgleice/Sonatlas_nasa)
* **Aplicação Pública Oficial:** [sonatlas-nasa.vercel.app](https://sonatlas-nasa.vercel.app/)
* **Licença de Uso:** Código aberto sob a [Licença MIT](https://github.com/sarahgleice/Sonatlas_nasa/blob/main/LICENSE)

> :material-information-outline: **Aviso Institucional:**  
> O SONATLAS é um projeto independente desenvolvido por participantes do NASA Space Apps Challenge, não sendo um produto oficial da NASA ou da UNICEPLAC.
