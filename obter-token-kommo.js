const axios = require('axios');
const readline = require('readline');

// ═══════════════════════════════════════════════════════════════════════════
// Script para obter Refresh Token do Kommo manualmente
// ═══════════════════════════════════════════════════════════════════════════

const CLIENT_ID = '8fd87bba-a4d2-4d82-9281-8853b29ea9ff';
const CLIENT_SECRET = 'AEXXNp8srr90Ia6cQuZ1hculuvEUd8adAJ6VhPTFPP9tFn8KQXVzm40Wizfj4DnX';
const REDIRECT_URI = 'https://playwright-playwright.6tqx2r.easypanel.host/oauth/callback';
const SUBDOMAIN = 'admamoeduitcombr';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('🔐 OBTER REFRESH TOKEN DO KOMMO');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Passo 1: Acesse esta URL no navegador:');
console.log('');
console.log('\x1b[36m%s\x1b[0m', `https://${SUBDOMAIN}.kommo.com/oauth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=get_token`);
console.log('');
console.log('📋 Passo 2: Após autorizar, você será redirecionado para uma URL como:');
console.log(`   ${REDIRECT_URI}?code=def50200...`);
console.log('');
console.log('📋 Passo 3: Copie APENAS o código (a parte depois de "?code=")');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

rl.question('Cole o código de autorização aqui: ', async (code) => {
  if (!code || code.trim() === '') {
    console.error('❌ Código não fornecido!');
    rl.close();
    return;
  }

  console.log('');
  console.log('🔄 Trocando código por tokens...');
  console.log('');

  try {
    const response = await axios.post(
      `https://${SUBDOMAIN}.kommo.com/oauth2/access_token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code.trim(),
        redirect_uri: REDIRECT_URI
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    console.log('✅ Tokens obtidos com sucesso!');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('📝 ADICIONE ESTA LINHA NO ARQUIVO .env:');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('\x1b[32m%s\x1b[0m', `KOMMO_REFRESH_TOKEN=${refresh_token}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('⏱️  Access Token expira em:', expires_in, 'segundos');
    console.log('🔄 Refresh Token:', refresh_token.substring(0, 30) + '...');
    console.log('');
    console.log('✅ Pronto! Agora você pode usar a integração.');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao obter tokens:');
    console.error('   Status:', error.response?.status);
    console.error('   Mensagem:', error.response?.data?.hint || error.response?.data?.message || error.message);
    console.log('');
    console.log('💡 Dicas:');
    console.log('   - Verifique se copiou o código completo (sem espaços extras)');
    console.log('   - O código expira rapidamente, tente novamente');
    console.log('   - Certifique-se de que as credenciais estão corretas');
  }

  rl.close();
});
