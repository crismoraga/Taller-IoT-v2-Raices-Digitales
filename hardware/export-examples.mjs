import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { lessons, sensors } from '../web/data/lessons.ts';

const root = dirname(fileURLToPath(import.meta.url));
for (const language of ['micropython', 'arduino']) mkdirSync(join(root, 'examples', language), { recursive: true });
for (const lesson of lessons) {
  writeFileSync(join(root, 'examples', 'micropython', `${lesson.id}.py`), lesson.code, 'utf8');
  if (lesson.arduinoCode) writeFileSync(join(root, 'examples', 'arduino', `${lesson.id}.ino`), lesson.arduinoCode, 'utf8');
}
writeFileSync(join(root, 'sensor-matrix.json'), JSON.stringify(sensors, null, 2) + '\n', 'utf8');
console.log(`${lessons.length} actividades exportadas desde el contenido de la web.`);
