# 🐳 Dockerfile - MikroTik Hotspot Manager SaaS
# Forcé en Node 22 pour compatibilité Tailwind 4 / React Router 7

FROM node:22-slim

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# On utilise 'npm install' qui est plus tolérant que 'npm ci' pour ce projet
RUN npm install --no-audit

# Bundle app source
COPY . .

# Build du frontend React (génère le dossier dist/)
RUN npm run build

# Expose le port utilisé par le proxy
EXPOSE 3001

# Lancement du serveur proxy (qui sert aussi le dossier dist/)
CMD [ "node", "mikrotik-proxy.js" ]
