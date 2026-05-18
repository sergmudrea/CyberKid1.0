// arcade-service/src/index.ts
// ПРОМЕТЕЙ: Основной сервер для Arcade (обмен пользовательскими уровнями).
// Реализует REST API: публикация, получение списков (featured, new, top rated),
// поиск, фильтрация по сложности, лайки, рейтинг, валидация уровней через BFS.

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'cyberkid-secret-key-change-me';

let db: Database;

// ---- Инициализация БД ----
async function initDb() {
  db = await open({
    filename: './arcade.db',
    driver: sqlite3.Database,
  });
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      is_admin INTEGER DEFAULT 0
    );
    
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
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS level_likes (
      user_id INTEGER,
      level_id TEXT,
      liked_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, level_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (level_id) REFERENCES levels(id)
    );
    
    CREATE TABLE IF NOT EXISTS level_ratings (
      user_id INTEGER,
      level_id TEXT,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      rated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, level_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (level_id) REFERENCES levels(id)
    );
    
    CREATE TABLE IF NOT EXISTS level_plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id TEXT,
      user_id INTEGER,
      played_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (level_id) REFERENCES levels(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE INDEX idx_levels_created ON levels(created_at);
    CREATE INDEX idx_levels_likes ON levels(like_count DESC);
    CREATE INDEX idx_levels_rating ON levels(rating_sum, rating_count);
  `);
  
  console.log('Database initialized');
}

// ---- Middleware ----
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ---- JWT аутентификация ----
function generateToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '30d' });
}

async function verifyToken(token: string): Promise<{ userId: number; username: string } | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { userId: decoded.userId, username: decoded.username };
  } catch {
    return null;
  }
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.substring(7);
  verifyToken(token).then(user => {
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    (req as any).user = user;
    next();
  }).catch(() => res.status(401).json({ error: 'Invalid token' }));
}

// ---- Вспомогательные функции для валидации уровня ----
// (здесь должен быть вызов BFS валидатора, но для MVP – заглушка)
async function validateLevelData(levelData: any): Promise<boolean> {
  // Минимальная проверка: наличие обязательных полей
  if (!levelData.id || !levelData.name || !levelData.width || !levelData.height) return false;
  if (!levelData.map || !Array.isArray(levelData.map)) return false;
  // В реальности – запуск BFS через отдельный worker
  return true;
}

// ---- API endpoints ----

// Регистрация / Логин
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      username, email || null, passwordHash
    );
    const token = generateToken(result.lastID!, username);
    res.json({ token, user: { id: result.lastID, username } });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = await db.get('SELECT * FROM users WHERE username = ?', username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken(user.id, user.username);
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Публикация уровня (требует аутентификации)
app.post('/api/levels', authMiddleware, async (req, res) => {
  const { levelData } = req.body;
  if (!levelData) {
    return res.status(400).json({ error: 'levelData required' });
  }
  const isValid = await validateLevelData(levelData);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid level data (validation failed)' });
  }
  const user = (req as any).user;
  const levelId = levelData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const title = levelData.name || 'Untitled';
  const width = levelData.width;
  const height = levelData.height;
  // Определяем сложность (упрощённо)
  let difficulty = 'medium';
  if (levelData.optimalSteps < 10) difficulty = 'easy';
  else if (levelData.optimalSteps > 30) difficulty = 'hard';
  
  try {
    await db.run(
      `INSERT INTO levels (id, title, author_id, author_name, level_data, width, height, difficulty, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      levelId, title, user.userId, user.username, JSON.stringify(levelData), width, height, difficulty, 0
    );
    res.json({ success: true, levelId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to publish level' });
  }
});

