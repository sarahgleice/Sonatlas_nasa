#!/usr/bin/env bash
# ==============================================================================
# Script de automação de Labels, Milestones e Issues no GitHub para o SONATLAS
# ==============================================================================

set -e

TOKEN="${GITHUB_TOKEN:-$1}"
REPO="${2:-sarahgleice/Sonatlas_nasa}"

if [ -z "$TOKEN" ]; then
  echo "Erro: Forneça o token do GitHub. Exemplo: ./create_github_project_issues.sh ghp_xxx"
  exit 1
fi

DATA_FILE="$(dirname "$0")/backlog_data.json"

if [ ! -f "$DATA_FILE" ]; then
  echo "Erro: Arquivo $DATA_FILE não encontrado."
  exit 1
fi

echo "=============================================================="
echo "   SONATLAS — Automação de Gestão de Projeto no GitHub        "
echo "   Repositório: $REPO                                         "
echo "=============================================================="

# Carregar e iterar via Python/jq se disponível, ou curl direto
echo "Configurando Milestones, Labels e Issues via GitHub API..."

python3 -c "
import json, requests, sys, time

with open('$DATA_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

headers = {
    'Authorization': 'token $TOKEN',
    'Accept': 'application/vnd.github.v3+json'
}

# 1. Labels
for lbl in data['labels']:
    requests.post('https://api.github.com/repos/$REPO/labels', headers=headers, json=lbl)

# 2. Milestones
milestone_map = {}
for ms in data['milestones']:
    res = requests.post('https://api.github.com/repos/$REPO/milestones', headers=headers, json={'title': ms['title'], 'description': ms['description']})
    if res.status_code == 201:
        milestone_map[ms['title']] = res.json()['number']

# 3. Epics
for epic in data['epics']:
    body = f'## Visão do Épico {epic[\"id\"]}\n\nConsulte docs/05-metodologia/ para detalhes completos.'
    payload = {'title': epic['title'], 'body': body, 'labels': epic['labels']}
    if epic.get('milestone') in milestone_map:
        payload['milestone'] = milestone_map[epic['milestone']]
    requests.post('https://api.github.com/repos/$REPO/issues', headers=headers, json=payload)
    time.sleep(0.3)

# 4. User Stories
for us in data['stories']:
    body = f'## História: {us[\"title\"]}\n\n**Épico:** {us[\"epic\"]}\n**Persona:** {us[\"persona\"]}'
    requests.post('https://api.github.com/repos/$REPO/issues', headers=headers, json={'title': us['title'], 'body': body, 'labels': us['labels']})
    time.sleep(0.3)

print('Processamento concluído com sucesso!')
"

echo "Concluído!"
