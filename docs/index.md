---
title: Início — SONATLAS
description: Portal institucional e científico oficial do SONATLAS — Explore Earth Through Sound. NASA Space Apps Challenge 2026.
---

<div class="sonatlas-banner-container">
  <img src="assets/images/sonatlas-hero-banner.jpg" alt="SONATLAS: Planeta Terra iluminado do espaço, envolto por ondas sonoras orbitais em tons neon ciano e púrpura, com o título 'SONATLAS — Explore Earth Through Sound'" class="sonatlas-banner-img" />
</div>

<div class="sonatlas-hero">
  <span class="sonatlas-hero-badge">
    :material-rocket-launch: NASA Space Apps Challenge 2026 &bull; The Earth Information Jukebox
  </span>
  <h1 class="sonatlas-hero-title">SONATLAS</h1>
  <p class="sonatlas-hero-slogan">Explore Earth Through Sound</p>
  <p class="sonatlas-hero-desc">
    Uma plataforma científica e inclusiva que transforma dados de satélite da NASA em experiências auditivas dinâmicas e calibradas. Concebida sob os princípios do <strong>Design Universal</strong>, com foco prioritário em pessoas cegas ou com baixa visão, tornando os fenômenos atmosféricos do planeta perceptíveis, mensuráveis e compreensíveis para todos.
  </p>
  <div class="sonatlas-cta-group">
    <a href="https://sonatlas.vercel.app/" target="_blank" rel="noopener noreferrer" class="sonatlas-btn-primary">
      <span>Acessar a Aplicação Web</span> &rarr;
    </a>
    <a href="06-dados-cientificos/" class="sonatlas-btn-secondary">
      <span>Metodologia Científica</span>
    </a>
    <a href="07-sonificacao/" class="sonatlas-btn-secondary">
      <span>Como Funciona a Sonificação</span>
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
    <div class="sonatlas-stat-desc">Síntese paramétrica pura em tempo real via Web Audio API, sem streaming de arquivos de áudio.</div>
  </div>

  <div class="sonatlas-stat-card">
    <div class="sonatlas-stat-number">2 Regiões</div>
    <div class="sonatlas-stat-label">Estudo Tropical</div>
    <div class="sonatlas-stat-desc">Amazônia Central (piloto verificada) e Bacia do Congo (Kisangani, candidata sob revisão).</div>
  </div>
</div>

---

## :material-lightbulb-on: Propósito Científico e Inclusivo

O **SONATLAS** nasceu para responder ao desafio global **The Earth Information Jukebox**, no âmbito do **NASA Space Apps Challenge 2026**.

Historicamente, a divulgação e a exploração de dados científicos de observação da Terra dependem quase exclusivamente de telas brilhantes, mapas de calor coloridos (*colormaps*) e globos 3D interativos. Esse paradigma hegemônico cria uma barreira intransponível para mais de **2,2 bilhões de pessoas com deficiência visual** no mundo (OMS), além de subutilizar a excepcional capacidade temporal do cérebro humano para analisar padrões rítmicos através da audição.

Combinamos **satélites meteorológicos da NASA**, **engenharia de software moderna**, **psicoacústica paramétrica** e **design acessível** para transformar dados numéricos de precipitação em uma narrativa multissensorial completa.

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

## :material-shield-star: Os Quatro Pilares do SONATLAS

<div class="sonatlas-pillars-grid">
  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-satellite-variant:</span>
    <h3 class="sonatlas-pillar-title">1. Dados Científicos Reais da NASA</h3>
    <p class="sonatlas-pillar-text">
      Extraídos da missão global <strong>GPM (Global Precipitation Measurement) IMERG V07</strong>. Distinguimos rigorosamente taxa instantânea (mm/h) de precipitação acumulada (mm). Células sem informação observacional são tratadas estritamente como <em>missing data</em> (com tom de alerta próprio), nunca mascaradas artificialmente como chuva zero.
    </p>
  </div>

  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-waveform:</span>
    <h3 class="sonatlas-pillar-title">2. Sonificação Psicoacústica Calibrada</h3>
    <p class="sonatlas-pillar-text">
      A taxa média de precipitação determina a <strong>frequência fundamental</strong> (pitch de 130 Hz a 880 Hz em escala logarítmica), enquanto a fração de área chuvosa governa a <strong>densidade rítmica de pulsos</strong> (de 1 a 7 pulsos por janela de 1,5s). O áudio é sintetizado diretamente no navegador, sem arquivos de áudio pré-gravados.
    </p>
  </div>

  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-human:</span>
    <h3 class="sonatlas-pillar-title">3. Acessibilidade Universal (WCAG 2.1 AA)</h3>
    <p class="sonatlas-pillar-text">
      Concebida sob o lema <em>"Funciona com a tela desligada"</em>, priorizando pessoas com baixa visão e cegueira. Suporte a leitores de tela com canal centralizado <code>aria-live</code> polite, navegação 100% por atalhos de teclado, legenda sonora de calibração auditiva e <strong>três paletas visuais adaptadas (Padrão, Daltonismo seguro via paleta Okabe-Ito e Monocromático), combináveis com modo de Alto Contraste</strong> (atingindo contraste de até 21:1 na aplicação e 14,2:1 no destaque ciano do portal).
    </p>
  </div>

  <div class="sonatlas-pillar-card">
    <span class="sonatlas-pillar-icon">:material-earth:</span>
    <h3 class="sonatlas-pillar-title">4. Cartografia e Duas Regiões Tropicais</h3>
    <p class="sonatlas-pillar-text">
      Exploração de duas regiões de alta relevância climática: a <strong>Amazônia Central</strong> (Brasil, região piloto preliminarmente verificada com 12 passos temporais) e a <strong>Bacia do Congo</strong> (janela amostral de Kisangani, em avaliação sob revisão técnica com 6 passos). Visualização 2D com Leaflet e Globo 3D interativo com textura Blue Marble oficial da NASA.
    </p>
  </div>
