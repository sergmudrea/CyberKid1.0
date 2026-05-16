import fs from 'fs';
import path from 'path';

export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

export function saveLevelToFile(level: any, worldId: string, levelNum: number, outputDir: string): void {
  const fileName = `${worldId}_${levelNum.toString().padStart(3, '0')}.json`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(level, null, 2));
  console.log(`Saved ${fileName}`);
}
