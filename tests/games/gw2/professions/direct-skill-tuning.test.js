import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { MESMER_SKILL_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createMirageMechanics } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { grantNecromancerSoulShards } from '#gw2/professions/necromancer/core/mechanics/soul-shards.js';
import {
  NECROMANCER_SKILL_IDS as NECRO,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { setThiefKneeling } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { wait } from '#tests/helpers/commands.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const preview = (family, profession, edits) =>
  withPatchPreview(family, {
    id: 'direct-ownership',
    label: 'Direct ownership',
    professions: { [profession]: edits }
  });
const context = (family, patchId = 'direct-ownership') => family.resolvePatch({ id: patchId }).balanceContext;
// Soul Shards consume a charge even when a patch removes the siphon.
test('Soul Shards spend their charge when the siphon is removed', () => {
  const removed = preview(necromancerProfession, 'necromancer', {
    skills: { [NECRO.SOUL_SHARDS]: { removeEffects: [{ type: 'strike', name: 'Soul Shards' }] } }
  });
  const result = createProfessionSimulator(removed)(
    ['Perforate'],
    {
      patchId: 'direct-ownership',
      specialization: 'Core',
      primaryWeapon: 'Spear'
    },
    { initialize: (owner) => grantNecromancerSoulShards(owner.mechanics, 1) }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).profession.core.soulShardGrant.count, 0);
  assert.equal(
    result.events.some((event) => event.skillId === NECRO.SOUL_SHARDS),
    false
  );
});

// Every shroud resolves its declared owner and keeps automatic exit and elite cleanup on depletion.
for (const [specialization, id, trait] of [
  ['Core', NECRO.DEATH_SHROUD],
  ['Reaper', NECRO.REAPERS_SHROUD, TRAIT.SHROUD_KNIGHT],
  ['Harbinger', NECRO.HARBINGER_SHROUD, TRAIT.DARK_DISCIPLE],
  ['Ritualist', NECRO.RITUALISTS_SHROUD, TRAIT.SPAWNING_POWER]
])
  test(`${specialization} shroud reads selected drain and depletes through the shared lifecycle`, () => {
    const family = preview(necromancerProfession, 'necromancer', {
      [trait ? 'balanceProfiles' : 'skills']: { [trait ?? id]: { fields: { lifeForceDrain: 20 } } }
    });
    const result = createProfessionSimulator(family)([id, wait(7000)], {
      patchId: 'direct-ownership',
      specialization,
      initialResource: 100,
      selectedTraitIds: []
    });
    assert.deepEqual(result.warnings, []);
    const state = observedRuntime(result).profession;
    assert.equal(state.core.activeShroud, '');
    assert.equal(state.core.activeShroudEntryId, null);
    assert.equal(state.core.lifeForce.value, 0);

    if (specialization === 'Harbinger') assert.equal(state.specialization.state.nextBlightAt, Infinity);

    if (specialization === 'Ritualist') assert.deepEqual(state.specialization.state.activeSpirits, {});
  });

// A posture transition changes only the selected skill's extra recovery and stops it on standing.
test('Standing ends the extra initiative recovery from Kneel', () => {
  const family = preview(thiefProfession, 'thief', {
    skills: { [THIEF.KNEEL]: { fields: { kneelingInitiativeRegenerationBonus: 2 } } }
  });
  for (const patchId of ['current', 'direct-ownership', 'current']) {
    const selected = context(family, patchId);
    const bonus = selected.catalog.skillsById.get(THIEF.KNEEL).kneelingInitiativeRegenerationBonus;
    const result = createProfessionSimulator(family)(
      [wait(2000)],
      {
        patchId,
        specialization: 'Deadeye',
        initialInitiative: 0,
        selectedTraitIds: []
      },
      {
        initialize: (owner) => setThiefKneeling(owner.mechanics, true),
        timeline: [{ at: 1, run: (owner) => setThiefKneeling(owner.mechanics, false) }]
      }
    );
    assert.deepEqual(result.warnings, []);
    // Two seconds of fixed recovery plus the selected Kneel bonus during the first second.
    assert.ok(Math.abs(observedRuntime(result).profession.core.initiative.value - (2 + bonus)) < 1e-6);
  }
});

// Pickup rewards are independent components; availability and consumption remain mechanic-owned.
for (const removal of [null, 'strike', 'condition'])
  test(`Mirage Mirror canonical payload preserves ${removal ?? 'all'} component behavior`, () => {
    const family = preview(mesmerProfession, 'mesmer', {
      skills: {
        [MESMER.MIRAGE_MIRROR_DAMAGE]: {
          effects: [
            ...(removal === 'strike' ? [] : [{ type: 'strike', name: 'Strike', coefficient: 1.7 }]),
            ...(removal === 'condition' ? [] : [{ type: 'condition', name: 'Weakness', duration: 7 }]),
            { type: 'buff', name: 'mirage-mirror', duration: 2 }
          ],
          ...(removal ? { removeEffects: [{ type: removal, name: removal === 'strike' ? 'Strike' : 'Weakness' }] } : {})
        }
      }
    });
    let controller;
    const pickups = [];
    const result = createProfessionSimulator(family)(
      [wait(4000)],
      {
        patchId: 'direct-ownership',
        specialization: 'Mirage',
        primaryWeapon: 'Axe',
        selectedTraitIds: []
      },
      {
        initialize(owner) {
          controller = createMirageMechanics(owner.mechanics);
          controller.createMirrors(0, 2);
        },
        timeline: [1, 2, 3].map((at) => ({
          at,
          run(owner) {
            pickups.push(controller.pickUpMirror(at, owner.helpers.skillsById.get(MESMER.PICK_UP_MIRAGE_MIRROR)));
          }
        }))
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(pickups, [true, false, false]);
    const payload = result.events.filter((event) => event.skillId === MESMER.MIRAGE_MIRROR_DAMAGE);
    const strike = payload.find((event) => event.type === 'damage');
    const weakness = payload.find((event) => event.type === 'condition');
    assert.equal(Boolean(strike), removal !== 'strike');
    assert.equal(Boolean(weakness), removal !== 'condition');

    const cloaks = result.events.filter((event) => event.type === 'buff' && event.kind === 'mirage-cloak');
    assert.equal(cloaks.length, 1);
    assert.equal(cloaks[0].at, 1);
  });

// The summoned actor supplies the same weapon strength to both attack paths.
test('A minion shares its weapon strength between automatic and commanded attacks', () => {
  const summonId = NECRO.SUMMON_FLESH_GOLEM;
  const attackId = necromancerProfession.catalog.skillsById.get(summonId).summonAttackId;
  const family = preview(necromancerProfession, 'necromancer', {
    skills: { [attackId]: { fields: { weaponStrength: 1700 } } }
  });
  const result = createProfessionSimulator(family)(
    [summonId, { type: 'combat-start' }, wait(2000), NECRO.CHARGE, wait(3000)],
    {
      patchId: 'direct-ownership',
      specialization: 'Core',
      selectedSkillIds: [summonId],
      selectedTraitIds: []
    }
  );
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter((event) => event.type === 'damage' && event.actorType === 'summon');
  assert.ok(packets.some((event) => event.skillId === NECRO.CHARGE));
  assert.ok(packets.some((event) => event.skillId !== NECRO.CHARGE));
  assert.ok(packets.every((event) => event.weaponStrength === 1700));
});
