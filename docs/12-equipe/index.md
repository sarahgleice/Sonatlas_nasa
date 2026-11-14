# 12. Equipe e Governança

O SONATLAS é desenvolvido por uma equipe multidisciplinar de cinco desenvolvedores para o **NASA Space Apps Challenge 2026**, no desafio *The Earth Information Jukebox*.

> :octicons-pencil-16: **NOTA DE EDIÇÃO:**  
> Os campos abaixo contêm a estrutura de papéis e responsabilidades formalmente atribuídas no projeto, mantendo os nomes e contatos pessoais abertos para preenchimento posterior pelos próprios integrantes.

---

## 1. Quadro de Integrantes e Papéis

<div class="sonatlas-grid">
  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 01 &bull; Liderança de Interface</div>
    <div class="sonatlas-card-title">[Nome do Integrante 1]</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenheiro(a) de Frontend Core e UX/UI.<br/>
      <strong>GitHub:</strong> <code>@username-a-definir</code><br/>
      <strong>Domínio Principal:</strong> Componentes React, Jukebox Player, navegação e estilos de alto contraste.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 02 &bull; Liderança Geoespacial</div>
    <div class="sonatlas-card-title">[Nome do Integrante 2]</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenheiro(a) Geoespacial e Cartografia 2D.<br/>
      <strong>GitHub:</strong> <code>@username-a-definir</code><br/>
      <strong>Domínio Principal:</strong> Integração Leaflet, camadas GeoJSON e sincronização espacial.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 03 &bull; Liderança de Áudio</div>
    <div class="sonatlas-card-title">[Nome do Integrante 3]</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenheiro(a) de Áudio e Sonificação Científica.<br/>
      <strong>GitHub:</strong> <code>@username-a-definir</code><br/>
      <strong>Domínio Principal:</strong> Web Audio API, síntese de osciladores, modulações de ganho e calibração tonal.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 04 &bull; Liderança Científica</div>
    <div class="sonatlas-card-title">[Nome do Integrante 4]</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Engenheiro(a) de Dados e Cientista de Sensoriamento Remoto.<br/>
      <strong>GitHub:</strong> <code>@username-a-definir</code><br/>
      <strong>Domínio Principal:</strong> Pipeline Python, ingestão NASA IMERG, cálculo de indicadores e preservação de nulos.
    </div>
  </div>

  <div class="sonatlas-card">
    <div class="sonatlas-card-number">Dev 05 &bull; Liderança de Acessibilidade & QA</div>
    <div class="sonatlas-card-title">[Nome do Integrante 5]</div>
    <div class="sonatlas-card-text">
      <strong>Papel:</strong> Especialista em Acessibilidade Digital (WCAG) e QA.<br/>
      <strong>GitHub:</strong> <code>@username-a-definir</code><br/>
      <strong>Domínio Principal:</strong> Leitores de tela (NVDA/JAWS), canais aria-live, testes unitários e CI/CD.
    </div>
  </div>
</div>

---

## 2. Detalhamento de Responsabilidades por Módulo

| Integrante | Módulos Técnicos Sob Custódia | Entregas Principais |
|---|---|---|
| **Dev 01 (Frontend)** | `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/styles/` | - Layout responsivo da aplicação.<br>- Componentes do Player de áudio e Timeline.<br>- Tema de alto contraste escuro. |
| **Dev 02 (Geoespacial)** | `frontend/src/maps/`, `processing/geometry/` | - Visualizador cartográfico Leaflet 2D.<br>- Geometrias GeoJSON da Amazônia Central e Bacia do Congo.<br>- Alternativas semânticas de mapa. |
| **Dev 03 (Áudio)** | `frontend/src/audio/`, `docs/07-sonificacao/` | - Mapeamento paramétrico de taxa para frequência e área para pulsos.<br>- Motor nativo de áudio Web Audio API.<br>- Legenda sonora de calibração auditiva. |
| **Dev 04 (Dados/Ciência)** | `processing/`, `docs/06-dados-cientificos/` | - Scripts de ingestão NASA Earthdata IMERG.<br>- Algoritmos de média ponderada por cosseno da latitude.<br>- Validador formal de integridade e exportação JSON. |
| **Dev 05 (Acessibilidade/QA)** | `frontend/src/accessibility/`, `.github/`, `docs/` | - Conformidade W3C WCAG 2.1 AA/AAA.<br>- Comunicação `aria-live` centralizada.<br>- Pipeline de CI/CD e portal de documentação MkDocs. |

---

## 3. Dinâmica de Trabalho e Decisão

- **Comunicação Central:** Servidor da equipe no Discord para reuniões síncronas de alinhamento e canais temáticos por frente técnica (`#frontend`, `#audio`, `#dados-ciencia`, `#acessibilidade`).
- **Gestão de Tarefas:** GitHub Projects com quadro Kanban unificado, vinculando cada tarefa a uma Issue padronizada (`.github/ISSUE_TEMPLATE/`).
- **Resolução de Conflitos Técnicos:** Decisões que impactem a integridade científica ou a acessibilidade prioritária têm prevalência sobre escolhas puramente cosméticas.
