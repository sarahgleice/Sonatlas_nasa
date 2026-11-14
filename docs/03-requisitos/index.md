# 03. Requisitos do Sistema

Este documento formaliza a matriz de requisitos funcionais (RF), requisitos não funcionais (RNF), regras de negócio (RN) e restrições técnicas do SONATLAS. Cada requisito contém identificador único, prioridade, critérios de validação e rastreabilidade direta com as histórias de usuário.

---

## 1. Requisitos Funcionais (RF)

| ID | Nome do Requisito | Descrição Detalhada | Prioridade | Critério de Validação | Histórias Relacionadas |
|---|---|---|---|---|---|
| **RF01** | Apresentação do Produto | O sistema deve disponibilizar uma página inicial que apresente o nome, slogan, objetivos, contexto do Space Apps e visão geral do SONATLAS. | **Alta** | Verificação visual e estrutural do cabeçalho semântico e hero section. | US01 |
| **RF02** | Catálogo de Regiões | O sistema deve exibir as regiões de estudo disponíveis, diferenciando áreas ativas com dados daquelas sob validação. | **Alta** | Renderização correta da lista no seletor e no mapa. | US02, US16 |
| **RF03** | Seleção de Regiões | O sistema deve permitir a seleção de regiões tanto pelo mapa 2D quanto por controle textual acessível (`<select>`). | **Crítica** | Alternância imediata da região via teclado e mouse com recarga de dados. | US03, US12 |
| **RF04** | Consulta de Informações da Região | O sistema deve exibir os dados cadastrais da região: nome, país, coordenadas delimitadoras (*bounding box*) e status. | **Média** | Presença das coordenadas e metadados no painel textual. | US04 |
| **RF05** | Carregamento de Dados | O sistema deve carregar séries temporais em formato JSON estruturado conforme o contrato do dicionário de dados. | **Crítica** | Requisição assíncrona com tratamento gracioso de falha e validação de schema. | US05 |
| **RF06** | Consulta de Observações | O sistema deve permitir consultar as observações de precipitação contidas na série temporal da região ativa. | **Alta** | Listagem correta dos passos temporais disponíveis na interface. | US05, US18 |
| **RF07** | Cálculo de Indicadores | O pipeline deve calcular a taxa média ponderada pelo cosseno da latitude ($\text{mm/h}$), a fração de área com chuva ($\%$) e a variabilidade temporal ($\Delta R$). | **Crítica** | Testes unitários no Pytest comparando cálculos numéricos com limites analíticos. | US06 |
| **RF08** | Navegação Temporal | O sistema deve permitir alternar entre observações temporais por meio de botões da linha do tempo, botões de passo e setas do teclado. | **Alta** | Atualização instantânea dos indicadores ao mudar o passo temporal. | US07, US18 |
| **RF09** | Geração Dinâmica de Áudio | O sistema deve sintetizar áudio em tempo real via Web Audio API, mapeando taxa média em frequência tonal e cobertura em repetição rítmica de pulsos. | **Crítica** | Emissão sonora com latência < 50 ms sem estalos acústicos (envoltória ADSR suave). | US08, US20 |
| **RF10** | Controles de Reprodução | O sistema deve disponibilizar controles para reproduzir (*Play*), pausar (*Pause*), avançar, retroceder e silenciar (*Mute*). | **Crítica** | Resposta imediata dos botões e dos atalhos globais de teclado (`Espaço`, `Setas`, `M`). | US09, US19 |
| **RF11** | Legenda Sonora de Calibração | O sistema deve oferecer botões de áudio para calibração prévia dos níveis de chuva (leve, moderada, tempestade) e do aviso de dados ausentes. | **Alta** | Execução de amostras canônicas isoladas de 1.5s com rótulos explicativos. | US10 |
| **RF12** | Explicação Textual dos Indicadores | O sistema deve apresentar descrições em linguagem natural resumindo a intensidade e a extensão da precipitação para cada observação. | **Alta** | Presença de texto descritivo atualizado sincronizadamente com o passo sonoro. | US11 |
| **RF13** | Acessibilidade por Teclado e Leitor | O sistema deve permitir a operação 100% via teclado e anunciar mudanças de estado por meio de uma região com `aria-live="polite"`. | **Crítica** | Teste prático com NVDA ativo e tela desligada, com 100% de compreensão dos dados. | US12, US13 |
| **RF14** | Tratamento de Dados Ausentes | O sistema deve identificar passos temporais com dados de satélite ausentes, emitindo tom acústico dissonante e texto explícito de indisponibilidade. | **Crítica** | Células com falha geram valor `null` no JSON (nunca `0.0 mm/h`) e tom de alerta. | US14 |
| **RF15** | Consulta a Fontes Científicas | O sistema deve informar claramente o satélite, produto (NASA GPM IMERG V07), resolução espacial e links para a metodologia oficial. | **Média** | Exibição de metadados no rodapé e link para o portal de documentação. | US15 |
| **RF16** | Comparação de Regiões | O sistema deve permitir comparar indicadores de regiões distintas quando os dados forem cientificamente compatíveis e validados. | **Baixa** | Validação prévia de compatibilidade de unidades e resoluções antes da exibição. | US17 |
| **RF17** | Visualização Cartográfica 2D | O sistema deve renderizar o mapa 2D via Leaflet com a delimitação geográfica da *bounding box* em camada GeoJSON. | **Média** | Renderização correta do polígono com atributo `aria-hidden="true"`. | US04 |

