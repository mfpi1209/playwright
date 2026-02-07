# Usa imagem oficial do Playwright com browsers instalados
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

# Configura encoding UTF-8 para caracteres especiais e emojis
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV PYTHONIOENCODING=utf-8
# Force rebuild v2

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
