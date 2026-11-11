// Live balance must not apply preview bonuses twice or share Meteor Shower falloff across casts.
import assert from 'node:assert/strict';
import test from 'node:test';

import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { cast, wait } from '#tests/helpers/commands.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

test('Elementalist has no remaining active preview overrides', () => {
  assert.equal(activePatchPreview, null);
  const profession = withActivePatchPreview(elementalistProfession);
  assert.deepEqual(profession.patchOverviewFor({}, []), []);
});

test('overlapping Meteor Showers keep their damage falloff per activation', () => {
  const result = runElementalist(
    [cast(ID.METEOR_SHOWER), cast(ID.METEOR_SHOWER), wait(12000)],
    { primaryWeapon: 'Staff', startAttunement: 'Fire', selectedTraitIds: [] },
    { catalog: (catalog) => withSkill(catalog, ID.METEOR_SHOWER, { cooldown: 0 }) }
  );
  assert.deepEqual(result.warnings, []);
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.METEOR_SHOWER
  );
  const activations = [...Map.groupBy(strikes, (event) => event.activationId).values()];
  assert.equal(activations.length, 2);
  const [first, second] = activations;
  assert.ok(first.at(-1).at > second[0].at, 'the casts must overlap');
  assert.equal(second[0].coefficient, 2);
  assert.deepEqual(
    second.map((event) => event.coefficient),
    first.map((event) => event.coefficient)
  );
});

// Ground effects retain their source after the player leaves their attunement.
test('Lightning Surge keeps its delayed strike and initial Blindness across an attunement swap', () => {
  const result = runElementalist([cast(ID.LIGHTNING_SURGE), cast(ID.FIRE_ATTUNEMENT), wait(3000)], {
    primaryWeapon: 'Staff',
    startAttunement: 'Air',
    selectedTraitIds: []
  });
  assert.deepEqual(result.warnings, []);
  const initial = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.LIGHTNING_SURGE
  );
  const swap = result.events.find((event) => event.type === 'action' && event.skillId === ID.FIRE_ATTUNEMENT);
  const delayed = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.LIGHTNING_SURGE && event.at > swap.at
  );
  const blindness = result.resolvedEvents.find((event) => event.condition === 'Blindness');
  assert.ok(delayed.at > initial.at);
  assert.equal(delayed.activationId, initial.activationId);
  assert.equal(blindness.at, initial.at);
  assert.equal(blindness.activationId, initial.activationId);
});

// The new Daze must reach control-triggered traits through the ordinary control event path.
test('Shock Wave triggers Lightning Rod without its retired Bleeding or projectile finisher', () => {
  const result = runElementalist([cast(ID.SHOCK_WAVE), wait(2000)], {
    primaryWeapon: 'Staff',
    startAttunement: 'Earth',
    selectedTraitIds: [TRAIT.LIGHTNING_ROD]
  });
  assert.deepEqual(result.warnings, []);
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.SHOCK_WAVE);
  const proc = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Lightning Rod');
  assert.equal(control.controlKind, 'daze');
  assert.equal(proc.at, control.at);
  assert.equal(proc.sourceId, ID.SHOCK_WAVE);
  assert.ok(result.resolvedEvents.some((event) => event.condition === 'Immobilized'));
  assert.ok(!result.resolvedEvents.some((event) => event.condition === 'Bleeding'));
  assert.ok(!result.events.some((event) => event.comboFinishers?.length));
});

// Eruption must hinder the target before its damaging detonation, even after an attunement swap.
test('Eruption applies Cripple before its owned blast and Bleeding', () => {
  const result = runElementalist([cast(ID.ERUPTION), cast(ID.AIR_ATTUNEMENT), wait(4000)], {
    primaryWeapon: 'Staff',
    startAttunement: 'Earth',
    selectedTraitIds: []
  });
  assert.deepEqual(result.warnings, []);
  const cripple = result.resolvedEvents.find((event) => event.condition === 'Crippled');
  const blast = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ERUPTION);
  const bleeding = result.resolvedEvents.find((event) => event.condition === 'Bleeding');
  assert.ok(cripple.at < blast.at);
  assert.equal(bleeding.at, blast.at);
  assert.equal(cripple.activationId, blast.activationId);
  assert.equal(bleeding.activationId, blast.activationId);
  assert.ok(blast.comboFinishers.some((finisher) => finisher.finisherType === 'Blast'));
});
