# Usa imagem oficial do Playwright com browsers instalados
FROM mcr.microsoft.com/playwright:v1.44.1-jammy

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos do projeto
COPY package*.json ./
COPY playwright.config.js ./
COPY tests/ ./tests/

# Instala dependências
RUN npm ci

# Comando padrão (pode ser sobrescrito)
CMD ["npx", "playwright", "test"]
