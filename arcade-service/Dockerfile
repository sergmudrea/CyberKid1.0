# arcade-service/Dockerfile
# ПРОМЕТЕЙ: Docker-контейнеризация Arcade сервера для упрощённого развёртывания.
# Использует многоступенчатую сборку: сначала build, затем небольшой production-образ.

# ---------- Стадия сборки ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package.json и устанавливаем зависимости (включая dev)
COPY package*.json ./
RUN npm ci

# Копируем исходный код и собираем TypeScript
COPY . .
RUN npm run build

# ---------- Стадия production ----------
FROM node:20-alpine

WORKDIR /app

# Устанавливаем runtime-зависимости (только production)
COPY package*.json ./
RUN npm ci --only=production

# Копируем собранный JavaScript из стадии builder
COPY --from=builder /app/dist ./dist

# Копируем скрипты (например, для инициализации БД)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/scripts ./scripts 2>/dev/null || true

# Создаём директорию для базы данных (будет смонтирована как volume)
RUN mkdir -p /app/data

# Переменные окружения (можно переопределить при запуске)
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/arcade.db

# Открываем порт
EXPOSE 3001

# Healthcheck (проверяем доступность сервера)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/levels?limit=1', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Запускаем сервер
CMD ["node", "dist/index.js"]
