const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const kommoOAuth = require('./kommo-oauth');

// ═══════════════════════════════════════════════════════════════════════════
// Kommo File Upload Manager
// Gerencia upload de arquivos para Kommo Drive e anexação em leads
// ═══════════════════════════════════════════════════════════════════════════

class KommoUpload {
  constructor() {
    this.driveApiUrl = 'https://drive-g.kommo.com/v1.0';
    this.subdomain = process.env.KOMMO_SUBDOMAIN || 'admamoeduitcombr';
  }

  /**
   * Upload completo: cria sessão, faz upload e anexa ao lead
   * @param {string} filePath - Caminho do arquivo local
   * @param {number} leadId - ID do lead no Kommo
   * @param {number} fieldId - ID do campo customizado para anexar o arquivo
   */
  async uploadAndAttachToLead(filePath, leadId, fieldId = 694015) {
    try {
      console.log(`📤 Iniciando upload de ${filePath} para lead ${leadId}...`);

      // 1. Obter token temporário para upload
      const uploadToken = await kommoOAuth.getFileUploadToken();
      console.log('   ✓ Token de upload obtido');

      // 2. Ler arquivo
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = filePath.split(/[/\\]/).pop();
      const fileSize = fileBuffer.length;

      // 3. Criar sessão de upload
      const session = await this.createUploadSession(uploadToken, fileName, fileSize);
      console.log(`   ✓ Sessão criada: ${session.session_id}`);

      // 4. Fazer upload do binário
      const fileData = await this.uploadBinary(session.upload_url, fileBuffer);
      console.log(`   ✓ Arquivo enviado: ${fileData.uuid}`);

      // 5. Anexar ao lead
      await this.attachFileToLead(leadId, fieldId, fileData.uuid, fileName, fileSize);
      console.log(`   ✓ Arquivo anexado ao lead ${leadId}`);

      return {
        success: true,
        fileUuid: fileData.uuid,
        fileName: fileName,
        fileSize: fileSize,
        downloadUrl: fileData._links?.download?.href
      };
    } catch (error) {
      console.error(`❌ Erro no upload: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cria uma sessão de upload no Kommo Drive
   */
  async createUploadSession(uploadToken, fileName, fileSize) {
    try {
      const response = await axios.post(
        `${this.driveApiUrl}/sessions`,
        {
          file_uuid: '',
          file_name: fileName,
          file_size: fileSize
        },
        {
          headers: {
            'x-auth-token': uploadToken,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao criar sessão:', error.response?.data || error.message);
      throw new Error('Falha ao criar sessão de upload');
    }
  }

  /**
   * Faz upload do binário para o Kommo Drive
   */
  async uploadBinary(uploadUrl, fileBuffer) {
    try {
      const response = await axios.post(uploadUrl, fileBuffer, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao enviar binário:', error.response?.data || error.message);
      throw new Error('Falha ao enviar arquivo');
    }
  }

  /**
   * Anexa o arquivo a um lead específico
   */
  async attachFileToLead(leadId, fieldId, fileUuid, fileName, fileSize) {
    try {
      const accessToken = await kommoOAuth.getAccessToken();

      const response = await axios.patch(
        `https://${this.subdomain}.kommo.com/api/v4/leads/${leadId}`,
        {
          custom_fields_values: [
            {
              field_id: fieldId,
              values: [
                {
                  value: {
                    file_uuid: fileUuid,
                    file_name: fileName,
                    file_size: fileSize
                  }
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao anexar arquivo ao lead:', error.response?.data || error.message);
      throw new Error('Falha ao anexar arquivo ao lead');
    }
  }

  /**
   * Upload de múltiplos arquivos para um lead
   */
  async uploadMultipleFiles(files, leadId, fieldId = 694015) {
    const results = [];
    
    for (const filePath of files) {
      try {
        const result = await this.uploadAndAttachToLead(filePath, leadId, fieldId);
        results.push({ success: true, filePath, ...result });
      } catch (error) {
        results.push({ success: false, filePath, error: error.message });
      }
    }

    return results;
  }
}

// Exporta instância singleton
module.exports = new KommoUpload();