// Получение списка уровней (с пагинацией, фильтрацией, сортировкой)
app.get('/api/levels', async (req, res) => {
  const { sort = 'new', page = '1', limit = '12', difficulty, search, tags } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  let orderBy = 'l.created_at DESC';
  if (sort === 'top') orderBy = '(l.rating_sum / CAST(NULLIF(l.rating_count, 0) AS FLOAT)) DESC, l.like_count DESC';
  else if (sort === 'popular') orderBy = 'l.like_count DESC, l.play_count DESC';
  
  let whereClause = 'l.is_approved = 1';
  const params: any[] = [];
  if (difficulty) {
    whereClause += ' AND l.difficulty = ?';
    params.push(difficulty);
  }
  if (search) {
    whereClause += ' AND l.title LIKE ?';
    params.push(`%${search}%`);
  }
  if (tags) {
    whereClause += ' AND l.tags LIKE ?';
    params.push(`%${tags}%`);
  }
  
  const levels = await db.all(
    `SELECT l.id, l.title, l.author_name, l.created_at, l.play_count, l.like_count,
            l.difficulty,
            (l.rating_sum / CAST(NULLIF(l.rating_count, 0) AS FLOAT)) as rating
     FROM levels l
     WHERE ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    ...params, parseInt(limit as string), offset
  );
  const total = await db.get(
    `SELECT COUNT(*) as count FROM levels l WHERE ${whereClause}`,
    ...params
  );
  res.json({
    levels,
    pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total: total.count }
  });
});

// Получение одного уровня по ID
app.get('/api/levels/:id', async (req, res) => {
  const level = await db.get(
    'SELECT l.*, (l.rating_sum / CAST(NULLIF(l.rating_count, 0) AS FLOAT)) as rating FROM levels l WHERE l.id = ? AND l.is_approved = 1',
    req.params.id
  );
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }
  // Увеличиваем счётчик просмотров
  await db.run('UPDATE levels SET play_count = play_count + 1 WHERE id = ?', req.params.id);
  res.json({ level: { ...level, level_data: JSON.parse(level.level_data) } });
});

// Поставить лайк уровню
app.post('/api/levels/:id/like', authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  const levelId = req.params.id;
  try {
    await db.run('INSERT INTO level_likes (user_id, level_id) VALUES (?, ?)', userId, levelId);
    await db.run('UPDATE levels SET like_count = like_count + 1 WHERE id = ?', levelId);
    res.json({ success: true });
  } catch (err) {
    // Уже лайкнул
    res.status(409).json({ error: 'Already liked' });
  }
});

// Убрать лайк
app.delete('/api/levels/:id/like', authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  const levelId = req.params.id;
  const result = await db.run('DELETE FROM level_likes WHERE user_id = ? AND level_id = ?', userId, levelId);
  if (result.changes) {
    await db.run('UPDATE levels SET like_count = like_count - 1 WHERE id = ?', levelId);
  }
  res.json({ success: true });
});

// Оценить уровень (1-5)
app.post('/api/levels/:id/rate', authMiddleware, async (req, res) => {
  const { rating } = req.body;
  const userId = (req as any).user.userId;
  const levelId = req.params.id;
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  const existing = await db.get('SELECT rating FROM level_ratings WHERE user_id = ? AND level_id = ?', userId, levelId);
  if (existing) {
    // Обновление рейтинга
    const oldRating = existing.rating;
    await db.run('UPDATE level_ratings SET rating = ?, rated_at = unixepoch() WHERE user_id = ? AND level_id = ?', rating, userId, levelId);
    await db.run('UPDATE levels SET rating_sum = rating_sum - ? + ?, rating_count = rating_count WHERE id = ?', oldRating, rating, levelId);
  } else {
    await db.run('INSERT INTO level_ratings (user_id, level_id, rating) VALUES (?, ?, ?)', userId, levelId, rating);
    await db.run('UPDATE levels SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', rating, levelId);
  }
  res.json({ success: true });
});

// Получить свои уровни (требует аутентификации)
app.get('/api/my/levels', authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  const levels = await db.all(
    'SELECT id, title, created_at, play_count, like_count, difficulty, is_approved FROM levels WHERE author_id = ? ORDER BY created_at DESC',
    userId
  );
  res.json({ levels });
});

// Удалить свой уровень (требует аутентификации, только свои)
app.delete('/api/levels/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  const levelId = req.params.id;
  const level = await db.get('SELECT author_id FROM levels WHERE id = ?', levelId);
  if (!level) return res.status(404).json({ error: 'Level not found' });
  if (level.author_id !== userId) {
    return res.status(403).json({ error: 'Not your level' });
  }
  await db.run('DELETE FROM levels WHERE id = ?', levelId);
  // Каскадно удалить лайки, рейтинги, просмотры
  await db.run('DELETE FROM level_likes WHERE level_id = ?', levelId);
  await db.run('DELETE FROM level_ratings WHERE level_id = ?', levelId);
  await db.run('DELETE FROM level_plays WHERE level_id = ?', levelId);
  res.json({ success: true });
});

// Запуск сервера
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Arcade service running on port ${PORT}`);
  });
}

start().catch(console.error);