---

## 2. Requisitos Não Funcionais (RNF)

| ID | Categoria | Descrição | Métrica / Meta | Prioridade | Histórias Relacionadas |
|---|---|---|---|---|---|
| **RNF01** | **Acessibilidade** | Conformidade com as diretrizes W3C WCAG 2.1 nos níveis AA e critérios seletos de nível AAA. | Pontuação Lighthouse >= 95 e 0 violações críticas em auditoria com axe-core. | **Crítica** | US03, US12, US13 |
| **RNF02** | **Usabilidade** | Interface intuitiva e clara, com modelo mental estabelecido pela legenda sonora antes da exploração. | Tempo de calibração auditiva de novos usuários inferior a 1 minuto. | **Alta** | US01, US10 |
| **RNF03** | **Responsividade** | Layout adaptável a diferentes resoluções de tela (desktop, tablets e smartphones). | Funcionamento sem quebra visual em larguras de 320px a 2560px. | **Alta** | US01, US07 |
| **RNF04** | **Desempenho** | Inicialização ágil da aplicação web e carregamento ultrarrápido dos arquivos estáticos JSON. | *First Contentful Paint* (FCP) < 1.5s; tempo de resposta do áudio < 50ms. | **Alta** | US05, US08 |
| **RNF05** | **Confiabilidade** | Operação resiliente na ausência de conexão com serviços de backend dinâmicos. | 100% das funções do MVP executadas no lado cliente através de arquivos estáticos. | **Alta** | US05, RF05 |
| **RNF06** | **Consistência Científica** | Proibição de imputação de zero para nulos e separação estrita de taxa ($\text{mm/h}$) e acumulação ($\text{mm}$). | Validação estrita por schema no pipeline com zero tolerância a desvios físicos. | **Crítica** | US06, US14, US15 |
| **RNF07** | **Reprodutibilidade** | Código e esteiras de processamento totalmente reproduzíveis por qualquer desenvolvedor da equipe. | Scripts Python com ambiente virtualizado (`requirements.txt`) e testes automatizados. | **Alta** | US15 |
| **RNF08** | **Compatibilidade** | Suporte universal aos navegadores modernos (Chrome, Firefox, Safari, Edge) e leitores (NVDA, VoiceOver). | Execução sem necessidade de plugins proprietários via Web Audio API e ES2020+. | **Alta** | US08, US13 |
| **RNF09** | **Manutenibilidade** | Separação rigorosa de responsabilidades entre frontend, processamento científico e documentação. | Código tipado com TypeScript em modo estrito e cobertura de testes unitários. | **Média** | US05, US08 |

---

## 3. Regras de Negócio Invioláveis (RN)

1. **RN01 — Proibição de Imputação de Zero:** Células sem medição ou sob controle de qualidade deficiente nunca devem ser convertidas em zero mm/h. Devem ser tratadas como `null` no JSON e comunicadas como alerta.
2. **RN02 — Diferenciação Estrita de Unidades:** A taxa instantânea de precipitação ($\text{mm/h}$) jamais pode ser somada ou comparada com lâmina acumulada ($\text{mm}$) sem a devida integral temporal.
3. **RN03 — Proibição de Leitura de Pixels:** É expressamente proibido inferir valores numéricos a partir das cores de um mapa visual. Todos os indicadores provêm da matriz numérica de satélite.
4. **RN04 — Rotulagem de Amostras:** Todo dado demonstrativo do MVP deve conter obrigatoriamente a flag `"is_sample": true`.
5. **RN05 — Status da Região Internacional:** A Bacia do Congo é tratada como candidata preliminar sob validação científica. Não atribuir dados fictícios à região.
6. **RN06 — Status de Sincronização EIC:** Quadros visuais da NASA possuem o metadado `"synchronization_status": "pending_official_validation"` até validação oficial de grânulos.
