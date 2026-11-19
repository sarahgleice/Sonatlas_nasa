# 12. Equipe e Governança

O **SONATLAS** é desenvolvido pela equipe **UNICEPLAC Software Developers** para o **NASA Space Apps Challenge 2026**, concorrendo no desafio global *The Earth Information Jukebox*.

A equipe representa formalmente o **Centro Universitário do Planalto Central Apparecido dos Santos (UNICEPLAC)** na etapa presencial de Brasília, Distrito Federal, unindo engenharia de software, sensoriamento remoto espacial, acústica computacional e design universal acessível.

---

## 1. Quadro de Integrantes e Papéis

<div class="sonatlas-grid">
  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 01 &bull; Liderança de Interface e UX/UI</div>
    <div class="sonatlas-card-title">Sarah Gleice &bull; Lead Developer</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenheira de Frontend Core, Arquitetura e UX/UI Acessível.<br/>
      <strong>GitHub:</strong> <a href="https://github.com/sarahgleice" target="_blank" rel="noopener">@sarahgleice</a><br/>
      <strong>Domínio Principal:</strong> Componentes React, Jukebox Player, navegação responsiva, modos de contraste e coordenação geral.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 02 &bull; Liderança Geoespacial</div>
    <div class="sonatlas-card-title">Engenharia Geoespacial</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenharia Geoespacial e Cartografia 2D Interativa.<br/>
      <strong>GitHub:</strong> <code>UNICEPLAC Software Developers</code><br/>
      <strong>Domínio Principal:</strong> Visualização Leaflet, malhas GeoJSON (750 células 0.1°), reprojeção e alternativas descritivas semânticas.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 03 &bull; Liderança de Áudio</div>
    <div class="sonatlas-card-title">Sonificação Científica</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenharia de Áudio e Psicoacústica Computacional.<br/>
      <strong>GitHub:</strong> <code>UNICEPLAC Software Developers</code><br/>
      <strong>Domínio Principal:</strong> Web Audio API, síntese subtrativa/FM de osciladores, mapeamento logarítmico (130–880 Hz) e legenda auditiva.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 04 &bull; Liderança Científica</div>
    <div class="sonatlas-card-title">Ciência de Dados & Sensoriamento</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenharia de Dados e Validação de Satélites.<br/>
      <strong>GitHub:</strong> <code>UNICEPLAC Software Developers</code><br/>
      <strong>Domínio Principal:</strong> Pipeline Python, ingestão NASA IMERG V07, ponderação por cosseno da latitude e preservação estrita de nulos.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 05 &bull; Liderança de Acessibilidade & QA</div>
    <div class="sonatlas-card-title">Acessibilidade Digital & QA</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Especialista em Acessibilidade W3C WCAG 2.1 e Qualidade de Software.<br/>
      <strong>GitHub:</strong> <code>UNICEPLAC Software Developers</code><br/>
      <strong>Domínio Principal:</strong> Conformidade WCAG 2.1 AA/AAA, leitores de tela (NVDA/JAWS), canais `aria-live`, suíte de testes automatizados e CI/CD.
    </div>
  </div>
</div>

---

## 2. Detalhamento de Responsabilidades por Módulo

| Integrante / Domínio | Módulos Técnicos Sob Custódia | Entregas Principais |
|---|---|---|
| **Sarah Gleice (Frontend & Lead)** | `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/styles/` | - Layout responsivo da aplicação web.<br>- Componentes do Player de áudio e Timeline.<br>- Modos de alto contraste e filtros daltônicos. |
| **Engenharia Geoespacial** | `frontend/src/maps/`, `processing/geometry/` | - Visualizador cartográfico Leaflet 2D desacoplado.<br>- Geometrias GeoJSON da Amazônia Central e Bacia do Congo.<br>- Alternativas semânticas de mapa para leitores de tela. |
| **Sonificação Científica** | `frontend/src/audio/`, `docs/07-sonificacao/` | - Mapeamento paramétrico de taxa para frequência e área para densidade.<br>- Motor nativo de áudio Web Audio API com resiliência a suspensões.<br>- Legenda sonora de calibração auditiva. |
| **Ciência de Dados & Sensoriamento** | `processing/`, `docs/06-dados-cientificos/` | - Scripts de ingestão NASA Earthdata IMERG V07.<br>- Ponderação de área por $\cos(\text{lat})$ e cálculo de indicadores.<br>- Validador formal de integridade e exportação JSON determinística. |
| **Acessibilidade Digital & QA** | `frontend/src/accessibility/`, `.github/`, `docs/` | - Conformidade W3C WCAG 2.1 AA/AAA (contraste 14.2:1).<br>- Comunicação `aria-live` reativa centralizada.<br>- Pipeline de CI/CD (GitHub Actions) e portal de documentação MkDocs. |

---

## 3. Dinâmica Institucional e Governança

- **Instituição Acadêmica:** Centro Universitário do Planalto Central Apparecido dos Santos (UNICEPLAC) &bull; Faculdade de Engenharia de Software.
- **Hackathon Global:** NASA Space Apps Challenge 2026 &bull; Polo Brasília, Distrito Federal (Etapa Presencial).
- **Desafio:** *The Earth Information Jukebox*.
- **Repositório Oficial:** [github.com/sarahgleice/Sonatlas_nasa](https://github.com/sarahgleice/Sonatlas_nasa)
- **Portal Institucional de Documentação:** [sarahgleice.github.io/Sonatlas_nasa](https://sarahgleice.github.io/Sonatlas_nasa/)
- **Aplicação Web (Demonstração):** [sonatlas.vercel.app](https://sonatlas.vercel.app/)
- **Resolução de Conflitos Técnicos:** Decisões que impactem a integridade científica ou a acessibilidade prioritária têm prevalência sobre escolhas puramente cosméticas.
