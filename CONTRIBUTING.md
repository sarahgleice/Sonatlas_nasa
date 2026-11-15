# Guia de Contribuição — Sonatlas

**Projeto:** Sonatlas — Explore Earth Through Sound  
**Equipe:** UNICEPLAC - Software Developers  
**Evento:** NASA Space Apps Challenge 2026  
**Desafio:** The Earth Information Jukebox

Obrigado por contribuir com o Sonatlas!

O Sonatlas é um projeto colaborativo de exploração científica que transforma dados ambientais da Terra em experiências visuais e sonoras interativas.

Este documento estabelece os padrões de desenvolvimento, colaboração, revisão de código e integridade científica adotados pela equipe.

---

## 1. Nossa equipe

O Sonatlas é desenvolvido pela **UNICEPLAC - Software Developers**, uma equipe de cinco estudantes que representa a UNICEPLAC no NASA Space Apps Challenge 2026, em Brasília.

Somos uma equipe multidisciplinar, comprometida com desenvolvimento de software, ciência de dados, acessibilidade e inovação.

### Áreas de responsabilidade

O desenvolvimento está organizado nas seguintes especialidades:

| Área | Responsabilidades |
|---|---|
| Frontend e UI/UX | Interface React, componentes, navegação, responsividade e experiência do usuário |
| Geoespacial e Mapas | Leaflet, GeoJSON, camadas geográficas e interações espaciais |
| Áudio e Sonificação | Web Audio API, transformação de dados em parâmetros sonoros e sincronização |
| Ciência de Dados | Python, NASA GPM/IMERG, processamento, validação e exportação dos dados |
| Qualidade e Acessibilidade | Testes, revisão técnica, acessibilidade e identificação de problemas |

**Importante:** essas especialidades representam áreas de referência, não restrições individuais. Todos os integrantes podem contribuir em diferentes módulos, desde que respeitem os contratos técnicos e as alterações dos demais.

A distribuição nominal de responsabilidades deverá seguir a documentação interna atualizada da equipe.

## 2. Princípios de colaboração

Todos os contribuidores devem seguir estes princípios:

1. Respeitar o trabalho dos demais integrantes.
2. Comunicar mudanças que afetem módulos compartilhados.
3. Priorizar código legível, organizado e de fácil manutenção.
4. Evitar alterações desnecessárias fora do escopo da tarefa.
5. Documentar decisões técnicas relevantes.
6. Não apresentar funcionalidades incompletas como concluídas.
7. Priorizar entregas funcionais e demonstráveis.
8. Preservar a integridade dos dados científicos.
9. Manter uma comunicação respeitosa e construtiva.

Durante o hackathon, priorizamos soluções simples, eficientes e confiáveis, evitando complexidade desnecessária.

---

## 3. Organização do repositório

O projeto utiliza uma arquitetura que separa a interface web do processamento científico.

Principais áreas:

- `frontend/`: aplicação web, mapas, componentes visuais e sonificação.
- `processing/`: extração, processamento e validação dos dados científicos.
- `processing/scripts/`: scripts de geração e transformação de datasets.
- `processing/tests/`: testes automatizados relacionados ao processamento.
- `frontend/public/data/`: dados processados disponibilizados ao frontend.
- `docs/`: documentação, especificações e decisões técnicas, quando aplicável.

A estrutura real do repositório deve prevalecer sobre esta descrição caso novos módulos sejam adicionados.

---

## 4. Estratégia de branches

Adotamos o **GitHub Flow**, com desenvolvimento em branches e integração por Pull Requests.

### Branch principal

`main`

Representa a versão integrada e estável do projeto.

Não devem ser realizados commits diretos na `main`.

### Nomenclatura das branches

| Prefixo | Finalidade | Exemplo |
|---|---|---|
| `feat/` | Nova funcionalidade | `feat/precipitation-heatmap` |
| `fix/` | Correção de erro | `fix/audio-sync` |
| `docs/` | Documentação | `docs/update-contributing` |
| `refactor/` | Refatoração | `refactor/map-components` |
| `test/` | Testes | `test/precipitation-validation` |
| `chore/` | Manutenção | `chore/update-dependencies` |

Branches existentes com nomenclaturas diferentes podem ser preservadas. Não é necessário renomeá-las apenas para adequação a esta convenção.

### Criando uma branch

Atualize sua branch principal:

```bash
git switch main
git pull origin main
```

Crie uma nova branch:

```bash
git switch -c feat/nome-da-funcionalidade
```

Envie sua branch ao GitHub:

```bash
git push -u origin feat/nome-da-funcionalidade
```

Evite desenvolver diretamente na branch de outro integrante sem alinhamento prévio.

---

## 5. Padrão de commits

Utilizamos **Conventional Commits** para organizar o histórico.

Formato:

```text
tipo(escopo): descrição da alteração
```

### Tipos

- `feat`: nova funcionalidade.
- `fix`: correção de bug.
- `docs`: documentação.
- `refactor`: reorganização de código sem alteração intencional de comportamento.
- `test`: criação ou atualização de testes.
- `chore`: manutenção, configurações ou dependências.
- `perf`: melhoria de desempenho.
- `ci`: alterações em pipelines de integração contínua.

