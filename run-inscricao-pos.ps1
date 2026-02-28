# Script para executar inscricao pos-graduacao
$env:CLIENTE_NOME = "CAIO VINICIUS MAWER"
$env:CLIENTE_CPF = "32276324031"
$env:CLIENTE_EMAIL = "caixcsdfsdf@gmail.com"
$env:CLIENTE_TELEFONE = "11945010493"
$env:CLIENTE_NASCIMENTO = "08/09/1999"
$env:CLIENTE_CEP = "03295100"
$env:CLIENTE_ESTADO = "Sao Paulo"
$env:CLIENTE_CIDADE = "Sao Paulo"
$env:CLIENTE_CURSO = "Enfermagem do Trabalho - 9 Meses"
$env:CLIENTE_POLO = "ibirapuera"

Write-Host "Dados do cliente definidos. Iniciando Playwright (pos-graduacao)..." -ForegroundColor Cyan
npx playwright test tests/inscricao-pos.spec.js --project=chromium
