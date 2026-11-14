---
title: Início — SONATLAS
description: Portal oficial de documentação do SONATLAS — Explore Earth Through Sound. NASA Space Apps Challenge 2026.
---

<div class="sonatlas-hero">
  <span class="sonatlas-hero-badge">NASA Space Apps Challenge 2026 &bull; The Earth Information Jukebox</span>
  <h1 class="sonatlas-hero-title">SONATLAS</h1>
  <p class="sonatlas-hero-slogan">Explore Earth Through Sound</p>
  <p class="sonatlas-hero-desc">
    Uma plataforma web científica e inclusiva que converte dados de satélite da NASA em experiências sonoras dinâmicas. Desenhada com prioridade para pessoas cegas ou com baixa visão, tornando os fenômenos atmosféricos da Terra auditíveis e compreensíveis para todos.
  </p>
  <div class="sonatlas-cta-group">
    <a href="01-visao-produto/" class="sonatlas-btn-primary">
      <span>Conhecer a Visão do Produto</span> &rarr;
    </a>
    <a href="07-sonificacao/" class="sonatlas-btn-secondary">
      <span>Como Funciona a Sonificação</span>
    </a>
    <a href="11-desenvolvimento/" class="sonatlas-btn-secondary">
      <span>Executar o Projeto</span>
    </a>
  </div>
</div>

---

## :material-compass-outline: Visão Rápida do Projeto

O **SONATLAS** nasceu para responder ao desafio global **The Earth Information Jukebox**, no âmbito do **NASA Space Apps Challenge 2026**. A iniciativa parte da constatação de que a divulgação e a exploração de dados científicos da Terra dependem quase exclusivamente de telas, globos 3D coloridos e representações visuais, excluindo pessoas com deficiência visual e subutilizando o potencial analítico da audição humana.

Transformamos séries temporais de precipitação da missão **NASA GPM / IMERG** em composições acústicas calibradas perceptivamente, combinadas com navegação cartográfica 2D acessível e audiodescrições detalhadas.

```mermaid
flowchart LR
    A["🛰️ NASA Earthdata<br/>GPM / IMERG V07"] --> B["⚙️ Processamento Python<br/>Cálculo de Indicadores Físicos"]
    B --> C["📄 JSON Padronizado<br/>Dicionário de Dados Estrito"]
    C --> D["🌐 Frontend Web Acessível<br/>React + Web Audio API + Leaflet"]
    D --> E["🔊 Sonificação Perceptiva<br/>Pitch (mm/h) + Ritmo (Área %)"]
    D --> F["♿ Acessibilidade Universal<br/>Leitor de Tela + Navegação por Teclado"]
    D --> G["🗺️ Cartografia 2D<br/>Limites Regionais em GeoJSON"]
```

---

## :material-target: Pilares Fundamentais

=== ":material-ear-hearing: Acessibilidade como Princípio Central"
    Projetado sob as diretrizes **W3C WCAG 2.1 (níveis AA e AAA)**. Toda a experiência de exploração dos dados independe do mapa visual: navegação 100% acionável por teclado, regiões `aria-live` sincronizadas, legendas sonoras de calibração e audiodescrições em linguagem natural.

=== ":material-chart-bell-curve: Rigor Científico e Transparência"
    Não inventamos números nem mascaramos incertezas. Distinguimos rigorosamente **taxa instantânea de precipitação (mm/h)** de **acumulação (mm)**. Dados faltantes (*missing data*) nunca são imputados como precipitação zero, preservando a integridade física dos dados observados.

=== ":material-earth: Comparação Bioclimática Global"
    Comparamos a dinâmica de precipitação de duas áreas tropicais essenciais:
    - **Região Nacional:** Amazônia Central (Brasil) &mdash; bacia florestal úmida de alta relevância climática planetária.
    - **Região Internacional:** Bacia do Congo (África Central) &mdash; *área candidata sob validação científica pela equipe*.

---

## :material-grid-large: Navegação Rápida pelo Portal

Explore as seções da documentação oficial do SONATLAS:

<div class="sonatlas-grid">
  <a href="01-visao-produto/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 01</div>
    <div class="sonatlas-card-title">Visão do Produto</div>
    <div class="sonatlas-card-text">Problema, oportunidade, objetivos geral e específicos, escopo do MVP e limites da solução.</div>
  </a>

  <a href="02-personas/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 02</div>
    <div class="sonatlas-card-title">Personas e Usuários</div>
    <div class="sonatlas-card-text">Perfis representativos hipotéticos: pessoa cega, estudante, educador e pesquisador científico.</div>
  </a>

  <a href="03-requisitos/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 03</div>
    <div class="sonatlas-card-title">Requisitos do Sistema</div>
    <div class="sonatlas-card-text">Requisitos funcionais (RF), não-funcionais (RNF), regras de negócio e matriz de prioridades.</div>
  </a>

  <a href="04-historias-usuario/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 04</div>
    <div class="sonatlas-card-title">Histórias de Usuário</div>
    <div class="sonatlas-card-text">Histórias ágeis divididas por épicos, com critérios de aceitação testáveis e rastreabilidade.</div>
  </a>

  <a href="05-metodologia/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 05</div>
    <div class="sonatlas-card-title">Metodologia e Planejamento</div>
    <div class="sonatlas-card-text">Contexto do Space Apps 2026, cronograma de sprints, marcos do MVP e responsabilidades da equipe.</div>
  </a>

  <a href="06-dados-cientificos/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 06</div>
    <div class="sonatlas-card-title">Dados Científicos</div>
    <div class="sonatlas-card-text">NASA GPM IMERG V07, tratamento de grandezas físicas, ponderação cosseno e ressalvas do EIC.</div>
  </a>

  <a href="07-sonificacao/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 07</div>
    <div class="sonatlas-card-title">Sonificação</div>
    <div class="sonatlas-card-text">Mapeamento psicoacústico: frequência tonal (mm/h), densidade rítmica (% de área) e legenda sonora.</div>
  </a>

  <a href="08-acessibilidade/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 08</div>
    <div class="sonatlas-card-title">Acessibilidade</div>
    <div class="sonatlas-card-text">Conformidade WCAG 2.1 AA/AAA, leitor de tela, foco de teclado e testes com tela desligada.</div>
  </a>

  <a href="09-arquitetura/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 09</div>
    <div class="sonatlas-card-title">Arquitetura e Tecnologias</div>
    <div class="sonatlas-card-text">Arquitetura desacoplada estática, stack tecnológica (React, Vite, Python) e fluxo de dados.</div>
  </a>

  <a href="10-testes/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 10</div>
    <div class="sonatlas-card-title">Testes e Validação</div>
    <div class="sonatlas-card-text">Estratégia de testes unitários, validações científicas, testes de acessibilidade e status atual.</div>
  </a>

  <a href="11-desenvolvimento/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 11</div>
    <div class="sonatlas-card-title">Desenvolvimento</div>
    <div class="sonatlas-card-text">Guia passo a passo de setup local, padrões de commit, branches e automação de CI/CD.</div>
  </a>

  <a href="12-equipe/" class="sonatlas-card">
    <div class="sonatlas-card-number">Seção 12</div>
    <div class="sonatlas-card-title">Equipe e Governança</div>
    <div class="sonatlas-card-text">Composição dos 5 desenvolvedores, matriz RACI de responsabilidades e rituais de colaboração.</div>
  </a>
</div>
