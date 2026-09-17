import assert from 'node:assert/strict';
import test from 'node:test';
import { assertComposedCatalog } from '#tests/helpers/skill-mechanics.js';

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