</div>

---

## :material-compass: Trilhas de Navegação no Portal

Explore a documentação técnica, científica e institucional organizada por áreas de interesse:

<div class="sonatlas-grid">
  <a href="01-visao-produto/" class="sonatlas-card">
    <div class="sonatlas-card-number">Institucional &bull; 01</div>
    <div class="sonatlas-card-title">Visão do Produto</div>
    <div class="sonatlas-card-text">Origem, desafio Space Apps, público-alvo, objetivos estratégicos, escopo do produto e proposta de valor.</div>
  </a>

  <a href="06-dados-cientificos/" class="sonatlas-card">
    <div class="sonatlas-card-number">Ciência &bull; 06</div>
    <div class="sonatlas-card-title">Dados Científicos NASA</div>
    <div class="sonatlas-card-text">Metodologia GPM IMERG, resolução temporal de 30 min, ponderação geodésica cos(lat) e integridade de nulos.</div>
  </a>

  <a href="07-sonificacao/" class="sonatlas-card">
    <div class="sonatlas-card-number">Ciência &bull; 07</div>
    <div class="sonatlas-card-title">Metodologia de Sonificação</div>
    <div class="sonatlas-card-text">Modelo matemático de conversão física em acústica, escala psicoacústica e tom de advertência de nulos.</div>
  </a>

  <a href="08-acessibilidade/" class="sonatlas-card">
    <div class="sonatlas-card-number">Inclusão &bull; 08</div>
    <div class="sonatlas-card-title">Acessibilidade e Baixa Visão</div>
    <div class="sonatlas-card-text">Diretrizes WCAG 2.1 AA (contraste AAA), canal aria-live, paleta Okabe-Ito, atalhos de teclado e testes sem tela.</div>
  </a>

  <a href="09-arquitetura/" class="sonatlas-card">
    <div class="sonatlas-card-number">Engenharia &bull; 09</div>
    <div class="sonatlas-card-title">Arquitetura de Software</div>
    <div class="sonatlas-card-text">Estrutura desacoplada, Web Audio API, React 18, Leaflet, Three.js, pipeline Python e segurança de dados.</div>
  </a>

  <a href="12-equipe/" class="sonatlas-card">
    <div class="sonatlas-card-number">Governança &bull; 12</div>
    <div class="sonatlas-card-title">Equipe e Reconhecimento</div>
    <div class="sonatlas-card-text">Conheça o time de desenvolvedores de software da UNICEPLAC e a trajetória no NASA Space Apps Challenge.</div>
  </a>
</div>

---

## :material-school: Reconhecimento e Equipe

O **SONATLAS** foi concebido e implementado por uma equipe de estudantes de **Engenharia de Software** representando o **Centro Universitário UNICEPLAC** na etapa presencial de Brasília do **NASA Space Apps Challenge 2026**.

* **Equipe de Desenvolvimento:** UNICEPLAC Software Developers (SONATLAS Team)
* **Desafio Global:** *The Earth Information Jukebox*
* **Repositório de Código Aberto:** [github.com/sarahgleice/Sonatlas_nasa](https://github.com/sarahgleice/Sonatlas_nasa)
* **Aplicação Pública Oficial:** [sonatlas.vercel.app](https://sonatlas.vercel.app/)
* **Licença de Uso:** Código aberto sob a [Licença MIT](https://github.com/sarahgleice/Sonatlas_nasa/blob/main/LICENSE)

> :material-information-outline: **Aviso Institucional:**  
> O SONATLAS é um projeto independente desenvolvido por participantes do NASA Space Apps Challenge, não sendo um produto oficial da NASA ou da UNICEPLAC.
