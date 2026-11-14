<#
.SYNOPSIS
    Script automatizado de criação de Milestones, Labels e Issues no GitHub para o SONATLAS.
.DESCRIPTION
    Lê o arquivo backlog_data.json e cria automaticamente todos os Épicos (EP01-EP09),
    Histórias de Usuário (US01-US20) e Tarefas Técnicas (TEC01-TEC24) no repositório GitHub.
.PARAMETER Token
    GitHub Personal Access Token (PAT) com escopo 'repo' ou 'project'.
.PARAMETER Repo
    Nome do repositório no formato 'owner/repo' (padrão: sarahgleice/Sonatlas_nasa).
.EXAMPLE
    .\create_github_project_issues.ps1 -Token "ghp_seu_token_aqui"
#>

param (
    [Parameter(Mandatory = $false)]
    [string]$Token = $env:GITHUB_TOKEN,

    [Parameter(Mandatory = $false)]
    [string]$Repo = "sarahgleice/Sonatlas_nasa"
)

if (-not $Token) {
    Write-Host "[ERRO] Token do GitHub não fornecido." -ForegroundColor Red
    Write-Host "Forneça o token via parâmetro: .\create_github_project_issues.ps1 -Token 'ghp_xxx'" -ForegroundColor Yellow
    Write-Host "Ou defina a variável de ambiente: `$env:GITHUB_TOKEN = 'ghp_xxx'" -ForegroundColor Yellow
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataPath = Join-Path $scriptDir "backlog_data.json"

if (-not (Test-Path $dataPath)) {
    Write-Host "[ERRO] Arquivo '$dataPath' não encontrado." -ForegroundColor Red
    exit 1
}

$data = Get-Content $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json

$headers = @{
    "Authorization" = "token $Token"
    "Accept"        = "application/vnd.github.v3+json"
    "User-Agent"    = "SONATLAS-Project-Manager"
}

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "   SONATLAS — Automação de Gestão de Projeto no GitHub        " -ForegroundColor Cyan
Write-Host "   Repositório Alvo: $Repo                                    " -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

# 1. Criar Labels
Write-Host "`n[1/4] Configurando Labels..." -ForegroundColor Green
foreach ($lbl in $data.labels) {
    $body = @{
        name        = $lbl.name
        color       = $lbl.color
        description = $lbl.description
    } | ConvertTo-Json

    try {
        $uri = "https://api.github.com/repos/$Repo/labels"
        Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop | Out-Null
        Write-Host "  [+] Label criada: $($lbl.name)" -ForegroundColor Gray
    } catch {
        Write-Host "  [i] Label já existe ou atualizada: $($lbl.name)" -ForegroundColor DarkGray
    }
}

# 2. Criar Milestones
Write-Host "`n[2/4] Criando Milestones (Sprints)..." -ForegroundColor Green
$milestoneMap = @{}
foreach ($ms in $data.milestones) {
    $body = @{
        title       = $ms.title
        description = $ms.description
        state       = "open"
    } | ConvertTo-Json

    try {
        $uri = "https://api.github.com/repos/$Repo/milestones"
        $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
        $milestoneMap[$ms.title] = $res.number
        Write-Host "  [+] Milestone criada: $($ms.title) (#$($res.number))" -ForegroundColor Gray
    } catch {
        # Buscar ID se já existir
        try {
            $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/milestones?state=all" -Method Get -Headers $headers
            $found = $existing | Where-Object { $_.title -eq $ms.title }
            if ($found) {
                $milestoneMap[$ms.title] = $found.number
                Write-Host "  [i] Milestone identificada: $($ms.title) (#$($found.number))" -ForegroundColor DarkGray
            }
        } catch {}
    }
}

# 3. Criar Épicos
Write-Host "`n[3/4] Criando Épicos (EP01 a EP09)..." -ForegroundColor Green
foreach ($epic in $data.epics) {
    $msNum = $milestoneMap[$epic.milestone]
    $issueBody = @"
## 🎯 Visão do Épico
Épico estruturante do projeto **SONATLAS — Explore Earth Through Sound** (NASA Space Apps Challenge 2026).

- **Identificador:** $($epic.id)
- **Título:** $($epic.title)
- **Milestone:** $($epic.milestone)

Consulte a documentação completa no portal em `docs/05-metodologia/`.
"@

    $payload = @{
        title     = $epic.title
        body      = $issueBody
        labels    = $epic.labels
    }
    if ($msNum) { $payload["milestone"] = $msNum }

    try {
        $uri = "https://api.github.com/repos/$Repo/issues"
        $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body ($payload | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
        Write-Host "  [+] Épico criado: $($epic.title) -> Issue #$($res.number)" -ForegroundColor Cyan
    } catch {
        Write-Host "  [-] Erro ao criar Épico $($epic.id): $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 400
}

# 4. Criar Histórias de Usuário
Write-Host "`n[4/4] Criando Histórias de Usuário (US01 a US20)..." -ForegroundColor Green
foreach ($us in $data.stories) {
    $issueBody = @"
## 📖 História de Usuário: $($us.title)

**Épico Vinculado:** $($us.epic)  
**Persona:** $($us.persona)  

### 📝 Descrição
História formalizada conforme a especificação do produto SONATLAS.

### ✅ Critérios de Aceitação
- [ ] Critério testado e validado.
- [ ] Acessibilidade conferida (sem barreiras de teclado/leitor).
- [ ] Rigor científico verificado (unidades e dados sem falseamento).

---
*Gerenciado pelo GitHub Projects — SONATLAS | Desenvolvimento e Gestão do Produto*
"@

    $payload = @{
        title     = $us.title
        body      = $issueBody
        labels    = $us.labels
    }

    try {
        $uri = "https://api.github.com/repos/$Repo/issues"
        $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body ($payload | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
        Write-Host "  [+] História criada: $($us.title) -> Issue #$($res.number)" -ForegroundColor Gray
    } catch {
        Write-Host "  [-] Erro ao criar História $($us.id): $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 400
}

Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "   Sucesso! Todas as Issues e Milestones foram geradas.       " -ForegroundColor Green
Write-Host "   Acesse: https://github.com/$Repo/issues                    " -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Cyan
