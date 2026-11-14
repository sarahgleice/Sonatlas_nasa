# 08. Acessibilidade e Inclusão Universal

No projeto SONATLAS, a acessibilidade digital não é uma camada adaptativa tardia, mas o **núcleo fundacional da arquitetura de software e da experiência do usuário (UX)**.

A plataforma foi concebida sob os princípios do **Design Universal**, orientando-se estritamente pelas **Diretrizes de Acessibilidade para Conteúdo Web (WCAG) 2.1**, estabelecidas pelo W3C, buscando conformidade em nível **AA** com diversos requisitos atendendo ao nível **AAA**.

---

## 1. Princípio Fundamental de Design

> :octicons-check-circle-16: **PREMISSA DO SONATLAS:**  
> Nenhuma informação meteorológica ou funcionalidade essencial da plataforma pode depender exclusivamente da visão. Se um usuário desligar totalmente o monitor, ele deve conseguir navegar, compreender e interpretar os dados com a mesma acurácia que um usuário vidente.

---

## 2. Pilares de Acessibilidade Implementados

### 2.1. Navegação Exclusiva por Teclado (WCAG 2.1.1, 2.1.2)
- **Operabilidade Total:** Todos os elementos interativos &mdash; seletor de regiões, botões do player, botões da timeline, legenda sonora e links &mdash; são navegáveis e acionáveis via teclado (`Tab`, `Shift + Tab`, `Enter`, `Espaço`, `Setas`).
- **Anel de Foco Visível (`:focus-visible`):** Destaque nítido com borda de 3px em azul ciano (`#38bdf8`) e contraste superior a 3:1 em relação ao fundo escuro.
- **Prevenção de Armadilhas (*Focus Traps*):** Nenhum componente captura o foco do usuário sem permitir sua saída ordenada.
- **Link de Salto (*Skip to Content*):** Primeiro elemento focável na página, permitindo saltar o cabeçalho e ir direto para o player.

### 2.2. Compatibilidade com Leitores de Tela (WCAG 4.1.2, 4.1.3)
Testado e estruturado para plena interoperabilidade com os principais leitores de tela do mercado:
- **NVDA** e **JAWS** no ambiente Windows.
- **VoiceOver** no macOS e iOS.
- **Orca** em distribuições Linux.
- **TalkBack** no ecossistema Android.

#### Estratégia de Regiões Dinâmicas (`aria-live`)
Para evitar a sobrecarga de anúncios que cansam o usuário cego, o SONATLAS utiliza um único canal centralizado com `aria-live="polite"` e `aria-atomic="true"`:
```html
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
  Passo 3 de 6: 12 de Outubro, 13:00 UTC. Precipitação forte de 17.3 milímetros por hora cobrindo 85% da Amazônia Central.
</div>
```
A propriedade `polite` garante que o leitor de tela conclua a fala da palavra em curso antes de anunciar a nova métrica, respeitando a cadência do usuário.

### 2.3. Independência do Mapa Cartográfico (WCAG 1.1.1)
- O mapa Leaflet 2D é um recurso complementar para pessoas videntes ou com visão residual.
- Os contêineres de renderização visual e SVGs do mapa recebem `aria-hidden="true"`.
- Um painel de **Audiodescrição Estruturada** acompanha o mapa, fornecendo em texto nativo:
  - Nome formal da região e país.
  - Coordenadas delimitadoras da área (*bounding box*).
  - Resumo contextualizado em linguagem natural da evolução da chuva.

### 2.4. Contraste e Ergonomia Visual (WCAG 1.4.3, 1.4.6)
- **Tema Escuro de Alto Contraste (*Deep Space Theme*):** Cores de fundo em azul profundo (`#090d16` e `#131b2e`) combinadas com texto em branco gelo (`#f1f5f9`), alcançando razão de contraste de **14.2:1** (muito acima do mínimo de 4.5:1 exigido no nível AA).
- Adequado para pessoas com fotofobia, baixa acuidade visual ou daltonismo.

---

## 3. Protocolo de Testes de Acessibilidade

Para assegurar que a experiência sem visão seja rigorosamente funcional, o time de engenharia executa o seguinte protocolo de testes em cada ciclo de release:

```mermaid
flowchart TD
    T1["Teste 1: Simulação Tela Desligada<br/>Navegação orientada 100% por áudio e NVDA"] --> V{"Aprovado?"}
    T2["Teste 2: Desconexão Total de Mouse<br/>Operação de 100% dos controles por teclado"] --> V
    T3["Teste 3: Auditoria Automatizada<br/>Lighthouse & axe-core com 0 erros críticos"] --> V
    V -->|Sim| R["✅ Homologação de Acessibilidade"]
    V -->|Não| B["⚠️ Correção de Barreiras"]
```

### Teste de Validação Prática: Tela Desligada
1. **Condição de Teste:** O avaliador desconecta o monitor ou utiliza uma máscara preta digital sobre a janela do navegador.
2. **Procedimento:**
   - Inicia o navegador e acessa o endereço local da aplicação.
   - Utiliza a tecla `Tab` até a Legenda Sonora e reproduz os três níveis de chuva para calibrar o ouvido.
   - Navega até o seletor de regiões e escolhe a Amazônia Central.
   - Aciona a barra de espaço para tocar a série temporal.
   - Pausa no passo 3 e declara verbalmente: o horário da observação, a taxa de precipitação aproximada e a extensão da chuva.
3. **Critério de Sucesso:** O avaliador extrai com exatidão as informações científicas sem olhar para a tela uma única vez.
