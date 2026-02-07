const axios = require('axios');
const express = require('express');
const readline = require('readline');

// ═══════════════════════════════════════════════════════════════════════════
// Script para obter Refresh Token usando servidor local
// ═══════════════════════════════════════════════════════════════════════════

const CLIENT_ID = '8fd87bba-a4d2-4d82-9281-8853b29ea9ff';
const CLIENT_SECRET = 'AEXXNp8srr90Ia6cQuZ1hculuvEUd8adAJ6VhPTFPP9tFn8KQXVzm40Wizfj4DnX';
const REDIRECT_URI = 'http://localhost:3333/oauth/callback';
const SUBDOMAIN = 'admamoeduitcombr';

const app = express();
let server;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('🔐 OBTER REFRESH TOKEN DO KOMMO (MÉTODO LOCAL)');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('⚠️  IMPORTANTE: Antes de continuar, você precisa:');
console.log('');
console.log('1. Acesse: https://admamoeduitcombr.kommo.com/settings/widgets');
console.log('2. Encontre a integração com ID: 8fd87bba-a4d2-4d82-9281-8853b29ea9ff');
console.log('3. ADICIONE este Redirect URI na integração:');
console.log('');
console.log('   \x1b[33m%s\x1b[0m', REDIRECT_URI);
console.log('');
console.log('4. Salve a integração');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Você adicionou o redirect URI? (s/n): ', (resposta) => {
  if (resposta.toLowerCase() !== 's') {
    console.log('❌ Configure o redirect URI primeiro e execute novamente.');
    rl.close();
    process.exit(0);
  }

  console.log('');
  console.log('🚀 Iniciando servidor local na porta 3333...');
  console.log('');

  // Configura callback
  app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
      res.send('❌ Código não recebido. Tente novamente.');
      return;
    }

    console.log('✅ Código recebido:', code.substring(0, 20) + '...');
    console.log('🔄 Trocando código por tokens...');
    console.log('');

    try {
      const response = await axios.post(
        `https://${SUBDOMAIN}.kommo.com/oauth2/access_token`,
        {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      console.log('═══════════════════════════════════════════════════════════════════════');
      console.log('✅ TOKENS OBTIDOS COM SUCESSO!');
      console.log('═══════════════════════════════════════════════════════════════════════');
      console.log('');
      console.log('📝 ADICIONE ESTA LINHA NO ARQUIVO .env:');
      console.log('');
      console.log('\x1b[32m%s\x1b[0m', `KOMMO_REFRESH_TOKEN=${refresh_token}`);
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════════════');
      console.log('');

      res.send(`
        <html>
          <head><title>Kommo OAuth - Sucesso!</title></head>
          <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #4CAF50;">✅ Tokens Obtidos!</h1>
              <p>Copie o refresh_token abaixo e adicione no arquivo <code>.env</code>:</p>
              <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto;">KOMMO_REFRESH_TOKEN=${refresh_token}</pre>
              <p style="color: #666; margin-top: 20px;">Você pode fechar esta janela e voltar ao terminal.</p>
            </div>
          </body>
        </html>
      `);

      setTimeout(() => {
        console.log('🛑 Encerrando servidor...');
        server.close();
        rl.close();
        process.exit(0);
      }, 2000);

    } catch (error) {
      console.error('❌ Erro ao obter tokens:');
      console.error('   Status:', error.response?.status);
      console.error('   Mensagem:', error.response?.data?.hint || error.response?.data?.message || error.message);

      res.send(`
        <html>
          <head><title>Kommo OAuth - Erro</title></head>
          <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #f44336;">❌ Erro ao obter tokens</h1>
              <p>Veja os detalhes no terminal.</p>
            </div>
          </body>
        </html>
      `);

      setTimeout(() => {
        server.close();
        rl.close();
        process.exit(1);
      }, 2000);
    }
  });

  server = app.listen(3333, () => {
    console.log('✅ Servidor rodando em http://localhost:3333');
    console.log('');
    console.log('📋 Agora acesse esta URL no navegador:');
    console.log('');
    console.log('\x1b[36m%s\x1b[0m', `https://${SUBDOMAIN}.kommo.com/oauth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=local_auth`);
    console.log('');
    console.log('⏳ Aguardando autorização...');
    console.log('');
  });

  rl.close();
});
