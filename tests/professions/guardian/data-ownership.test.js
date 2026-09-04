import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { assertComposedCatalog } from '../../helpers/skill-mechanics.js';

import { GUARDIAN_CORE_EXTRA_SKILLS } from '#gw2/professions/guardian/core/skills/index.js';
import { GUARDIAN_CORE_EXTRA_SKILLS as GUARDIAN_CORE_ACTIONS } from '#gw2/professions/guardian/core/skills/actions.js';
import { FIREBRAND_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/index.js';
import { FIREBRAND_MANTRA_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/mantra-skills.js';
import { FIREBRAND_TOME_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import {
  LUMINARY_EXTRA_SKILLS,
  LUMINARY_SKILL_MECHANICS
} from '#gw2/professions/guardian/specializations/luminary/skills/index.js';
import { LUMINARY_RADIANT_FORGE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { LUMINARY_STANCE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/stance-skills.js';
import { LUMINARY_VIRTUE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/virtue-skills.js';

const professionSourceRoot = new URL('../../../js/games/gw2/professions/guardian/', import.meta.url);

test('Guardian owner-local skill families compose without duplicates or omissions', () => {
  assert.equal(GUARDIAN_CORE_EXTRA_SKILLS, GUARDIAN_CORE_ACTIONS);
  assertComposedCatalog(FIREBRAND_SKILL_MECHANICS, [FIREBRAND_TOME_SKILL_MECHANICS, FIREBRAND_MANTRA_SKILL_MECHANICS]);
  assertComposedCatalog(LUMINARY_SKILL_MECHANICS, [
    LUMINARY_RADIANT_FORGE_SKILL_MECHANICS,
    LUMINARY_STANCE_SKILL_MECHANICS,
    LUMINARY_VIRTUE_SKILL_MECHANICS
  ]);
  for (const { id } of LUMINARY_EXTRA_SKILLS) assert.ok(LUMINARY_RADIANT_FORGE_SKILL_MECHANICS[id], id);
});

// Locks the migration boundary so stateful skill files cannot quietly return.
test('Guardian skill and persistent-mechanic files have explicit owners', () => {
  for (const relativePath of ['core/skills/spear.ts', 'specializations/firebrand/skills/mantras.ts']) {
    assert.equal(existsSync(new URL(relativePath, professionSourceRoot)), false);
  }

  for (const relativePath of [
    'core/mechanics/spear-illumination.ts',
    'core/skills/actions.ts',
    'specializations/firebrand/mechanics/mantras.ts',
    'specializations/firebrand/skills/mantra-skills.ts',
    'specializations/firebrand/skills/tome-skills.ts',
    'specializations/luminary/skills/radiant-forge-skills.ts',
    'specializations/luminary/skills/stance-skills.ts',
    'specializations/luminary/skills/virtue-skills.ts'
  ]) {
    assert.equal(existsSync(new URL(relativePath, professionSourceRoot)), true);
  }
});