### Exemplos

```bash
feat(map): adicionar camada de precipitacao
feat(audio): sincronizar sonificacao com timeline
fix(data): corrigir tratamento de valores ausentes
test(processing): validar exportacao GeoJSON
docs(readme): atualizar instrucoes de execucao
```

As descrições podem ser escritas em português ou inglês, desde que sejam claras e objetivas.

Prefira commits pequenos, com alterações relacionadas entre si.

---

## 6. Integridade científica

A precisão científica é um princípio fundamental do Sonatlas.

### 6.1 Origem dos dados

Priorize fontes verificáveis, incluindo produtos oficiais de observação da Terra da NASA.

Sempre que possível, documente:

- Fonte e produto científico.
- Versão do dataset.
- Região geográfica.
- Data e intervalo temporal.
- Resolução espacial e temporal.
- Variável observada.
- Unidade de medida.
- Limitações e transformações aplicadas.

### 6.2 Dados reais e demonstrativos

Dados simulados podem ser utilizados durante o desenvolvimento, mas precisam ser identificados explicitamente.

Não apresente valores fictícios como medições reais.

Quando aplicável, utilize metadados como:

```json
{
  "is_sample": true,
  "validation_status": "sample_placeholder"
}
```

Esses campos são exemplos de identificação, não substituem os contratos de dados definidos no projeto.

### 6.3 Tratamento de valores ausentes

Valores inválidos, indisponíveis ou ausentes não podem ser automaticamente convertidos em precipitação zero.

É necessário distinguir:

- Zero: medição válida indicando ausência de precipitação mensurável.
- `null`: medição ausente ou indisponível.
- Valores especiais de preenchimento: devem ser identificados e normalizados durante o processamento.

Valores `NaN` não devem ser serializados como números em JSON padrão.

### 6.4 Unidades científicas

Toda variável precisa apresentar a unidade correta.

Exemplo:

- `mm/h`: taxa de precipitação.
- `mm`: precipitação acumulada.

É proibido tratar taxas e acumulados como equivalentes sem a transformação científica apropriada.

### 6.5 Sincronização temporal

Todos os componentes que representam a mesma observação devem compartilhar uma referência temporal consistente.

Isso inclui:

- Mapas.
- Indicadores científicos.
- Gráficos.
- Áudio.
- Animações temporais.

Utilize timestamps UTC explícitos sempre que possível.

A ordenação de arquivos ou índices não deve ser a única referência para relacionar observações científicas.

---

## 7. Mapas e dados geoespaciais

O Sonatlas utiliza o Leaflet como uma das tecnologias de visualização geográfica.

Contribuições para mapas devem observar:

1. Compatibilidade com GeoJSON válido.
2. Ordem correta de coordenadas GeoJSON: longitude e latitude.
3. Precisão espacial coerente com o dataset.
4. Tratamento de regiões sem dados.
5. Desempenho adequado durante a navegação temporal.
6. Alinhamento entre geometria, indicadores e períodos.
7. Identificação das camadas e seus significados científicos.

### Camadas de precipitação

Camadas baseadas em dados GPM/IMERG devem preservar os valores científicos originais ou transformações devidamente documentadas.

Quando utilizados arrays temporais por célula, todas as observações precisam estar corretamente alinhadas.

A representação visual não deve sugerir precisão superior à resolução espacial da fonte.

---

## 8. Sonificação

A sonificação é um dos principais diferenciais do Sonatlas.

Toda implementação deve estabelecer uma relação compreensível entre variável científica e parâmetro sonoro.

Exemplos de parâmetros:

- Frequência.
- Intensidade.
- Ritmo.
- Duração.
- Textura sonora.

As regras de transformação devem ser documentadas.

Mudanças na representação sonora não podem modificar os valores científicos originais.

O usuário deve conseguir compreender o que está ouvindo.

O áudio não deve ser o único meio de acesso às informações.

---

## 9. Interface e acessibilidade

A identidade visual do Sonatlas segue o conceito:

**Mission Control + Cosmic Sound**

A interface deve apresentar uma experiência moderna, científica e imersiva.

### Diretrizes

- Preservar a consistência entre componentes.
- Priorizar legibilidade e organização.
- Garantir responsividade.
- Evitar animações que prejudiquem a compreensão.
- Fornecer feedback para interações importantes.
- Manter indicadores e controles compreensíveis.
- Preservar o mapa 2D como alternativa às visualizações 3D.

### Acessibilidade

Adotamos WCAG 2.2 AA como referência para novos desenvolvimentos, buscando conformidade progressiva.

Prioridades:

- Navegação por teclado.
- Contraste adequado.
- Rótulos acessíveis.
- Informações não dependentes exclusivamente de cores.
- Alternativas textuais para dados sonificados.
- Estados de foco visíveis.
- Respeito à preferência por movimento reduzido.

Não declarar conformidade WCAG sem avaliação apropriada.

---

## 10. Testes e validação

Antes de abrir uma PR, execute os testes disponíveis relacionados à alteração.

