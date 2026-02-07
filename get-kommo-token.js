require('dotenv').config();

// ═══════════════════════════════════════════════════════════════════════════
// Script auxiliar para obter o Refresh Token do Kommo
// ═══════════════════════════════════════════════════════════════════════════

const clientId = process.env.KOMMO_CLIENT_ID;
const redirectUri = process.env.KOMMO_REDIRECT_URI;
const subdomain = process.env.KOMMO_SUBDOMAIN;

if (!clientId) {
  console.error('❌ KOMMO_CLIENT_ID não configurado no .env');
  process.exit(1);
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('🔐 OBTER REFRESH TOKEN DO KOMMO');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Passo 1: Acesse a URL abaixo no seu navegador:');
console.log('');
console.log('\x1b[36m%s\x1b[0m', `https://${subdomain}.kommo.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=playwright_auth`);
console.log('');
console.log('📋 Passo 2: Autorize a integração');
console.log('');
console.log('📋 Passo 3: Você será redirecionado para:');
console.log(`   ${redirectUri}?code=CODIGO_AQUI`);
console.log('');
console.log('📋 Passo 4: O servidor irá automaticamente trocar o código pelo refresh_token');
console.log('');
console.log('📋 Passo 5: Copie o refresh_token retornado e adicione ao arquivo .env');
console.log('   na variável KOMMO_REFRESH_TOKEN');
console.log('');
console.log('⚠️  IMPORTANTE: Certifique-se de que o servidor está rodando antes de acessar a URL!');
console.log('   Execute: npm start');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
