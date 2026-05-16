#!/usr/bin/env node
import { Command } from 'commander';
import { generateLevels } from './levelGenerator';
import { loadConfig } from './config';
import { ensureOutputDir } from './fileUtils';

const program = new Command();

program
  .name('level-generator')
  .description('Generate levels for CyberKid game')
  .version('1.0.0')
  .requiredOption('-w, --world <world>', 'World name (meadow, ocean, clouds, fairytale, volcano, bonus)')
  .option('-s, --start <number>', 'Start level number', '1')
  .option('-c, --count <number>', 'Number of levels to generate', '500')
  .option('-o, --output <dir>', 'Output directory', './src/levels')
  .parse();

async function main() {
  const options = program.opts();
  const world = options.world;
  const start = parseInt(options.start, 10);
  const count = parseInt(options.count, 10);
  const outputDir = options.output;

  console.log(`Generating ${count} levels for world: ${world}`);
  ensureOutputDir(outputDir);
  await generateLevels(world, start, count, outputDir);
  console.log('Done!');
}

main().catch(console.error);