### Frontend

```bash
cd frontend
npm install
npm run test
npm run build
```

### Processamento científico

A partir da raiz do repositório, com as dependências Python instaladas:

```bash
python -m pytest processing/tests
```

Caso algum comando não esteja configurado ou dependa de arquivos externos indisponíveis, informe a limitação na PR.

### Verificações necessárias

- O código executa sem erros conhecidos?
- A alteração respeita os contratos de dados?
- Os dados científicos mantêm suas unidades?
- As interfaces existentes continuam funcionando?
- Existem problemas de responsividade?
- Os estados de erro foram tratados?
- Os testes relevantes foram executados?

Nenhum teste deve ser declarado como aprovado sem execução real.

---

## 11. Pull Requests

Toda contribuição destinada à `main` deve passar por Pull Request.

### Procedimento

1. Atualize sua branch com as mudanças relevantes da `main`.
2. Desenvolva e teste a funcionalidade.
3. Verifique os arquivos modificados.
4. Faça commits com mensagens descritivas.
5. Envie a branch ao GitHub.
6. Abra uma PR utilizando o template do repositório, quando disponível.
7. Solicite revisão de pelo menos um integrante.
8. Resolva os comentários e problemas identificados.
9. Aguarde a aprovação antes do merge.

### Descrição da PR

Uma boa PR deve informar:

- Objetivo da alteração.
- Funcionalidades implementadas.
- Arquivos ou módulos afetados.
- Testes realizados.
- Dependências ou configurações necessárias.
- Limitações conhecidas.
- Capturas de tela, quando envolver mudanças visuais.

Para mudanças científicas, documente também a fonte dos dados e as validações realizadas.

### Critérios para merge

Uma PR poderá ser integrada quando:

- Possuir pelo menos uma aprovação de integrante autorizado.
- Não apresentar conflitos pendentes.
- Passar nos checks obrigatórios configurados no repositório.
- Não introduzir problemas críticos conhecidos.
- Preservar a integridade científica.
- Estiver compatível com a branch de destino.

O GitHub deve ter suas regras de proteção de branch configuradas para aplicar automaticamente os requisitos desejados.

---

## 12. Uso de ferramentas de inteligência artificial

Ferramentas de IA podem auxiliar no desenvolvimento do Sonatlas, incluindo geração de código, testes, documentação e revisão técnica.

Entretanto:

1. O responsável pela contribuição deve compreender o código entregue.
2. Código gerado por IA precisa ser revisado.
3. Dados científicos não podem ser inventados por ferramentas de IA.
4. Testes e validações devem ser executados de verdade.
5. Não compartilhe tokens, senhas ou credenciais em prompts.
6. Não aprove mudanças exclusivamente com base em avaliações automatizadas.
7. O uso de agentes não substitui a responsabilidade do integrante pela contribuição.

Cada desenvolvedor pode utilizar suas ferramentas preferidas, desde que respeite os padrões do repositório.

---

## 13. Segurança e credenciais

Nunca envie ao GitHub:

- Senhas.
- Tokens de acesso pessoal.
- Chaves de API privadas.
- Credenciais NASA Earthdata.
- Arquivos `.env` contendo informações sensíveis.
- Dados privados não autorizados.

Utilize variáveis de ambiente quando necessário.

Arquivos científicos brutos grandes devem seguir a política de armazenamento e versionamento definida pela equipe.

Antes de realizar um commit, revise os arquivos adicionados.

---

## 14. Escopo do MVP

O foco é entregar uma aplicação funcional, científica e demonstrável.

Prioridades:

1. Exploração geográfica.
2. Visualização de dados reais.
3. Seleção de regiões.
4. Navegação temporal.
5. Sonificação científica.
6. Integração entre mapa, dados e áudio.
7. Acessibilidade e usabilidade.

Funcionalidades adicionais devem ser avaliadas conforme o tempo disponível.

Autenticação, infraestrutura complexa, bancos de dados persistentes e sistemas avançados de IA não são prioridades do MVP.

---

## 15. Licença e autoria

O Sonatlas é disponibilizado sob a **MIT License**, conforme o arquivo `LICENSE`.

O projeto é desenvolvido pela equipe **UNICEPLAC - Software Developers (SONATLAS Team)**, formada por estudantes participantes do NASA Space Apps Challenge 2026.

A referência à UNICEPLAC identifica a equipe e sua representação acadêmica, sem implicar automaticamente titularidade institucional ou endosso oficial.

Cada contribuinte deve garantir que possui autorização para disponibilizar suas contribuições sob a licença adotada.

Dados científicos, imagens, marcas e materiais de terceiros permanecem sujeitos às condições de suas respectivas fontes.

---

## 16. Considerações finais

O Sonatlas é mais do que um exercício de programação: é um esforço colaborativo para tornar a ciência da Terra mais acessível por meio da tecnologia.

Cada contribuição deve fortalecer três pilares:

**Ciência confiável. Tecnologia funcional. Experiência acessível.**

**UNICEPLAC - Software Developers**  
*NASA Space Apps Challenge 2026*  
*Sonatlas — Explore Earth Through Sound*
