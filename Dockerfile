FROM node:24.20.0-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3090

CMD ["npm", "start"]
