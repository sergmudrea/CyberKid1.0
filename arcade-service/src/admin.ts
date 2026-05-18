// arcade-service/src/admin.ts
// ПРОМЕТЕЙ: CLI-скрипт для модерации уровней (одобрение/отклонение).
// Запуск: npx ts-node src/admin.ts approve <levelId> [--yes]
//        npx ts-node src/admin.ts reject <levelId> [--reason "..."]

import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../arcade.db');

async function getDb(): Promise<Database> {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
}

async function approveLevel(levelId: string): Promise<void> {
  const db = await getDb();
  const level = await db.get('SELECT id, title, author_name FROM levels WHERE id = ?', levelId);
  if (!level) {
    console.error(`Level ${levelId} not found`);
    process.exit(1);
  }
  await db.run('UPDATE levels SET is_approved = 1 WHERE id = ?', levelId);
  console.log(`✅ Level "${level.title}" (${levelId}) by ${level.author_name} approved.`);
  await db.close();
}

async function rejectLevel(levelId: string, reason?: string): Promise<void> {
  const db = await getDb();
  const level = await db.get('SELECT id, title, author_name FROM levels WHERE id = ?', levelId);
  if (!level) {
    console.error(`Level ${levelId} not found`);
    process.exit(1);
  }
  // Можно сохранить причину отказа в отдельную таблицу (опционально)
  await db.run('DELETE FROM levels WHERE id = ?', levelId);
  console.log(`❌ Level "${level.title}" (${levelId}) by ${level.author_name} rejected.${reason ? ` Reason: ${reason}` : ''}`);
  await db.close();
}

async function listPending(): Promise<void> {
  const db = await getDb();
  const levels = await db.all('SELECT id, title, author_name, created_at, width, height FROM levels WHERE is_approved = 0 ORDER BY created_at ASC');
  console.log(`📋 Pending levels (${levels.length}):`);
  for (const level of levels) {
    console.log(`  - ${level.id} | "${level.title}" by ${level.author_name} (created: ${new Date(level.created_at * 1000).toISOString()})`);
  }
  await db.close();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const levelId = args[1];
  const reason = args[3] === '--reason' ? args[4] : undefined;

  switch (command) {
    case 'approve':
      if (!levelId) {
        console.error('Usage: admin.ts approve <levelId>');
        process.exit(1);
      }
      await approveLevel(levelId);
      break;
    case 'reject':
      if (!levelId) {
        console.error('Usage: admin.ts reject <levelId> [--reason "..."]');
        process.exit(1);
      }
      await rejectLevel(levelId, reason);
      break;
    case 'list':
      await listPending();
      break;
    default:
      console.log(`
CyberKid Arcade Moderation CLI

Usage:
  npx ts-node src/admin.ts list                     - show pending levels
  npx ts-node src/admin.ts approve <levelId>        - approve level
  npx ts-node src/admin.ts reject <levelId> [--reason "text"] - reject level
      `);
  }
}

main().catch(console.error);
