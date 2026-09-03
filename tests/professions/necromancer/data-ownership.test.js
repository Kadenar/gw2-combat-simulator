import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { NECROMANCER_CORE_EXTRA_SKILLS as CORE_ACTIONS } from '#gw2/professions/necromancer/core/skills/actions.js';
import { NECROMANCER_CORE_EXTRA_SKILLS } from '#gw2/professions/necromancer/core/skills/index.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { HARBINGER_ELIXIR_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/elixir-skills.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/index.js';
import { HARBINGER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/shroud-skills.js';
import { REAPER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/index.js';
import { REAPER_SHOUT_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';
import { REAPER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shroud-skills.js';

const professionSourceRoot = new URL('../../../js/games/gw2/professions/necromancer/', import.meta.url);

// Verifies a public owner catalog is exactly the disjoint union of its named family catalogs.
function assertComposedCatalog(aggregate, families) {
  const entries = families.flatMap((family) => Object.entries(family));

  assert.equal(new Set(entries.map(([skillId]) => skillId)).size, entries.length);
  assert.deepEqual(
    Object.keys(aggregate).sort((left, right) => Number(left) - Number(right)),
    entries.map(([skillId]) => skillId).sort((left, right) => Number(left) - Number(right))
  );
  for (const [skillId, fragment] of entries) assert.equal(aggregate[skillId], fragment, skillId);
}

test('Necromancer owner-local skill families compose without duplicates or omissions', () => {
  assertComposedCatalog(REAPER_BASE_SKILL_MECHANICS, [REAPER_SHROUD_SKILL_MECHANICS, REAPER_SHOUT_SKILL_MECHANICS]);
  assertComposedCatalog(HARBINGER_BASE_SKILL_MECHANICS, [
    HARBINGER_ELIXIR_SKILL_MECHANICS,
    HARBINGER_SHROUD_SKILL_MECHANICS
  ]);
  assert.equal(NECROMANCER_CORE_EXTRA_SKILLS, CORE_ACTIONS);
  assert.deepEqual(
    CORE_ACTIONS.map(({ id }) => id),
    [ID.SWAP_WEAPONS, ID.EXIT_LICH_FORM]
  );
});

// Locks the migration boundary so ambiguous runtime owners cannot quietly return.
test('Necromancer runtime files identify their skill-family owners', () => {
  const retiredFiles = [
    'core/skills/flip-handlers.ts',
    'core/skills/flip-execution.ts',
    'core/skills/execution.ts',
    'core/skills/weapons.ts',
    'core/skills/weapons/greatsword-execution.ts',
    'core/skills/weapons/spear-execution.ts',
    'core/skills/weapons/sword-execution.ts',
    'core/skills/weapons/torch-execution.ts',
    'specializations/harbinger/skills/dark-barrage.ts',
    'specializations/harbinger/skills/dark-barrage-execution.ts',
    'specializations/ritualist/skills/weapon-spells.ts',
    'specializations/ritualist/skills/weapon-spell-execution.ts'
  ];
  const ownedFiles = [
    'core/execution/greatsword.ts',
    'core/execution/index.ts',
    'core/execution/spear.ts',
    'core/execution/torch.ts',
    'core/mechanics/skill-flips.ts',
    'core/mechanics/sword-chain.ts',
    'core/skills/actions.ts',
    'specializations/harbinger/execution/dark-barrage.ts',
    'specializations/ritualist/execution/weapon-spells.ts'
  ];

  for (const relativePath of retiredFiles) assert.equal(existsSync(new URL(relativePath, professionSourceRoot)), false);
  for (const relativePath of ownedFiles) assert.equal(existsSync(new URL(relativePath, professionSourceRoot)), true);
});
