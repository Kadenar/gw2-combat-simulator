/** Publishes the pinned, errata-corrected content as a browser module; never edit the generated copy. */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  readReferenceFile,
  REFERENCE_FIXTURE_DIR
} from '../../tests/fixtures/gw2combat-reference/reference-encounter.js';
import { format, resolveConfig } from 'prettier';
import { fileURLToPath } from 'node:url';

const license = readFileSync(`${REFERENCE_FIXTURE_DIR}/LICENSE-gw2combat.txt`, 'utf8');
const content = readReferenceFile('build-cwb-pt-pp-skill-ticks.json');
const source = `/*!\n${license}\n*/\n/** Generated from the pinned gw2combat fixture and its declared errata by scripts/data/generate-guardian-combat-content.mjs. */\nexport const REFERENCE_PLAYER: Readonly<Record<string, unknown>> = JSON.parse(${JSON.stringify(content)});\n`;
const file = new URL('../../js/games/gw2/professions/guardian/combat-engine/reference-content.ts', import.meta.url);
const filepath = fileURLToPath(file);
const formatted = await format(source, { ...(await resolveConfig(filepath)), filepath });
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== formatted) throw new Error('Guardian combat content is stale; regenerate it.');
} else writeFileSync(file, formatted);
