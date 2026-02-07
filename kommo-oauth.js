const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════
// Kommo OAuth Manager
// Gerencia tokens de acesso OAuth2 do Kommo CRM
// ═══════════════════════════════════════════════════════════════════════════

class KommoOAuth {
  constructor() {
    // Configurações OAuth - devem estar nas variáveis de ambiente
    this.clientId = process.env.KOMMO_CLIENT_ID;
    this.clientSecret = process.env.KOMMO_CLIENT_SECRET;
    this.redirectUri = process.env.KOMMO_REDIRECT_URI || 'https://playwright-playwright.6tqx2r.easypanel.host/oauth/callback';
    this.subdomain = process.env.KOMMO_SUBDOMAIN || 'admamoeduitcombr';
    
    // Tokens em memória (em produção, use Redis ou BD)
    this.accessToken = null;
    this.refreshToken = process.env.KOMMO_REFRESH_TOKEN;
    this.tokenExpiry = null;
  }

  /**
   * Obtém um access token válido (renova se necessário)
   */
  async getAccessToken() {
    // Se já tem token válido, retorna
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Senão, renova o token
    return await this.refreshAccessToken();
  }

  /**
   * Renova o access token usando o refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('Refresh token não configurado. Configure KOMMO_REFRESH_TOKEN nas variáveis de ambiente.');
    }

    try {
      const response = await axios.post(`https://${this.subdomain}.kommo.com/oauth2/access_token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        redirect_uri: this.redirectUri
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Atualiza tokens em memória
      this.accessToken = access_token;
      this.refreshToken = refresh_token; // Kommo retorna novo refresh token
      this.tokenExpiry = Date.now() + (expires_in * 1000) - 60000; // 1 min de margem

      console.log('✅ Token OAuth renovado com sucesso');
      console.log(`   Expira em: ${new Date(this.tokenExpiry).toLocaleString('pt-BR')}`);

      return access_token;
    } catch (error) {
      console.error('❌ Erro ao renovar token OAuth:', error.response?.data || error.message);
      throw new Error('Falha ao renovar token OAuth do Kommo');
    }
  }

  /**
   * Obtém token temporário para upload no Drive API
   */
  async getFileUploadToken() {
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.post(
        `https://${this.subdomain}.kommo.com/ajax/v4/files/issue_token`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data.token;
    } catch (error) {
      console.error('❌ Erro ao obter token de upload:', error.response?.data || error.message);
      throw new Error('Falha ao obter token de upload do Kommo Drive');
    }
  }

  /**
   * Troca código de autorização por tokens (usado no fluxo inicial)
   */
  async exchangeCode(code) {
    try {
      const response = await axios.post(`https://${this.subdomain}.kommo.com/oauth2/access_token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri
      });

      const { access_token, refresh_token, expires_in } = response.data;

      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.tokenExpiry = Date.now() + (expires_in * 1000) - 60000;

      console.log('✅ Tokens OAuth obtidos com sucesso');
      console.log(`   Refresh Token: ${refresh_token}`);
      console.log('   ⚠️  Salve o refresh token acima em KOMMO_REFRESH_TOKEN');

      return { access_token, refresh_token, expires_in };
    } catch (error) {
      console.error('❌ Erro ao trocar código por tokens:', error.response?.data || error.message);
      throw new Error('Falha ao obter tokens do Kommo');
    }
  }
}

// Exporta instância singleton
module.exports = new KommoOAuth();
