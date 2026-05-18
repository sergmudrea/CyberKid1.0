// arcade-service/src/routes/admin.ts (дополнение к index.ts)
// ПРОМЕТЕЙ: Эндпоинты для модерации (требуют прав администратора).
// Добавить в index.ts после других маршрутов.

// Для удобства создадим middleware проверки администратора
async function isAdmin(req: Request, userId: number): Promise<boolean> {
  const user = await db.get('SELECT is_admin FROM users WHERE id = ?', userId);
  return user?.is_admin === 1;
}

// Эндпоинт: получить список уровней на модерации (только для админа)
app.get('/api/admin/pending', authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  if (!(await isAdmin(req, userId))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const levels = await db.all(
    `SELECT id, title, author_name, created_at, width, height, level_data
     FROM levels WHERE is_approved = 0 ORDER BY created_at ASC`
  );
  res.json({ levels: levels.map(l => ({ ...l, level_data: JSON.parse(l.level_data) })) });
});

// Эндпоинт: одобрить уровень
app.post('/api/admin/approve/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  if (!(await isAdmin(req, userId))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const levelId = req.params.id;
  const level = await db.get('SELECT id FROM levels WHERE id = ?', levelId);
  if (!level) return res.status(404).json({ error: 'Level not found' });
  await db.run('UPDATE levels SET is_approved = 1 WHERE id = ?', levelId);
  res.json({ success: true });
});

// Эндпоинт: отклонить уровень (удалить)
app.delete('/api/admin/reject/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.userId;
  if (!(await isAdmin(req, userId))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const levelId = req.params.id;
  const level = await db.get('SELECT id FROM levels WHERE id = ?', levelId);
  if (!level) return res.status(404).json({ error: 'Level not found' });
  await db.run('DELETE FROM levels WHERE id = ?', levelId);
  res.json({ success: true });
});
