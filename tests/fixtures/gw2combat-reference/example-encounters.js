/** Loads the additional pinned examples, applying only explicit compatibility changes recorded in their manifest. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveUpstreamEncounter } from '#gw2/platform/combat-engine/configuration.js';
import { REFERENCE_FIXTURE_DIR } from './reference-encounter.js';

export const EXAMPLE_FIXTURE_DIR = path.join(REFERENCE_FIXTURE_DIR, 'examples');

export function readExampleManifest() {
  return JSON.parse(readFileSync(path.join(EXAMPLE_FIXTURE_DIR, 'manifest.json'), 'utf8'));
}

export function readExampleResults() {
  return JSON.parse(readFileSync(path.join(EXAMPLE_FIXTURE_DIR, 'results.json'), 'utf8'));
}

/** Reuse upstream's encounter settings, changing only the selected player files and the plain golem target. */
export function exampleLocalEncounter(id) {
  const example = readExampleManifest().examples.find((entry) => entry.id === id);
  if (!example) throw new Error(`Unknown reference example: ${id}`);
  const encounter = JSON.parse(readFileSync(path.join(REFERENCE_FIXTURE_DIR, 'encounter.json'), 'utf8'));
  encounter.actors[0].build_path = example.build;
  encounter.actors[0].rotation_path = example.rotation;
  encounter.actors[1].build_path = example.target;
  return encounter;
}

/** Match the pinned parser's ignored fields and enum fallback without relaxing the engine's strict validation. */
export function loadExampleEncounter(id) {
  const manifest = readExampleManifest();
  return resolveUpstreamEncounter(exampleLocalEncounter(id), (file) => {
    const entry = manifest.files[file];
    if (!entry) throw new Error(`Unlisted reference input: ${file}`);
    const text = readFileSync(path.join(EXAMPLE_FIXTURE_DIR, file), 'utf8');
    if (!file.endsWith('.json')) return text;
    const json = JSON.parse(text);
    for (const change of entry.ignoredKeys ?? []) {
      const parent = change.path.slice(0, -1).reduce((node, key) => node?.[key], json);
      const key = change.path.at(-1);
      assert.ok(parent && Object.hasOwn(parent, key), `${file}: missing erratum ${change.path.join('.')}`);
      assert.deepEqual(parent[key], change.value, `${file}: changed erratum ${change.path.join('.')}`);
      delete parent[key];
    }

    for (const change of entry.replacements ?? []) {
      const parent = change.path.slice(0, -1).reduce((node, key) => node?.[key], json);
      const key = change.path.at(-1);
      assert.equal(parent?.[key], change.from, `${file}: changed replacement ${change.path.join('.')}`);
      parent[key] = change.to;
    }

    return JSON.stringify(json);
  });
}
