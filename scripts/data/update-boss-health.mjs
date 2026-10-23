import { readFile, writeFile } from 'node:fs/promises';
import { extractEncounterHealth, combineEncounterHealth } from './boss-health-evidence.mjs';

// Refresh the reviewed EI report manifest atomically; a missing or changed source leaves the shipped catalog intact.
const manifest = JSON.parse(
  await readFile(new URL('../../data/gw2/encounters/health-sources.json', import.meta.url), 'utf8')
);
const encounters = [];
for (const entry of manifest.encounters) {
  const observations = [];
  for (const source of entry.reports) {
    const endpoint = new URL(source.endpoint);

    if (
      endpoint.origin !== 'https://gw2wingman.nevermindcreations.de' ||
      !/^\/api\/get(?:Full)?Json\//.test(endpoint.pathname)
    )
      throw new Error('Unexpected EI source endpoint.');

    const response = await fetch(endpoint, { signal: AbortSignal.timeout(60000) });

    if (!response.ok) throw new Error(`${source.endpoint}: HTTP ${response.status}`);

    observations.push(
      extractEncounterHealth(await response.json(), {
        ...source,
        encounterId: entry.encounterId,
        difficulty: entry.difficulty
      })
    );
  }

  encounters.push(combineEncounterHealth(observations));
  console.log(`${entry.encounterId} ${entry.difficulty}: ${encounters.at(-1).targets.length} primary targets`);
}

const contents = `import type { EncounterHealthReport } from '#gw2/app/boss-scenarios/health-types.js';\n\n/** Generated from reviewed EI reports by scripts/data/update-boss-health.mjs; do not substitute rounded metadata. */\nexport const ENCOUNTER_HEALTH: readonly EncounterHealthReport[] = ${JSON.stringify(encounters, null, 2)};\n`;
await writeFile(new URL('../../js/games/gw2/app/boss-scenarios/health-data.ts', import.meta.url), contents);
