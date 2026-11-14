# 10. Testes e Validação da Solução

Este documento formaliza a estratégia de garantia de qualidade (QA) e validação do SONATLAS.

> :octicons-alert-16: **NOTA DE TRANSPARÊNCIA TÉCNICA:**  
> Em estrito cumprimento às diretrizes do projeto, diferenciamos explicitamente os testes **já implementados e executados**, os testes **em fase de implementação** e os testes **planejados para os próximos ciclos de validação**.

---

## 1. Matriz de Categorias de Testes e Status

| Categoria | Tipo de Teste | Alvo / Escopo | Ferramenta Utilizada | Status Atual |
|---|---|---|---|---|
| **Científico** | Validação de Indicadores | Cálculo de taxa média ($\text{mm/h}$) com ponderação cosseno e fração de área ($\text{RAF}$). | Pytest / NumPy | <span class="badge-verified">Implementado / Executado</span> |
| **Científico** | Integridade de Nulos | Verificação de que células sem dado não são tratadas como zero. | Pytest / DataValidator | <span class="badge-verified">Implementado / Executado</span> |
| **Sonificação** | Mapeamento Psicoacústico | Conversão de taxas em frequências e cobertura em densidade de pulsos. | Vitest (TypeScript) | <span class="badge-verified">Implementado / Executado</span> |
| **Frontend** | Formatação e Unidades | Formatação estrita de `mm/h`, porcentagem e rótulos de intensidade. | Vitest (TypeScript) | <span class="badge-verified">Implementado / Executado</span> |
| **Acessibilidade** | Navegação por Teclado | Tabulação, foco visível e atalhos globais de teclado sem mouse. | Teste Manual Heurístico | <span class="badge-review">Em Validação</span> |
| **Acessibilidade** | Leitor de Tela | Transmissão de estados e anúncios via canal `aria-live`. | NVDA / VoiceOver | <span class="badge-review">Em Validação</span> |
| **Integração** | Esteira de CI/CD | Instalação, verificação de tipos TypeScript, compilação e build da documentação. | GitHub Actions | <span class="badge-verified">Configurado / Ativo</span> |
| **Usabilidade** | Teste com Usuários Reais | Sessões qualitativas com pessoas cegas ou com baixa visão. | Protocolo Heurístico | <span class="badge-planned">Planejado (Sprint 3)</span> |

---

## 2. Testes Científicos e de Dados (Python)

### 2.1. Teste T-SCI-01: Ponderação pela Área da Célula
- **Objetivo:** Verificar se a taxa média calculada aplica o fator $\cos(\text{latitude})$ para cada linha da matriz.
- **Implementação:** Arquivo `processing/tests/test_indicators.py`.
- **Critério de Validação:** Em uma matriz de 2x2 com valores conhecidos, a média ponderada deve coincidir com a solução analítica matemática com tolerância de $0.01$.

### 2.2. Teste T-SCI-02: Preservação de Dados Ausentes (*Missing Data*)
- **Objetivo:** Assegurar que valores sentinela (ex: $-9999.9$) ou valores `NaN` não sejam convertidos inadvertidamente para $0.0 \text{ mm/h}$.
- **Implementação:** Arquivo `processing/tests/test_indicators.py`.
- **Critério de Validação:** Matriz preenchida exclusivamente com sentinelas deve retornar `mean_rate = None` e `valid_ratio = 0.0`. O teste falha imediatamente se o retorno for numérico.

### 2.3. Teste T-SCI-03: Validação de Unidades e Schema JSON
- **Objetivo:** Rejeitar datasets que utilizem unidades incorretas (ex: `"mm"` em vez de `"mm/h"` para taxa) ou que atribuam valor numérico a observações marcadas como `"status": "missing"`.
- **Implementação:** Arquivo `processing/tests/test_validation.py`.
- **Critério de Validação:** A classe `DataValidator.validate_dataset()` deve retornar lista detalhada de erros caso ocorra violação de regras de negócio.

