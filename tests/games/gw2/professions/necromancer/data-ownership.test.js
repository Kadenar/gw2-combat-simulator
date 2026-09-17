import assert from 'node:assert/strict';
import test from 'node:test';
import { assertComposedCatalog } from '#tests/helpers/skill-mechanics.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';

import { NECROMANCER_CORE_EXTRA_SKILLS as CORE_ACTIONS } from '#gw2/professions/necromancer/core/skills/actions.js';
import { NECROMANCER_CORE_EXTRA_SKILLS } from '#gw2/professions/necromancer/core/skills/index.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { HARBINGER_ELIXIR_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/elixir-skills.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/index.js';
import { HARBINGER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/shroud-skills.js';
import { REAPER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/index.js';
import { REAPER_SHOUT_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';
import { REAPER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shroud-skills.js';

// Validate evaluated arrays, including generated packets and profiles, so authored offsets stay on the 40 ms grid.
test('Necromancer authored effect ticks use the action grid', () => {
  for (const entry of [...necromancerCatalog.skills, ...necromancerCatalog.balanceProfiles]) {
    for (const effect of entry.effects || []) {
      for (const tick of effect.ticks || []) {
        assert.ok(
          Math.abs(tick.atMs - Math.round(tick.atMs / 40) * 40) <= 1e-6,
          `${entry.name || entry.id}: off-grid tick at ${tick.atMs} ms`
        );
      }
    }
  }
});

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
