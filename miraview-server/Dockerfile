FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src/ ./src/
COPY quiz-settings.json ./
EXPOSE 3001
CMD ["node", "src/index.js"]
