# 🧪 Teste de Upload para Kommo - Guia Rápido

## 📥 1. Importar Workflow no n8n

1. Abra o n8n
2. Clique em **Import from File**
3. Selecione o arquivo: `n8n-kommo-upload-completo.json`
4. Clique em **Import**

## 🔑 2. Configurar Credenciais (Cookies do Kommo)

### Obter os Cookies:

1. **Abra o Kommo no navegador**: `https://admamoeduitcombr.kommo.com`
2. **Faça login**
3. Pressione **F12** (abrir DevTools)
4. Vá na aba **Console**
5. Cole e execute este código:

```javascript
copy(document.cookie)
```

6. Os cookies foram copiados! Agora vá para o n8n.

### Configurar no n8n:

1. No n8n, clique no nó **"1. Issue Token"**
2. Em **Credentials**, clique em **Create New**
3. Escolha **Header Auth**
4. Configure:
   - **Name**: `Kommo Session`
   - **Name**: (deixe vazio, vamos usar no Header Parameters)
   - **Value**: (deixe vazio)
5. Salve

Na verdade, como estamos usando cookies, vamos configurar direto no nó:

No nó **"1. Issue Token"**:
- Em **Headers**, adicione:
  - **Name**: `Cookie`
  - **Value**: Cole os cookies que você copiou

## 🧪 3. Testar o Workflow

### Teste Manual:

1. Clique no nó **Webhook**
2. Copie a **URL de teste** (Production URL ou Test URL)
3. Use esta **curl** para testar:

```bash
curl -X POST https://SEU_N8N.com/webhook/kommo-upload-test \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": 20412541,
    "fileName": "teste-upload.png",
    "fileSize": 56308,
    "fileUrl": "https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-12345678901-1234567890123.png",
    "cookies": "SEU_COOKIE_AQUI"
  }'
```

**OU** use dados reais:

```bash
curl -X POST https://SEU_N8N.com/webhook/kommo-upload-test \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": 20412541,
    "fileName": "aprovacao-test.png",
    "fileSize": 56308,
    "fileUrl": "https://via.placeholder.com/800x600.png",
    "cookies": "access_token=eyJ0eXAiOiJKV1QiLCJhbGciOi...; session_id=abc123; amo_user_id=8261837"
  }'
```

### Teste com Postman/Insomnia:

**URL**: `https://SEU_N8N.com/webhook/kommo-upload-test`

**Method**: POST

**Body** (JSON):
```json
{
  "leadId": 20412541,
  "fileName": "aprovacao-teste.png",
  "fileSize": 56308,
  "fileUrl": "https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-12345678901-1234567890123.png",
  "cookies": "access_token=eyJ0eXAiOiJKV1QiLCJhbGciOi...; session_id=abc123"
}
```

## 📊 O que o Workflow faz:

1. ✅ Recebe dados do webhook (leadId, fileName, fileUrl, cookies)
2. ✅ Faz download do arquivo da URL fornecida
3. ✅ Obtém token de upload do Kommo (`issue_token`)
4. ✅ Cria sessão de upload no Kommo Drive
5. ✅ Faz upload do arquivo binário
6. ✅ Anexa o arquivo ao lead no campo 694015
7. ✅ Retorna confirmação de sucesso

## 🔄 Integrar com Playwright

Após a inscrição pós, chame o webhook:

```bash
curl -X POST https://SEU_N8N.com/webhook/kommo-upload-test \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": $LEAD_ID,
    \"fileName\": \"aprovacao-$CPF-$TIMESTAMP.png\",
    \"fileSize\": $(stat -f%z aprovacao.png),
    \"fileUrl\": \"https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-$CPF-$TIMESTAMP.png\",
    \"cookies\": \"$KOMMO_COOKIES\"
  }"
```

## ⚠️ Notas Importantes:

1. **Cookies expiram**: Você precisará atualizar os cookies periodicamente (a cada ~24h)
2. **Field ID**: Ajuste o `field_id: 694015` se necessário
3. **Lead ID**: Use o ID correto do lead no Kommo
4. **File Size**: Deve ser em bytes

## 🐛 Troubleshooting:

### Erro: "Authorization failed"
- Os cookies expiraram
- Copie novos cookies do navegador (F12 → Console → `copy(document.cookie)`)

### Erro: "File not found"
- Verifique se a `fileUrl` está acessível
- Teste abrindo a URL no navegador

### Erro: "Lead not found"
- Verifique se o `leadId` existe no Kommo
- Acesse: `https://admamoeduitcombr.kommo.com/leads/detail/{leadId}`

## ✅ Pronto!

O workflow está configurado e pronto para receber arquivos e anexar no Kommo automaticamente! 🎉
