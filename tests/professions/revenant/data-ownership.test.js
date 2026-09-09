import assert from 'node:assert/strict';
import test from 'node:test';
import { assertComposedCatalog } from '../../helpers/skill-mechanics.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';

import { REVENANT_CORE_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/index.js';
import { REVENANT_LEGEND_CALL_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legend-call-skills.js';
import { REVENANT_ASSASSIN_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/assassin.js';
import { REVENANT_CENTAUR_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/centaur.js';
import { REVENANT_DEMON_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/demon.js';
import { REVENANT_DWARF_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/dwarf.js';
import { REVENANT_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/supplemental-skills.js';
import { CONDUIT_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/index.js';
import { CONDUIT_COSMIC_WISDOM_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/cosmic-wisdom-skills.js';
import { CONDUIT_ENTITY_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';
import { CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/release-potential-skills.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { HERALD_BASE_SKILL_MECHANICS as HERALD_FACET_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/facet-skills.js';
import { RENEGADE_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/index.js';
import { RENEGADE_ORDER_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/order-skills.js';
import { RENEGADE_WARBAND_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import { VINDICATOR_ALLIANCE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/alliance-skills.js';
import { VINDICATOR_DODGE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import { VINDICATOR_PROFESSION_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/profession-skills.js';

test('Removed Revenant skills are absent from the simulator catalog and mechanics', () => {
  // Removed underwater, story, and unused trait skills must not be available to simulations.
  for (const skillId of [
    27198, 32588, 34198, 44657, 76497, 28692, 28714, 28797, 28815, 28827, 28915, 28930, 48170, 50390, 50395, 50410,
    50456, 50483
  ]) {
    assert.equal(revenantCatalog.skillsById.has(skillId), false);
    assert.equal(REVENANT_CORE_BASE_SKILL_MECHANICS[skillId], undefined);
  }
});

test('Revenant Core moved skill families compose without duplicates', () => {
  const families = [
    REVENANT_LEGEND_CALL_SKILL_MECHANICS,
    REVENANT_SUPPLEMENTAL_SKILL_MECHANICS,
    REVENANT_DWARF_SKILL_MECHANICS,
    REVENANT_CENTAUR_SKILL_MECHANICS,
    REVENANT_ASSASSIN_SKILL_MECHANICS,
    REVENANT_DEMON_SKILL_MECHANICS
  ];
  const entries = families.flatMap((family) => Object.entries(family));

  assert.equal(new Set(entries.map(([skillId]) => skillId)).size, entries.length);
  for (const [skillId, fragment] of entries)
    assert.equal(REVENANT_CORE_BASE_SKILL_MECHANICS[skillId], fragment, skillId);
});

test('Revenant specialization skill families compose without duplicates or omissions', () => {
  assert.equal(HERALD_BASE_SKILL_MECHANICS, HERALD_FACET_SKILL_MECHANICS);
  assertComposedCatalog(RENEGADE_BASE_SKILL_MECHANICS, [
    RENEGADE_WARBAND_SKILL_MECHANICS,
    RENEGADE_ORDER_SKILL_MECHANICS
  ]);
  assertComposedCatalog(VINDICATOR_BASE_SKILL_MECHANICS, [
    VINDICATOR_ALLIANCE_SKILL_MECHANICS,
    VINDICATOR_DODGE_SKILL_MECHANICS,
    VINDICATOR_PROFESSION_SKILL_MECHANICS
  ]);
  assertComposedCatalog(CONDUIT_BASE_SKILL_MECHANICS, [
    CONDUIT_ENTITY_SKILL_MECHANICS,
    CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS,
    CONDUIT_COSMIC_WISDOM_SKILL_MECHANICS
  ]);
});
