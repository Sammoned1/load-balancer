FROM node:18-alpine

WORKDIR /usr/src/app

# Устанавливаем curl для healthcheck (если нужно)
RUN apk --no-cache add curl

# Копируем package files
COPY package*.json ./
COPY tsconfig.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Создаем non-root пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

# Меняем владельца файлов
RUN chown -R appuser:nodejs /usr/src/app
USER appuser

EXPOSE 8080

# Команда для запуска с hot-reload
CMD ["npm", "run", "dev"]