// arcade-service/src/db/init.ts
// ПРОМЕТЕЙ: Скрипт инициализации базы данных SQLite для Arcade.
// Создаёт таблицы и индексы, если они ещё не существуют.
// Запуск: npm run db:init

import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../arcade.db');

async function initDb() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  console.log('Initializing database...');

  // Таблица пользователей
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      is_admin INTEGER DEFAULT 0
    );
  `);

  // Таблица уровней
  await db.exec(`
    CREATE TABLE IF NOT EXISTS levels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      level_data TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      difficulty TEXT,
      play_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      rating_sum INTEGER DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      tags TEXT,
      is_approved INTEGER DEFAULT 0,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Таблица лайков
  await db.exec(`
    CREATE TABLE IF NOT EXISTS level_likes (
      user_id INTEGER,
      level_id TEXT,
      liked_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, level_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
    );
  `);

  // Таблица оценок (рейтинг)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS level_ratings (
      user_id INTEGER,
      level_id TEXT,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      rated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, level_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
    );
  `);

  // Таблица записей о прохождении (просмотрах) уровней
  await db.exec(`
    CREATE TABLE IF NOT EXISTS level_plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id TEXT,
      user_id INTEGER,
      played_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Индексы для ускорения запросов
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_levels_created ON levels(created_at);
    CREATE INDEX IF NOT EXISTS idx_levels_likes ON levels(like_count DESC);
    CREATE INDEX IF NOT EXISTS idx_levels_rating ON levels(rating_sum, rating_count);
    CREATE INDEX IF NOT EXISTS idx_levels_author ON levels(author_id);
    CREATE INDEX IF NOT EXISTS idx_likes_level ON level_likes(level_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_level ON level_ratings(level_id);
    CREATE INDEX IF NOT EXISTS idx_plays_level ON level_plays(level_id);
  `);

  console.log('Database initialized successfully at', DB_PATH);
  await db.close();
}

initDb().catch(console.error);
