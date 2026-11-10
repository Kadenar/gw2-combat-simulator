/** Selected skill relationships must agree across admission, consumption, and presentation. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { AURA } from '#gw2/platform/constants.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { bindElementalistCoreUi } from '#gw2/professions/elementalist/core/presentation.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

function tooltip(catalog, id) {
  const context = { ...elementalistAppAdapter.profession.resolvePatch().balanceContext, catalog };
  return describeSimulationSkill(context, catalog.skillsById.get(id), elementalistTooltips);
}

test('pickups and attacks use their declared conjure for admission, lifetime, and presentation', () => {
  const catalog = withSkill(
    withSkill(withSkill(elementalistCatalog, ID.CONJURE_LIGHTNING_HAMMER, { duration: 7 }), ID.PICK_UP_FROST_BOW, {
      conjureSourceId: ID.CONJURE_LIGHTNING_HAMMER
    }),
    ID.WATER_ARROW,
    { conjureSourceId: ID.CONJURE_LIGHTNING_HAMMER }
  );
  const result = runElementalist(
    [ID.CONJURE_LIGHTNING_HAMMER, ID.DROP_BUNDLE, ID.PICK_UP_FROST_BOW].map((skillId) => ({ type: 'cast', skillId })),
    { specialization: 'Core', selectedSkillIds: [ID.CONJURE_LIGHTNING_HAMMER], selectedTraitIds: [] },
    { catalog: () => catalog }
  );
  assert.deepEqual(result.warnings, []);
  const core = observedRuntime(result).profession.core;
  const pickup = result.steps.find((step) => step.skillId === ID.PICK_UP_FROST_BOW);
  assert.equal(core.conjureEquipped, 'Lightning Hammer');
  assert.equal(core.conjurePickups['Lightning Hammer'], undefined);
  assert.equal(core.conjureExpiresAt, canonicalTime(pickup.end / 1000 + 7));
  assert.match(tooltip(catalog, ID.PICK_UP_FROST_BOW).description, /Lightning Hammer/);
  const ui = bindElementalistCoreUi(catalog);
  const skill = catalog.skillsById.get(ID.PICK_UP_FROST_BOW);
  assert.equal(
    elementalistCoreAvailability(observedRuntime(result).mechanics.queries, catalog.skillsById.get(ID.WATER_ARROW))
      .ready,
    true
  );
  const groups = ui.paletteGroups({ build: { selectedSkillIds: [ID.CONJURE_LIGHTNING_HAMMER] } });
  assert.ok(groups.find((group) => group.label === 'LH').skillIds.includes(ID.WATER_ARROW));
  assert.deepEqual(
    ui.paletteActionSkills({ professionState: { [STATE.CONJURE_PICKUPS]: { 'Lightning Hammer': 1 } }, time: 0 }, [
      skill
    ]),
    [skill]
  );
});

test('a transmute consumes and displays its declared aura independently of its attunement', () => {
  const catalog = withSkill(elementalistCatalog, ID.TRANSMUTE_FIRE, { transmuteAura: AURA.FROST });
  const result = runElementalist(
    [{ type: 'cast', skillId: ID.TRANSMUTE_FIRE }],
    {
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Focus',
      startAttunement: 'Fire',
      selectedTraitIds: []
    },
    {
      catalog: () => catalog,
      initialize(runtime) {
        runtime.profession.core.activeAuras = [AURA.FROST, AURA.FIRE].map((type) => ({ type, expiresAt: 10 }));
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    observedRuntime(result).profession.core.activeAuras.map((aura) => aura.type),
    [AURA.FIRE]
  );
  assert.ok(tooltip(catalog, ID.TRANSMUTE_FIRE).description.includes(AURA.FROST));
  const ui = bindElementalistCoreUi(catalog);
  const context = { professionState: { [STATE.ACTIVE_AURAS]: [{ type: AURA.FROST, expiresAt: 10 }] }, time: 0 };
  assert.equal(ui.paletteOverride(context, catalog.skillsById.get(ID.TRANSMUTE_FIRE)).tileActive, true);
  assert.equal(ui.paletteOverride(context, catalog.skillsById.get(ID.FIRE_SHIELD)).tileActive, false);
});

test('etching release roles and names come from the selected root in runtime and palette', () => {
  const catalog = withSkill(elementalistCatalog, ID.ETCHING_VOLCANO, {
    name: 'Selected etching',
    etchingReleases: { lesser: ID.VOLCANO, full: ID.LESSER_VOLCANO }
  });
  const result = runElementalist(
    [ID.ETCHING_VOLCANO, ID.VOLCANO].map((skillId) => ({ type: 'cast', skillId })),
    { specialization: 'Core', primaryWeapon: 'Spear', startAttunement: 'Fire', selectedTraitIds: [] },
    { catalog: () => catalog }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).profession.core.etchings['Selected etching'], null);
  const family = [ID.ETCHING_VOLCANO, ID.VOLCANO, ID.LESSER_VOLCANO].map((id) => catalog.skillsById.get(id));
  const ui = bindElementalistCoreUi(catalog);
  const context = {
    build: { weapons: ['Spear', ''] },
    professionState: { [STATE.ETCHINGS]: { 'Selected etching': { stage: 'lesser', otherCasts: 0, expiresAt: 10 } } }
  };
  assert.deepEqual(
    ui.paletteWeaponSkills(context, family).map((skill) => skill.id),
    [ID.VOLCANO]
  );
  assert.match(tooltip(catalog, ID.VOLCANO).description, /partially charged/);
  assert.match(tooltip(catalog, ID.LESSER_VOLCANO).description, /fully charged/);
});
