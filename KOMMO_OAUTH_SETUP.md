# Configuração OAuth do Kommo CRM

Este guia explica como configurar a autenticação OAuth2 para integrar o Playwright com o Kommo CRM e fazer upload de arquivos automaticamente.

## 📋 Pré-requisitos

- Acesso administrativo ao Kommo CRM
- Servidor Playwright rodando em `https://playwright-playwright.6tqx2r.easypanel.host`

## 🔧 Passo 1: Criar Integração no Kommo

1. Acesse o Kommo CRM: `https://admamoeduitcombr.kommo.com`
2. Vá em **Configurações** → **Integrações** → **API**
3. Clique em **Criar nova integração**
4. Preencha os campos:
   - **Nome**: Playwright Automation
   - **Redirect URI**: `https://playwright-playwright.6tqx2r.easypanel.host/oauth/callback`
   - **Scopes**: Selecione:
     - ✅ CRM
     - ✅ Files
     - ✅ Notifications
5. Salve e anote:
   - `Client ID` (Integration ID)
   - `Client Secret` (Secret Key)

## 🔑 Passo 2: Configurar Variáveis de Ambiente

Adicione no arquivo `.env`:

```env
KOMMO_CLIENT_ID=seu_client_id_aqui
KOMMO_CLIENT_SECRET=seu_client_secret_aqui
KOMMO_REDIRECT_URI=https://playwright-playwright.6tqx2r.easypanel.host/oauth/callback
KOMMO_SUBDOMAIN=admamoeduitcombr
KOMMO_REFRESH_TOKEN=
```

## 🚀 Passo 3: Obter Refresh Token

### Método 1: Via Browser (Recomendado)

1. Construa a URL de autorização:

```
https://admamoeduitcombr.kommo.com/oauth?client_id=SEU_CLIENT_ID&redirect_uri=https://playwright-playwright.6tqx2r.easypanel.host/oauth/callback&response_type=code&state=random_state
```

2. Acesse a URL no navegador
3. Autorize a integração
4. Você será redirecionado para o callback do servidor
5. Copie o `refresh_token` retornado
6. Cole no arquivo `.env` em `KOMMO_REFRESH_TOKEN`

### Método 2: Via cURL

Se você já tem um `authorization_code`:

```bash
curl -X POST https://admamoeduitcombr.kommo.com/oauth2/access_token \
  -H 'Content-Type: application/json' \
  -d '{
    "client_id": "SEU_CLIENT_ID",
    "client_secret": "SEU_CLIENT_SECRET",
    "grant_type": "authorization_code",
    "code": "SEU_AUTHORIZATION_CODE",
    "redirect_uri": "https://playwright-playwright.6tqx2r.easypanel.host/oauth/callback"
  }'
```

Resposta:
```json
{
  "token_type": "Bearer",
  "expires_in": 86400,
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJ...",
  "refresh_token": "def502001b0ca637df212085b831..."
}
```

Copie o `refresh_token` e salve no `.env`.

## 🧪 Passo 4: Testar a Configuração

### Renovar Token Manualmente

```bash
curl -X POST http://localhost:3000/kommo/refresh-token \
  -H 'Content-Type: application/json'
```

Resposta esperada:
```json
{
  "sucesso": true,
  "mensagem": "Token renovado com sucesso",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJ...",
  "expira_em": "06/02/2026 15:30:00"
}
```

### Testar Upload de Arquivo

```bash
curl -X POST http://localhost:3000/kommo/upload \
  -H 'Content-Type: application/json' \
  -d '{
    "leadId": 20412541,
    "screenshotPath": "aprovacao-123456789-1234567890123.png",
    "boletoPath": "boleto-123456789-1234567890123.pdf",
    "fieldId": 694015
  }'
```

Resposta esperada:
```json
{
  "sucesso": true,
  "leadId": "20412541",
  "arquivos": [
    {
      "success": true,
      "filePath": "aprovacao-123456789-1234567890123.png",
      "fileUuid": "28552d16-921d-46c4-b566-0918e75da9f7",
      "fileName": "aprovacao-123456789-1234567890123.png",
      "fileSize": 56308
    },
    {
      "success": true,
      "filePath": "boleto-123456789-1234567890123.pdf",
      "fileUuid": "c8f3e41a-7b2c-4d91-9a12-8e9f0b3c5d2a",
      "fileName": "boleto-123456789-1234567890123.pdf",
      "fileSize": 124587
    }
  ],
  "mensagem": "Todos os arquivos foram enviados com sucesso"
}
```

## 🔄 Fluxo de Upload Automático

O sistema agora pode fazer upload automático após a inscrição:

```javascript
// No n8n, após receber resposta do Playwright:
{
  "numeroInscricaoSiaa": "12345678",
  "numeroPedidoVtex": "VTX-987654321",
  "screenshotUrl": "https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-xxx.png",
  "boletoUrl": "https://playwright-playwright.6tqx2r.easypanel.host/files/boleto-xxx.pdf"
}

// Chamar endpoint de upload:
POST /kommo/upload
{
  "leadId": {{ $json.leadId }},
  "screenshotPath": "aprovacao-xxx.png",
  "boletoPath": "boleto-xxx.pdf"
}
```

## 📝 Field IDs do Kommo

Para diferentes campos customizados no Kommo:

- **694015**: Campo padrão de anexos (ajuste conforme seu CRM)

Para encontrar o ID do campo:
1. Acesse: `https://admamoeduitcombr.kommo.com/api/v4/leads/custom_fields`
2. Procure pelo campo desejado
3. Use o `id` retornado

## ⚠️ Troubleshooting

### Erro: "Refresh token não configurado"
- Verifique se `KOMMO_REFRESH_TOKEN` está definido no `.env`
- Execute o fluxo de autorização novamente

### Erro: "Authorization failed"
- O token pode ter expirado (renove com `/kommo/refresh-token`)
- Verifique se os scopes `files` e `crm` estão habilitados na integração

### Erro: "Falha ao criar sessão de upload"
- Verifique se o `x-auth-token` está sendo passado corretamente
- Confirme que o arquivo existe e o caminho está correto

## 🔒 Segurança

- **NUNCA** commite o arquivo `.env` com tokens reais
- O `refresh_token` tem validade longa, armazene com segurança
- O `access_token` é renovado automaticamente a cada ~24h
- Os tokens são armazenados em memória (use Redis em produção para múltiplas instâncias)

## 📚 Referências

- [Kommo API Docs](https://www.kommo.com/developers/)
- [OAuth 2.0 Spec](https://oauth.net/2/)
- [Kommo Drive API](https://drive-api.kommo.com/docs/)