---

## 3. Testes de Sonificação e Mapeamento (Frontend)

### 3.1. Teste T-AUD-01: Resposta a Valores Nulos e Limiares
- **Objetivo:** Garantir que valores ausentes gerem a frequência de alerta (`FREQ_ALERT = 300 Hz`) e valores abaixo do limiar gerem tom de repouso (`FREQ_REST = 130 Hz`).
- **Implementação:** Arquivo `frontend/tests/audioMapping.test.ts`.
- **Critério de Validação:** `mapRateToFrequency(null)` retorna 300 Hz e `mapRateToFrequency(0.0)` retorna 130 Hz.

### 3.2. Teste T-AUD-02: Crescimento Monotônico da Frequência
- **Objetivo:** Verificar se taxas crescentes de chuva produzem frequências fundamentais estritamente crescentes dentro da faixa audível confortável ($220 \text{ Hz} \le f \le 880 \text{ Hz}$).
- **Implementação:** Arquivo `frontend/tests/audioMapping.test.ts`.
- **Critério de Validação:** $f(2.0) < f(10.0) < f(40.0)$, com todos os valores contidos no intervalo de conformidade.

---

## 4. Testes de Acessibilidade e Interface

### 4.1. Teste T-ACC-01: Operabilidade de Foco por Teclado
- **Escopo:** Interface gráfica React completa.
- **Procedimento:** Pressionar a tecla `Tab` repetidamente e atestar visualmente que todos os botões e links recebem a borda ciano de foco (`focus-visible`).
- **Critério:** Nenhum botão perde o indicador de foco e a tecla `Espaço` alterna a reprodução sonora.

### 4.2. Teste T-ACC-02: Sincronização com Leitores de Tela (NVDA)
- **Escopo:** Componente `AriaLiveAnnouncer.tsx`.
- **Procedimento:** Inicializar o NVDA e alternar passos temporais no player.
- **Critério:** O NVDA deve ler de maneira inteligível o anúncio contendo passo, data/hora e valores meteorológicos sem atropelar a fala anterior.

### 4.3. Testes automatizados do player e da acessibilidade (Vitest, ambiente Node)
Executados com `npm run test` em `frontend/`, sem dependências extras (funções puras e `renderToStaticMarkup`):

| Arquivo | Cobertura |
|---|---|
| `announcements.test.ts` | Política anti-spam: slider silencioso, alerta só ao entrar em dado ausente, nunca "0 mm/h" para ausente |
| `scientificExplanation.test.ts` | "Entenda o que você ouviu": linha de base, subida, queda, estável, zero exato, pós-ausência, série real |
| `playerLogic.test.ts` | Próximo/anterior com e sem repetição, fim de série, velocidade sem alterar frequência/pulsos |
| `shortcuts.test.ts` | Espaço não interceptado em botões; slider; modificadores; `?` via AltGr |
| `timeline.test.tsx` | Teclado do slider, `aria-valuetext`, marcadores decorativos, ausente vs zero, multi-dia |
| `audioPlayer.test.tsx`, `soundLegend.test.tsx`, `scientificSummary.test.tsx`, `regionSelector.test.tsx`, `shortcutsModal.test.tsx`, `ariaLiveAnnouncer.test.tsx` | Marcação acessível (rótulos, `aria-pressed`, `aria-disabled`, seções, canais live) |

**Limite conhecido:** timers do hook, foco real e leitura por NVDA/VoiceOver não são cobertos sem jsdom; seguem o roteiro manual de olhos fechados da seção de acessibilidade.

---

## 5. Próximas Etapas de Validação (Planejadas)

1. **Sessões com Usuários da Comunidade:** Planejadas para a Sprint 3, com foco em usabilidade auditiva com pessoas cegas e com baixa visão.
2. **Homologação da Segunda Região Internacional:** Validação do grânulo oficial IMERG da Bacia do Congo junto a mentores do desafio da NASA.
