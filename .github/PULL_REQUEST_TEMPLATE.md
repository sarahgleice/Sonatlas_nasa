## 📝 Descrição do Pull Request

<!-- Descreva brevemente as mudanças introduzidas por este PR e o contexto. -->

---

## 🔗 Issues Vinculadas
- Corrige/Resolve: #<!-- número da issue -->
- Épico: <!-- ACC / AUD / GEO / SCI -->

---

## 🎯 Tipo de Mudança
- [ ] `feat`: Nova funcionalidade
- [ ] `fix`: Correção de bug
- [ ] `docs`: Atualização de documentação
- [ ] `refactor`: Refatoração sem mudança de funcionalidade
- [ ] `test`: Adição ou ajuste de testes
- [ ] `chore`: Configurações de build ou CI

---

## ♿ Checklist de Acessibilidade (WCAG 2.1)
*Obrigatório para alterações que toquem a interface de usuário (`frontend/src/`)*
- [ ] A navegação por teclado (`Tab`, `Shift+Tab`, atalhos) funciona plenamente sem bloqueios?
- [ ] Todos os botões e controles possuem `aria-label` ou texto visível descritivo?
- [ ] Estados assíncronos e atualizações temporais são transmitidos via `aria-live`?
- [ ] Elementos puramente visuais/decorativos ou o canvas do mapa possuem `aria-hidden="true"`?
- [ ] O contraste visual atende aos critérios mínimos (>= 4.5:1 para texto comum)?

---

## 🔬 Checklist Científico
*Obrigatório para alterações que toquem dados, indicadores ou áudio (`processing/` ou `frontend/src/audio`)*
- [ ] Dados ausentes foram preservados como `null` ou flag explícita, sem conversão para zero mm/h?
- [ ] A unidade de taxa de precipitação está expressa rigorosamente como `mm/h`?
- [ ] A sonificação respeita o mapeamento (taxa -> frequência, área coberta -> densidade de pulsos)?
- [ ] Os dados de teste adicionados estão claramente marcados como amostras demonstrativas?

---

## 🧪 Testes e Validação
- [ ] `npm run build` executou com sucesso (TypeScript sem erros)?
- [ ] `npm run test` executou todos os testes do frontend com sucesso?
- [ ] Testes unitários do Python (`pytest`) passaram sem falhas (se aplicável)?
- [ ] Foi executado teste prático com navegação exclusiva por teclado?
