# 🚀 Upload de Arquivos no Kommo via Playwright

## ✅ Solução Simples e Direta!

Ao invés de usar OAuth complexo, usamos Playwright para fazer login no Kommo e anexar os arquivos diretamente pela interface web.

## 🔧 Configuração

### 1. Adicione as credenciais no `.env`:

```env
KOMMO_EMAIL=adm@eduit.com.br
KOMMO_PASSWORD=sua_senha_do_kommo
```

### 2. Pronto! Não precisa de mais nada.

## 🎯 Como Usar

### Teste Manual:

```bash
KOMMO_EMAIL=adm@eduit.com.br \
KOMMO_PASSWORD=sua_senha \
LEAD_ID=20412541 \
SCREENSHOT_PATH=aprovacao-123456789-1234567890.png \
BOLETO_PATH=boleto-123456789-1234567890.pdf \
npx playwright test tests/kommo-upload.spec.js --config=playwright.config.server.js
```

### Via API (após inscrição pós):

O script de inscrição pós pode chamar automaticamente o upload:

```javascript
// No final do script inscricao-pos.spec.js
console.log('KOMMO_UPLOAD_TRIGGER:' + JSON.stringify({
  leadId: LEAD_ID,
  screenshotPath: screenshotPath,
  boletoPath: boletoPath
}));
```

## 📋 O que o Script Faz:

1. ✅ Faz login no Kommo com email e senha
2. ✅ Navega até o lead específico
3. ✅ Anexa o screenshot de aprovação
4. ✅ Anexa o boleto PDF
5. ✅ Adiciona descrição em cada arquivo
6. ✅ Fecha e confirma

## 🎨 Vantagens:

- ✅ **Zero configuração** (só precisa de email/senha)
- ✅ **Não precisa de OAuth**
- ✅ **Não precisa de tokens**
- ✅ **Não precisa de cookies**
- ✅ **Arquivos ficam anexados no Kommo Drive**
- ✅ **Funciona em headless**
- ✅ **Roda no servidor**

## 🔄 Integração Completa:

### No `server.js`, após o script de inscrição pós:

```javascript
// Após o processo de inscrição terminar
if (screenshotPath && boletoPath && leadId) {
  console.log('📤 Iniciando upload para Kommo...');
  
  const uploadProcess = spawn('npx', [
    'playwright', 'test',
    'tests/kommo-upload.spec.js',
    '--config=playwright.config.server.js'
  ], {
    env: {
      ...process.env,
      LEAD_ID: leadId,
      SCREENSHOT_PATH: screenshotPath,
      BOLETO_PATH: boletoPath
    },
    cwd: __dirname,
    shell: true
  });
  
  uploadProcess.stdout.on('data', (data) => {
    console.log(data.toString());
  });
}
```

## ⚠️ Segurança:

- Armazene a senha no `.env` (nunca no código)
- Use uma conta com permissões limitadas se possível
- O `.env` está no `.gitignore` (não vai para o repositório)

## 🐛 Troubleshooting:

### Erro: "Login failed"
- Verifique se o email e senha estão corretos
- Tente fazer login manualmente no navegador primeiro

### Erro: "Lead not found"
- Verifique se o LEAD_ID existe no Kommo
- Acesse: `https://admamoeduitcombr.kommo.com/leads/detail/{LEAD_ID}`

### Erro: "File not found"
- Verifique se os arquivos existem no caminho especificado
- Use caminhos absolutos ou relativos à raiz do projeto

## ✨ Pronto!

Essa é a solução mais simples e robusta! Não precisa de APIs complicadas, tokens ou OAuth. Apenas faz login e anexa os arquivos como um usuário faria manualmente.

**Funciona perfeitamente em headless no servidor!** 🎉
