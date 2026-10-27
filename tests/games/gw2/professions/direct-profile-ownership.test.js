import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { skillPatchableNumericFields } from '#gw2/integrations/patches/authoring/fields.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { necromancerTooltips } from '#gw2/professions/necromancer/app/tooltips.js';
import {
  NECROMANCER_SKILL_IDS as NECRO,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/professions/necromancer/data/ids.js';
import { grantNecromancerSoulShards } from '#gw2/professions/necromancer/core/mechanics/soul-shards.js';
import { necromancerShroudDrain } from '#gw2/professions/necromancer/core/mechanics/shroud-tuning.js';
import { minionDefinitionForSkill } from '#gw2/professions/necromancer/core/mechanics/minion-profiles.js';
import { NECROMANCER_MINION_SUMMON_IDS } from '#gw2/professions/necromancer/core/skills/minion-attacks.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { setThiefKneeling } from '#gw2/professions/thief/core/mechanics/resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { MESMER_SKILL_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import { createMirageActionController } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const preview = (family, profession, edits) =>
  withPatchPreview(family, {
    id: 'direct-ownership',
    label: 'Direct ownership',
    professions: { [profession]: edits }
  });
const context = (family, patchId = 'direct-ownership') => family.resolvePatch({ id: patchId }).balanceContext;
const facts = (tooltips, selected, id) => tooltips.skills[id](selected, selected.catalog.skillsById.get(id)).facts;

// Deleted profiles fail validation, while each new numeric skill target is exposed to authoring.
test('direct migrations remove obsolete targets and expose their canonical owners', () => {
  for (const [family, ids] of [
    [
      necromancerProfession,
      ['necromancer.core.soul-shards', 'necromancer.core.death-shroud', 'necromancer.core.summon-attributes']
    ],
    [mesmerProfession, ['mesmer.mirage.mechanics']],
    [thiefProfession, ['thief.core.resources']]
  ])
    for (const id of ids) {
      assert.equal(family.catalog.balanceProfilesById.has(id), false);
      assert.throws(
        () => applyBalanceProfilePatch(family.catalog, { balanceProfiles: { [id]: { fields: {} } } }),
        /unknown balance profile/
      );
    }

  for (const [family, id, fields] of [
    [necromancerProfession, NECRO.SOUL_SHARDS, ['maximumStacks', 'threshold', 'damageMultiplier']],
    [necromancerProfession, NECRO.DEATH_SHROUD, ['lifeForceDrain']],
    [thiefProfession, THIEF.KNEEL, ['kneelingInitiativeRegenerationBonus']],
    ...NECROMANCER_MINION_SUMMON_IDS.map((id) => [
      necromancerProfession,
      necromancerProfession.catalog.skillsById.get(id).summonAttackId,
      ['weaponStrength']
    ])
  ]) {
    const editable = skillPatchableNumericFields(family.catalog.skillsById.get(id), family.catalog.skillFields);
    for (const field of fields) assert.equal(typeof editable[field], 'number');
  }

  assert.throws(
    () =>
      applyBalanceProfilePatch(thiefProfession.catalog, {
        balanceProfiles: { 'thief.core.resources': { fields: { kneelingInitiativeRegenerationBonus: 2 } } }
      }),
    /unknown balance profile/
  );
});

// Target health controls the selected siphon multiplier; removing its payload still consumes the charge.
test('Soul Shards tuning reaches target-health damage and tooltips without patch leakage', () => {
  const family = preview(necromancerProfession, 'necromancer', {
    skills: { [NECRO.SOUL_SHARDS]: { fields: { threshold: 0.8, damageMultiplier: 2 } } }
  });
  const run = createProfessionSimulator(family);
  for (const [patchId, health, multiplier] of [
    ['current', 0.7, 1],
    ['direct-ownership', 0.7, 2],
    ['direct-ownership', 0.9, 1],
    ['current', 0.7, 1]
  ]) {
    const selected = context(family, patchId);
    const payload = selected.catalog.skillsById.get(NECRO.SOUL_SHARDS).effects[0];
    const result = run(
      ['Perforate'],
      {
        patchId,
        specialization: 'Core',
        primaryWeapon: 'Spear',
        selectedTraitIds: [],
        attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000 }),
        target: { health: 1_000_000, startingHealthFraction: health, armor: 2597 }
      },
      { initialize: (owner) => grantNecromancerSoulShards(owner.mechanics, 1) }
    );
    assert.deepEqual(result.warnings, []);
    const shard = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === NECRO.SOUL_SHARDS);
    assert.equal(shard.damage, Math.floor((payload.flatStrikeBase + payload.flatStrikePowerCoeff * 2000) * multiplier));
    assert.equal(observedRuntime(result).profession.core.soulShardGrant.charges, 0);
    const threshold = facts(necromancerTooltips, selected, NECRO.PERFORATE).find(
      (fact) => fact.name === 'Soul Shard target health threshold'
    );
    assert.equal(threshold.detail, patchId === 'current' ? '50%' : '80%');
  }

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
  assert.equal(observedRuntime(result).profession.core.soulShardGrant.charges, 0);
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
    const selected = context(family);
    const entry = selected.catalog.skillsById.get(id);
    assert.equal(necromancerShroudDrain(selected, entry), 20);
    assert.equal(
      facts(necromancerTooltips, selected, id).find((fact) => fact.name === 'Life force drained per second').detail,
      '20% life force'
    );
    assert.notEqual(necromancerShroudDrain(context(family, 'current'), entry), 20);
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
test('Kneel owns its patched recovery rate and tooltip', () => {
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

  assert.equal(
    facts(thiefTooltips, context(family), THIEF.KNEEL).find((fact) => fact.name === 'Additional initiative per second')
      .detail,
    '2'
  );
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
          controller = createMirageActionController({
            state: owner.mechanics,
            ambushAttacks: {},
            cloneAttacks: {},
            activePrimaryWeapon: () => 'Axe'
          });
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

    if (strike) assert.equal(strike.coefficient, 1.7);

    if (weakness) assert.equal(weakness.duration, 7);

    const cloaks = result.events.filter((event) => event.type === 'buff' && event.kind === 'mirage-cloak');
    assert.equal(cloaks.length, 1);
    assert.equal(cloaks[0].at, 1);
    const tooltip = facts(mesmerTooltips, context(family), MESMER.PICK_UP_MIRAGE_MIRROR);
    assert.equal(
      tooltip.some((fact) => fact.name === 'Weakness'),
      removal !== 'condition'
    );
    assert.equal(
      context(family, 'current')
        .catalog.skillsById.get(MESMER.MIRAGE_MIRROR_DAMAGE)
        .effects.find((effect) => effect.type === 'buff').duration,
      8
    );
  });

// Minions resolve their own attributes for ordinary attacks and commands, without changing siblings or another patch.
test('each minion owns selected weapon strength independently', () => {
  const catalog = necromancerProfession.catalog;
  for (const summonId of NECROMANCER_MINION_SUMMON_IDS) {
    const attackId = catalog.skillsById.get(summonId).summonAttackId;
    const patched = applySkillPatch(catalog, { skills: { [attackId]: { fields: { weaponStrength: 1700 } } } });
    for (const otherId of NECROMANCER_MINION_SUMMON_IDS) {
      assert.equal(
        minionDefinitionForSkill({ catalog: patched }, otherId).weaponStrength,
        otherId === summonId ? 1700 : 1048
      );
    }

    assert.equal(minionDefinitionForSkill({ catalog }, summonId).weaponStrength, 1048);
  }

  const summonId = NECRO.SUMMON_FLESH_GOLEM;
  const attackId = catalog.skillsById.get(summonId).summonAttackId;
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
