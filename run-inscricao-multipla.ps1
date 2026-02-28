# Script para executar inscricao multipla escolha com os dados do Caio
# Abre o Chromium visivel (headless: false no playwright.config.js)

$env:CLIENTE_NOME = "CAIO VINICIUS MAWER"
$env:CLIENTE_CPF = "94373814023"
$env:CLIENTE_EMAIL = "caiovinipstetakkst@gmail.com"
$env:CLIENTE_TELEFONE = "11945010493"
$env:CLIENTE_NASCIMENTO = "08/09/2004"
$env:CLIENTE_CEP = "03295100"
$env:CLIENTE_ESTADO = "Sao Paulo"
$env:CLIENTE_CIDADE = "Sao Paulo"
$env:CLIENTE_CURSO = "Analise e Desenvolvimento de Sistemas"
$env:CLIENTE_POLO = "freguesia"
$env:CLIENTE_TIPO_VESTIBULAR = "Vestibular Múltipla Escolha"

Write-Host "Dados do cliente definidos. Iniciando Playwright (Chromium visivel)..." -ForegroundColor Cyan
npx playwright test tests/inscricao.spec.js --project=chromium
