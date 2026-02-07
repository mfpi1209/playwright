# 🔑 Upload para Kommo com Bearer Token - SIMPLES

## ✅ Pré-requisitos

Você precisa do **Bearer Token** do Kommo. Se ainda não tem, obtenha assim:

### Obter Bearer Token:

1. Acesse: `https://admamoeduitcombr.kommo.com/settings/api`
2. Encontre sua integração
3. Copie o **Access Token** ou **Bearer Token**

## 📥 1. Importar Workflow no n8n

1. Abra o n8n
2. Clique em **Import from File**
3. Selecione: `n8n-kommo-simples.json`
4. Salve

## 🔧 2. Configurar Bearer Token

1. No n8n, clique no nó **"Adicionar Nota no Lead"**
2. Em **Credentials**, clique em **Create New**
3. Escolha **Header Auth**
4. Configure:
   - **Name**: `Kommo Bearer Token`
   - **Name**: `Authorization`
   - **Value**: `Bearer SEU_TOKEN_AQUI`
5. **Teste a credencial** (botão de teste)
6. Salve

## 🚀 3. Usar o Workflow

### Ativar:
1. Clique em **Activate** no workflow
2. Copie a **Production URL** do webhook

### Testar:

```bash
curl -X POST "SUA_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": 20412541,
    "fileName": "aprovacao.png",
    "fileUrl": "https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-123.png"
  }'
```

### Exemplo com dados reais:

```bash
curl -X POST "https://seu-n8n.com/webhook/kommo-upload" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": 20412541,
    "fileName": "Comprovante de Inscrição",
    "fileUrl": "https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-15423068843-1234567890.png"
  }'
```

## 📋 Integrar com Playwright

Adicione no final do script de inscrição (ou no n8n após receber a resposta):

```javascript
// Dados de resposta do Playwright
const resultado = {
  leadId: 20412541,
  fileName: "Aprovação SIAA",
  fileUrl: "https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-xxx.png"
};

// Chamar webhook n8n
await fetch('https://seu-n8n.com/webhook/kommo-upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(resultado)
});
```

## 📝 O que o Workflow Faz:

1. ✅ Recebe: `leadId`, `fileName`, `fileUrl`
2. ✅ Faz download do arquivo da URL
3. ✅ **Adiciona uma NOTA no lead** com o link do arquivo
4. ✅ Retorna confirmação

## 📎 A Nota no Kommo vai aparecer assim:

```
📎 Arquivo anexado: aprovacao.png

Baixe em: https://playwright-playwright.6tqx2r.easypanel.host/files/aprovacao-xxx.png
```

## 🔄 Próximo Passo: Upload Real de Arquivo

Se você quiser fazer **upload real do arquivo** (não apenas link), precisamos usar a API Drive do Kommo. Me avise e ajusto o workflow!

## 🎯 Vantagens desta Solução:

- ✅ Super simples
- ✅ Usa apenas Bearer Token
- ✅ Não precisa de OAuth
- ✅ Não precisa de cookies
- ✅ O arquivo fica linkado na nota do lead
- ✅ Funciona imediatamente

## ⚠️ Limitação:

- O arquivo **não fica anexado** no Kommo Drive
- Apenas um **link na nota** é adicionado
- Para anexar no Drive, precisa do fluxo completo (OAuth ou cookies)

**Pronto para testar?** Importe o workflow e configure o Bearer Token! 🚀
