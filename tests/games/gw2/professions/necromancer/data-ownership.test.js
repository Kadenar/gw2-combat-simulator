import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertComposedCatalog } from '#tests/helpers/skill-mechanics.js';

import { NECROMANCER_CORE_EXTRA_SKILLS as CORE_ACTIONS } from '#gw2/professions/necromancer/core/skills/actions.js';
import { NECROMANCER_CORE_EXTRA_SKILLS } from '#gw2/professions/necromancer/core/skills/index.js';
import { NECROMANCER_AXE_EXTRA_SKILLS } from '#gw2/professions/necromancer/core/skills/weapons/axe.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { HARBINGER_ELIXIR_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/elixir-skills.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/index.js';
import { HARBINGER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/shroud-skills.js';
import { REAPER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/index.js';
import { REAPER_SHOUT_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';
import { REAPER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shroud-skills.js';

test('Necromancer owner-local skill families compose without duplicates or omissions', () => {
  assertComposedCatalog(REAPER_BASE_SKILL_MECHANICS, [REAPER_SHROUD_SKILL_MECHANICS, REAPER_SHOUT_SKILL_MECHANICS]);
  assertComposedCatalog(HARBINGER_BASE_SKILL_MECHANICS, [
    HARBINGER_ELIXIR_SKILL_MECHANICS,
    HARBINGER_SHROUD_SKILL_MECHANICS
  ]);
  // Triggered weapon identities join the synthetic actions without replacing their original entries.
  assert.deepEqual(NECROMANCER_CORE_EXTRA_SKILLS, [...CORE_ACTIONS, ...NECROMANCER_AXE_EXTRA_SKILLS]);
  assert.deepEqual(
    CORE_ACTIONS.map(({ id }) => id),
    [SHARED_SKILL_IDS.SWAP_WEAPONS, SHARED_SKILL_IDS.DODGE, ID.EXIT_LICH_FORM]
  );
});
