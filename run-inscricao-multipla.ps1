# Script para executar inscricao multipla escolha com os dados do Caio
# Abre o Chromium visivel (headless: false no playwright.config.js)

$env:CLIENTE_NOME = "CAIO TESTANDO DA SILVASAURO"
$env:CLIENTE_CPF = "64218405077"
$env:CLIENTE_EMAIL = "caiovinipsXXXX@gmail.com"
$env:CLIENTE_TELEFONE = "11945010493"
$env:CLIENTE_NASCIMENTO = "08/09/2000"
$env:CLIENTE_CEP = "03295100"
$env:CLIENTE_ESTADO = "Sao Paulo"
$env:CLIENTE_CIDADE = "Sao Paulo"
$env:CLIENTE_CURSO = "Nutricao (Semipresencial)"
$env:CLIENTE_POLO = "polo mais próximo"
$env:CLIENTE_TIPO_VESTIBULAR = "Vestibular Múltipla Escolha"

Write-Host "Dados do cliente definidos. Iniciando Playwright (Chromium visivel)..." -ForegroundColor Cyan
npx playwright test tests/inscricao.spec.js --project=chromium
