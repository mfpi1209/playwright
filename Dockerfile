# Usa imagem oficial do Playwright com browsers instalados
FROM mcr.microsoft.com/playwright:v1.44.1-jammy

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos do projeto
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia resto dos arquivos
COPY . .

# Expõe porta da API
EXPOSE 3000

# Comando padrão: inicia servidor da API
CMD ["node", "server.js"]
