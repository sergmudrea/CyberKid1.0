-- arcade-service/migrations/001_initial_schema.sql
-- ПРОМЕТЕЙ: Миграция с SQLite на PostgreSQL.
-- Создаёт все таблицы, индексы и триггеры для production-базы данных.

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE
);

-- Таблица уровней
CREATE TABLE IF NOT EXISTS levels (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level_data JSONB NOT NULL,
    width INTEGER,
    height INTEGER,
    difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    play_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    rating_sum INTEGER DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    tags TEXT,
    is_approved BOOLEAN DEFAULT FALSE
);

-- Таблица лайков
CREATE TABLE IF NOT EXISTS level_likes (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    level_id VARCHAR(100) REFERENCES levels(id) ON DELETE CASCADE,
    liked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, level_id)
);

-- Таблица оценок (рейтинг)
CREATE TABLE IF NOT EXISTS level_ratings (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    level_id VARCHAR(100) REFERENCES levels(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, level_id)
);

-- Таблица просмотров
CREATE TABLE IF NOT EXISTS level_plays (
    id SERIAL PRIMARY KEY,
    level_id VARCHAR(100) REFERENCES levels(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_levels_created ON levels(created_at DESC);
CREATE INDEX idx_levels_likes ON levels(like_count DESC);
CREATE INDEX idx_levels_rating ON levels(rating_sum DESC, rating_count DESC);
CREATE INDEX idx_levels_author ON levels(author_id);
CREATE INDEX idx_levels_difficulty ON levels(difficulty);
CREATE INDEX idx_levels_approved ON levels(is_approved);
CREATE INDEX idx_likes_level ON level_likes(level_id);
CREATE INDEX idx_ratings_level ON level_ratings(level_id);
CREATE INDEX idx_plays_level ON level_plays(level_id);
CREATE INDEX idx_plays_date ON level_plays(played_at);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_levels_updated_at
    BEFORE UPDATE ON levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Полнотекстовый поиск
ALTER TABLE levels ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('russian', title || ' ' || COALESCE(tags, ''))) STORED;

CREATE INDEX idx_levels_search ON levels USING GIN (search_vector);

-- Комментарии к таблицам и колонкам
COMMENT ON TABLE users IS 'Пользователи Arcade';
COMMENT ON TABLE levels IS 'Пользовательские уровни';
COMMENT ON COLUMN levels.level_data IS 'Полный объект LevelData в JSONB';
COMMENT ON COLUMN levels.is_approved IS 'Одобрен модерацией (непубликуемые не видны в общем списке)';
COMMENT ON TABLE level_likes IS 'Лайки пользователей на уровни';
COMMENT ON TABLE level_ratings IS 'Оценки (1-5) пользователей на уровни';
COMMENT ON TABLE level_plays IS 'Просмотры/прохождения уровней';
