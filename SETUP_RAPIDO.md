on# 🚀 Setup Rápido - Integração Kommo OAuth

## ✅ Credenciais já configuradas!

As credenciais OAuth do Kommo já foram adicionadas ao arquivo `.env`:
- **Client ID**: `8fd87bba-a4d2-4d82-9281-8853b29ea9ff`
- **Client Secret**: `AEXXNp8srr90Ia6cQuZ1hculuvEUd8adAJ6VhPTFPP9tFn8KQXVzm40Wizfj4DnX`

## 📦 Passo 1: Instalar dependências

```bash
npm install
```

## 🚀 Passo 2: Iniciar o servidor

```bash
npm start
```

O servidor deve iniciar em: `http://localhost:3000`

## 🔐 Passo 3: Obter Refresh Token

### Opção A: Via Script (Recomendado)

1. Em outro terminal, execute:
```bash
node get-kommo-token.js
```

2. Copie a URL exibida e cole no navegador

3. Autorize a integração no Kommo

4. Você será redirecionado e verá uma resposta JSON com o `refresh_token`

5. Copie o `refresh_token` e adicione no arquivo `.env`:
```env
KOMMO_REFRESH_TOKEN=def50200107afd5618a367e9514cbffe...
```

### Opção B: Manual

1. Acesse no navegador (SUBSTITUA O SERVIDOR SE NECESSÁRIO):
```
https://admamoeduitcombr.kommo.com/oauth?client_id=8fd87bba-a4d2-4d82-9281-8853b29ea9ff&redirect_uri=https://playwright-playwright.6tqx2r.easypanel.host/oauth/callback&response_type=code&state=playwright_auth
```

2. Após autorizar, você verá:
```json
{
  "sucesso": true,
  "mensagem": "Tokens obtidos com sucesso!",
  "refresh_token": "def50200107afd5618a367e9514cbffe...",
  "instrucoes": "Salve o refresh_token acima na variável de ambiente KOMMO_REFRESH_TOKEN"
}
```

3. Copie o `refresh_token` e cole no `.env`

## ✅ Passo 4: Testar a configuração

### Renovar token (teste)
```bash
curl -X POST http://localhost:3000/kommo/refresh-token
```

Resposta esperada:
```json
{
  "sucesso": true,
  "mensagem": "Token renovado com sucesso",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJ...",
  "expira_em": "06/02/2026 18:30:00"
}
```

### Testar upload (após ter arquivos)
```bash
curl -X POST http://localhost:3000/kommo/upload \
  -H 'Content-Type: application/json' \
  -d '{
    "leadId": 20412541,
    "screenshotPath": "aprovacao-12345678901-1234567890123.png",
    "boletoPath": "boleto-12345678901-1234567890123.pdf"
  }'
```

## 🔄 Uso no N8N

### Webhook Simples

Importe o workflow `n8n-kommo-upload-workflow.json` no n8n, ou use este código no nó HTTP Request:

**URL**: `https://playwright-playwright.6tqx2r.easypanel.host/kommo/upload`

**Method**: POST

**Body**:
```json
{
  "leadId": {{ $json.leadId }},
  "screenshotPath": "{{ $json.screenshotUrl.split('/files/')[1] }}",
  "boletoPath": "{{ $json.boletoUrl.split('/files/')[1] }}"
}
```

## 📊 Endpoints Disponíveis

- `GET /` - Health check
- `POST /inscricao-pos/sync` - Inscrição pós-graduação
- `POST /kommo/upload` - Upload de arquivos para Kommo
- `POST /kommo/refresh-token` - Renovar token OAuth
- `GET /oauth/callback` - Callback OAuth (usado automaticamente)
- `GET /files/:filename` - Serve arquivos gerados
- `GET /logs` - Logs de execução
- `GET /db/health` - Status do banco

## ⚠️ Troubleshooting

### Erro: "Refresh token não configurado"
- Execute os passos 3 e 4 acima para obter o refresh token

### Erro: "Failed to fetch"
- Certifique-se de que o servidor está rodando
- Verifique se a porta 3000 está livre
- Em produção, use a URL correta do servidor

### Erro: "Authorization failed"
- Verifique se o refresh_token no .env está correto
- Tente renovar o token: `curl -X POST http://localhost:3000/kommo/refresh-token`

## 🎉 Pronto!

Após configurar o refresh token, o sistema irá:
1. ✅ Renovar automaticamente os tokens a cada ~24h
2. ✅ Fazer upload de arquivos para o Kommo
3. ✅ Anexar os arquivos aos leads automaticamente

**Não é necessário fazer login manual no Kommo!**
