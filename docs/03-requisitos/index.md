# 03. Requisitos do Sistema

Este documento formaliza os requisitos funcionais, requisitos não funcionais, regras de negócio e restrições técnicas do SONATLAS, organizados com identificadores únicos e prioridades para guiar o ciclo de engenharia da equipe.

---

## 1. Requisitos Funcionais (RF)

| ID | Nome do Requisito | Descrição Detalhada | Prioridade |
|---|---|---|---|
| **RF01** | Seleção de Região de Estudo | O sistema deve permitir que o usuário selecione a área geográfica de estudo entre a Amazônia Central (Nacional) e a Região Internacional candidata (Bacia do Congo). | **Alta** (Must Have) |
| **RF02** | Carregamento Dinâmico de Séries | O sistema deve carregar e processar arquivos JSON estáticos contendo a série temporal de observações associadas à região selecionada. | **Alta** (Must Have) |
| **RF03** | Player de Sonificação Temporal | O sistema deve disponibilizar um player interativo com botões para Reproduzir (*Play*), Pausar (*Pause*), Avançar um passo, Retroceder um passo e Silenciar (*Mute*). | **Alta** (Must Have) |
| **RF04** | Síntese de Áudio Paramétrica | O sistema deve gerar áudio em tempo real via Web Audio API, mapeando a taxa média de precipitação em frequência tonal e a fração de área chuvosa em repetição de pulsos. | **Alta** (Must Have) |
| **RF05** | Alerta Acústico de Dados Ausentes | O sistema deve emitir um sinal sonoro característico de advertência (dissonante/filtrado) quando o passo temporal apresentar dados científicos ausentes (*missing data*). | **Alta** (Must Have) |
| **RF06** | Legenda Sonora de Calibração | O sistema deve disponibilizar uma seção com botões de áudio isolados para calibração auditiva prévia dos diferentes níveis de chuva e avisos. | **Alta** (Must Have) |
| **RF07** | Linha do Tempo Interativa | O sistema deve exibir uma linha do tempo com marcação dos passos temporais, permitindo ao usuário clicar ou navegar por teclado para selecionar qualquer observação. | **Média** (Should Have) |
| **RF08** | Painel de Indicadores Científicos | O sistema deve exibir textualmente a taxa média ($\text{mm/h}$), a proporção de área ($\%$) e a variação temporal ($\Delta R$) da observação selecionada. | **Alta** (Must Have) |
| **RF09** | Alternativa Textual para Mapas | O sistema deve fornecer uma audiodescrição em linguagem natural estruturada que substitua integralmente a necessidade de visualização do mapa Leaflet. | **Alta** (Must Have) |
| **RF10** | Visualização Cartográfica 2D | O sistema deve exibir um mapa 2D interativo com a demarcação da *bounding box* da região via camada GeoJSON. | **Média** (Should Have) |
| **RF11** | Anúncio para Leitores de Tela | O sistema deve anunciar alterações de estado, trocas de região e valores da observação via região `aria-live` dedicada. | **Alta** (Must Have) |
| **RF12** | Guia de Atalhos de Teclado | O sistema deve disponibilizar uma janela modal acessível descrevendo todos os atalhos de navegação disponíveis na aplicação. | **Baixa** (Could Have) |

---

## 2. Requisitos Não Funcionais (RNF)

| ID | Categoria | Descrição | Métrica / Meta | Prioridade |
|---|---|---|---|---|
| **RNF01** | Acessibilidade Digital | O sistema deve atender às diretrizes W3C WCAG 2.1 nos níveis AA e AAA. | 0 erros críticos em ferramentas de auditoria (axe-core e Lighthouse >= 95). | **Alta** |
| **RNF02** | Navegabilidade por Teclado | 100% dos elementos interativos devem ser plenamente acionáveis exclusivamente via teclado. | Foco visível com contraste >= 3:1; ausência total de *focus traps*. | **Alta** |
| **RNF03** | Desempenho de Inicialização | A aplicação web deve carregar rapidamente mesmo em conexões de banda moderada. | *First Contentful Paint* (FCP) < 1.5s; tempo de carga do bundle < 2.0s. | **Alta** |
| **RNF04** | Latência de Síntese de Áudio | A resposta entre o acionamento de um controle e a emissão do som sintetizado deve ser imperceptível. | Latência acústica < 50 milissegundos no Web Audio API. | **Alta** |
| **RNF05** | Compatibilidade de Navegadores | A aplicação deve funcionar nos principais navegadores modernos (Chrome, Firefox, Safari, Edge) no desktop e dispositivos móveis. | Suporte a ECMAScript 2020+ e Web Audio API sem necessidade de plugins proprietários. | **Alta** |
| **RNF06** | Ergonomia Visual | A interface deve oferecer tema escuro nativo (*Dark Mode*) de alto contraste para evitar fadiga ocular em pessoas com fotofobia. | Relação de contraste de cores mínima de 4.5:1 para texto normal e 3:1 para controles. | **Média** |
| **RNF07** | Arquitetura Estática Desacoplada | O frontend deve operar sem dependência de banco de dados ativo ou backend em execução contínua. | Todos os dados são transferidos via arquivos estáticos JSON tipados. | **Alta** |

---

## 3. Regras de Negócio e Rigor Científico (RN)

| ID | Nome da Regra | Descrição e Impacto |
|---|---|---|
| **RN01** | **Proibição de Imputação de Zero** | Células sem medição ou sob bandeiras de erro instrumental NUNCA devem ser preenchidas como $0.0 \text{ mm/h}$. Devem ser tratadas como `null` e contabilizadas no índice de disponibilidade. |
| **RN02** | **Diferenciação Estrita de Unidades** | A taxa de precipitação instantânea ($\text{mm/h}$) nunca pode ser somada ou comparada diretamente com lâmina acumulada ($\text{mm}$) sem a devida integração temporal pela janela de amostragem. |
| **RN03** | **Proibição de Inferência Colorimétrica** | É proibido inferir valores numéricos a partir de pixels coloridos em mapas ou telas. Todos os indicadores devem advir exclusivamente da matriz numérica original do satélite. |
| **RN04** | **Identificação de Dados Demonstrativos** | Todo conjunto de dados simulado para teste de interface no MVP deve conter explicitamente a flag `"is_sample": true`, evitando que seja tomado como histórico oficial. |
| **RN05** | **Status de Validação Visual EIC** | As referências visuais vinculadas aos passos temporais devem conter `"synchronization_status": "pending_official_validation"` até validação formal pela equipe científica. |
| **RN06** | **Região Internacional Candidata** | A Bacia do Congo é tratada formalmente como candidata em avaliação. Não devem ser atribuídas coordenadas definitivas ou dados fictícios à região até homologação oficial. |

---

## 4. Restrições do Projeto

1. **Restrição de Banco de Dados:** Não implementar banco de dados relacional (SQL) ou NoSQL nesta versão inicial do projeto; o armazenamento e a troca de informações ocorrem exclusivamente via arquivos JSON estáticos.
2. **Restrição de Autenticação:** A plataforma é pública e não deve exigir login, cadastro ou tokens de usuário para navegação.
3. **Restrição de IA Generativa:** Não utilizar modelos generativos de áudio ou texto que gerem conteúdos científicos sem fundamentação direta nas medições da NASA.
4. **Restrição Tecnológica de Áudio:** Priorizar a Web Audio API nativa com geração em tempo real; bibliotecas complementares como Tone.js são admitidas apenas se mantiverem a leveza e compatibilidade universal da aplicação.
