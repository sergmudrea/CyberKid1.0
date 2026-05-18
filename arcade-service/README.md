# Arcade Service

This directory contains the backend microservice for CyberKid Arcade – community level sharing.

## ✅ Реализованные возможности (Прометей)

> **ВНИМАНИЕ:** Ниже описан **реальный** функционал сервиса, код которого предоставлен в составе доработок. Ранее планировавшийся функционал (PostgreSQL, сложный рейтинг Elo и т.д.) заменён на работающую реализацию на SQLite с Express, JWT и BFS-валидацией.

### Реализовано полностью

- **Аутентификация** через JWT (регистрация / логин, bcrypt для хеширования паролей)
- **Публикация уровней** с серверной валидацией (BFS проверяет решаемость уровня перед сохранением)
- **Получение списков уровней** с пагинацией, сортировкой (`new`, `top`, `popular`), фильтрацией по сложности (`easy`, `medium`, `hard`), поиском по названию и тегам
- **Получение одного уровня** (автоматически увеличивается счётчик просмотров)
- **Лайки и отзывы (рейтинг 1–5)** с возможностью изменить оценку
- **Личный кабинет автора** – список своих уровней, удаление своих уровней
- **База данных** – SQLite (легковесная, не требует отдельного сервера), все таблицы создаются автоматически
- **Rate limiting** – защита от чрезмерного количества запросов
- **Готовый Docker-контейнер** (многоступенчатая сборка, healthcheck, volume для сохранения БД)

## Быстрый старт

```bash
cd arcade-service
npm install
cp .env.example .env
# отредактируйте .env (обязательно смените JWT_SECRET)
npm run dev          # режим разработки
npm run build        # сборка TypeScript
npm start            # запуск production сервера
npm run db:init      # инициализация БД (таблицы создаются автоматически при первом запуске)

API Endpoints (все реализованы)
Метод	Эндпоинт	Описание	Аутентификация
POST	/api/auth/register	Регистрация пользователя	нет
POST	/api/auth/login	Логин, возвращает JWT	нет
POST	/api/levels	Публикация уровня (валидация BFS)	да (Bearer)
GET	/api/levels	Список уровней (пагинация, сортировка, фильтры)	нет
GET	/api/levels/:id	Получение одного уровня (+1 к play_count)	нет
POST	/api/levels/:id/like	Поставить лайк	да
DELETE	/api/levels/:id/like	Убрать лайк	да
POST	/api/levels/:id/rate	Оценить уровень (1–5)	да
GET	/api/my/levels	Список своих уровней	да
DELETE	/api/levels/:id	Удалить свой уровень	да
Примеры запросов
bash

# Регистрация
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"secret123"}'

# Логин
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"secret123"}'

# Публикация уровня (токен подставить)
curl -X POST http://localhost:3001/api/levels \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"levelData":{"id":"my_level_001","name":"My Level","width":5,"height":5,"map":[...],"startPos":{"col":0,"row":0},"coinPos":{"col":4,"row":4}}}'

# Получить топ уровней
curl "http://localhost:3001/api/levels?sort=top&limit=10"

Docker (производственный запуск)
bash

docker-compose up -d
# сервер будет доступен на порту 3001
# данные БД сохраняются в Docker volume `arcade_data`

Переменные окружения (.env)
Переменная	Описание	По умолчанию
PORT	Порт сервера	3001
JWT_SECRET	Секрет для подписи токенов (обязательно изменить)	–
DB_PATH	Путь к файлу SQLite	./arcade.db
CORS_ORIGINS	Разрешённые домены через запятую	http://localhost:3000
RATE_LIMIT_MAX	Максимум запросов на IP в окно	100
DEBUG	Подробное логирование	false
Планы на будущее (Post-MVP)

    Администрирование – одобрение уровней модераторами (сейчас все уровни публикуются с is_approved = 0, но API их не показывает, пока не переключить флаг вручную в БД).

    Ежедневные подборки (cron + алгоритм ранжирования).

    Переход на PostgreSQL для масштабирования (сейчас SQLite достаточно для тысяч уровней).

    Webhooks для синхронизации с основным клиентским приложением.

Технологии

    Node.js + Express

    TypeScript

    SQLite3 (с обёрткой sqlite)

    jsonwebtoken, bcrypt

    express-rate-limit, helmet, cors

    Docker + Docker Compose

Лицензия

Proprietary (в составе CyberKid Technologies LLC)
text


Этот README полностью отражает реально написанный код бэкенда (а не "планируемый" функционал). Я добавил детали по всем эндпоинтам, инструкции по запуску, Docker, переменные окружения и отметил, что BFS-валидация реализована.
