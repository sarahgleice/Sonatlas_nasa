# Guia de Contribuição — SONATLAS

Bem-vindo ao projeto **SONATLAS — Explore Earth Through Sound**, desenvolvido para o **NASA Space Apps Challenge 2026** (Desafio: *The Earth Information Jukebox*).

Este guia define os padrões e fluxos de trabalho para a equipe de 5 desenvolvedores, garantindo qualidade, consistência e rastreabilidade técnica e científica.

---

## 1. Organização dos Papéis da Equipe

A equipe é organizada com responsabilidades bem delimitadas:
1. **Engenheiro Frontend / UI/UX:** Responsável pela interface, páginas, componentes visuais e estados do player.
2. **Engenheiro Geoespacial / Mapas:** Responsável pelas camadas de mapa Leaflet, suporte a GeoJSON e sincronização espacial.
3. **Engenheiro de Áudio / Sonificação:** Responsável pela síntese via Web Audio API / Tone.js e pelo mapeamento paramétrico perceptivo.
4. **Engenheiro Científico / Dados (Python):** Responsável pela extração IMERG/GPM, validação, cálculo de indicadores e exportação JSON.
5. **Engenheiro de Acessibilidade & QA:** Responsável por conformidade WCAG 2.1 AA/AAA, leitor de tela, atalhos de teclado e testes automatizados.

---

## 2. Padrões de Branches

Trabalhamos no modelo GitHub Flow adaptado:

- `main`: Ramo estável de produção. Apenas aceita merges via Pull Request revisado e aprovado no CI.
- `feature/<nome-da-funcionalidade>`: Para desenvolvimento de novas funcionalidades.  
  *Exemplo:* `feature/audio-pulse-generator`, `feature/leaflet-region-selector`
- `fix/<nome-do-ajuste>`: Para correção de problemas identificados.  
  *Exemplo:* `fix/missing-data-handling`, `fix/aria-live-announcements`
- `docs/<nome-da-documentacao>`: Para atualizações de documentação e diagramas.  
  *Exemplo:* `docs/sonification-specs`, `docs/data-dictionary-update`

---

## 3. Padrões de Commits

Utilizamos a convenção **Conventional Commits**:

```bash
<tipo>(<escopo opcional>): <descrição sucinta em português ou inglês>
```

### Tipos Permitidos:
- `feat`: Nova funcionalidade para o usuário ou módulo.
- `fix`: Correção de bug ou erro em cálculo/áudio/UI.
- `docs`: Alterações exclusivamente na documentação ou comentários.
- `refactor`: Mudança no código que não altera comportamento nem adiciona funcionalidade.
- `test`: Adição ou modificação de testes automatizados.
- `chore`: Atualização de tarefas de build, dependências ou configurações.

### Exemplos:
- `feat(audio): implementar mapeamento de taxa de precipitacao para frequencia de onda`
- `fix(processing): evitar imputacao de precipitacao zero para celulas sem dado`
- `docs(science): detalhar diferenciacao entre mm/h e mm acumulado`

---

## 4. Regras Científicas e de Escopo Obrigatórias

1. **Integridade de Dados:** É expressamente proibido inventar valores científicos ou usar geradores randômicos não identificados. Dados de teste devem estar rotulados como `is_sample: true` ou `status: "sample_placeholder"`.
2. **Tratamento de Dados Ausentes:** Células sem medição ou com flags de erro NÃO podem ser convertidas em zero mm/h. Elas devem ser computadas no indicador de disponibilidade e tratadas como `null`/`NaN`.
3. **Diferenciação de Unidades:** Não misture taxa de precipitação (`mm/h`) com precipitação acumulada (`mm`). Toda visualização e áudio devem declarar explicitamente a unidade.
4. **Limites de Escopo do MVP:** Não incluir autenticação, bancos de dados SQL/NoSQL, IA generativa ou sonificação polifônica orquestral excessiva. O globo 3D é uma visualização opcional, sem substituir o mapa Leaflet nem a alternativa 2D.

---

## 5. Fluxo de Pull Request (PR) e Code Review

1. Abra a branch a partir da `main` atualizada.
2. Certifique-se de que testes locais e linters passam com sucesso:
   ```bash
   # No frontend:
   cd frontend
   npm run test
   npm run build

   # No processing:
   pytest processing/tests
   ```
3. Abra um Pull Request utilizando o template oficial (`.github/PULL_REQUEST_TEMPLATE.md`).
4. Solicite a revisão de pelo menos **um revisor técnico** (ex: quem cuida de áudio revisa áudio; quem cuida de ciência revisa indicadores).
5. O merge só deve ocorrer após aprovação do revisor e aprovação de todos os checks no GitHub Actions.
