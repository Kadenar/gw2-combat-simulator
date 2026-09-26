import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildResolverBuff,
  buildResolverCondition,
  buildResolverStrike,
  resolverSourceSkill
} from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { applyElementalistDerivedCondition } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import {
  applyEngineerDerivedCondition,
  queueDamage
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { holosmithResolverEventHandlers } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-effects.js';
import {
  applyTraitCondition,
  applyTraitVulnerability
} from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { queueCondition } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { queueSoulbeastBuff } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

const trigger = {
  type: 'damage',
  at: 1,
  source: 'fixture',
  sourceId: 'trigger',
  actorType: 'player',
  skillId: 1,
  skillName: 'Trigger',
  coefficient: 1,
  noCrit: true,
  weaponStrength: 1000,
  activationId: 'activation',
  causalOrder: 1,
  hitIndex: 7,
  totalHits: 9,
  metadata: { procCount: 99 },
  holosmithStrikeFactor: 3
};

// Exercise actual resolver state so immediate and queued conditions cannot accidentally trade places.
test('derived conditions preserve immediate visibility and same-time queued ordering', () => {
  const trace = [];
  resolveTestGw2Events({
    config: { target: { armor: 2597, conditions: {} } },
    traits: new Set(),
    ...{ events: [trigger, { ...trigger, sourceId: 'observer' }], endTime: 2 },
    professionReactions: {
      'damage.resolved'(context, event) {
        if (event.sourceId === 'trigger') {
          applyElementalistDerivedCondition(context, event, {
            source: 'Elementalist proc',
            condition: 'Burning',
            stacks: 1,
            duration: 1,
            procCount: 2
          });
          applyEngineerDerivedCondition(context, event, {
            name: 'Engineer proc',
            condition: 'Bleeding',
            stacks: 1,
            duration: 1,
            actorType: 'effect',
            ownerActorType: 'player'
          });
          applyTraitCondition(context, event, {
            name: 'Necromancer proc',
            traitId: 2,
            condition: 'Poisoned',
            duration: 1
          });
          applyTraitVulnerability(context, event, { name: 'Queued proc', traitId: 3, stacks: 1, duration: 1 });
        } else {
          assert.ok(context.query.targetHasCondition('Burning', event.at, context));
          assert.ok(context.query.targetHasCondition('Bleeding', event.at, context));
          assert.ok(context.query.targetHasCondition('Poisoned', event.at, context));
          assert.equal(context.query.targetHasCondition('Vulnerability', event.at, context), false);
          trace.push('observer');
        }
      },
      'condition.applied'(_context, event) {
        trace.push(event.condition);

        assert.equal(event.hitIndex, undefined);
        assert.equal(event.holosmithStrikeFactor, undefined);
        if (event.sourceId === 2) {
          assert.equal(event.actorType, 'effect');
          assert.equal(event.ownerActorType, 'player');
        }

        if (event.source === 'Elementalist proc') assert.equal(event.metadata.procCount, 2);
      }
    }
  });
  assert.deepEqual(trace, ['Burning', 'Bleeding', 'Poisoned', 'observer', 'Vulnerability']);
});

// Independent companion conditions need concrete owner identity even when the parent hit is player-attributed.
test('profession condition adapters retain pet and mech ownership without copying trigger annotations', () => {
  const packets = [];
  const config = { selectedPet: 'Carrion Devourer', selectedTraitIds: [] };
  const context = {
    config,
    profession: { core: createRangerCoreState(config) },
    queue: { enqueue: (event) => packets.push(event) },
    applyCondition: (event) => packets.push(event)
  };
  queueCondition(
    context,
    { ...trigger, source: 'ranger-pet', summonOwner: 'pet:old-generation' },
    'Bleeding',
    4,
    2,
    10,
    'Pet proc'
  );
  const pet = packets[0];
  assert.equal(pet.actorType, 'summon');
  assert.equal(pet.summonOwner, 'pet:old-generation');
  assert.equal(pet.independentConditionOwner, true);
  assert.equal(typeof pet.summonBaseConditionDamage, 'number');
  assert.equal(pet.metadata, undefined);
  applyEngineerDerivedCondition(
    context,
    { ...trigger, actorType: 'summon', summonOwner: 'mech:1', independentConditionOwner: true },
    {
      name: 'Mech proc',
      condition: 'Bleeding',
      stacks: 3,
      duration: 4,
      actorType: 'summon',
      metadata: { fixedDuration: true, engineerMech: true },
      procCount: 2
    }
  );
  const mech = packets[1];
  assert.equal(mech.summonOwner, 'mech:1');
  assert.equal(mech.independentConditionOwner, true);
  assert.equal(mech.fixedDuration, true);
  assert.deepEqual(mech.metadata, { procCount: 2 });
  assert.equal(mech.holosmithStrikeFactor, undefined);
});

// Fresh boons sample live duration once; generic buffs and explicitly fixed durations bypass scaling.
test('derived boons scale once using live stats while preserving fixed durations and recipients', () => {
  const packets = [];
  let concentration = 750;
  let samples = 0;
  const context = {
    config: {},
    activeWeaponSet: 1,
    query: {
      statsAt() {
        samples++;
        return { concentration };
      }
    },
    queue: { enqueue: (event) => packets.push(event) }
  };
  queueSoulbeastBuff(context, trigger, 'might', 4, 1, 'Vulture Stance', 10);
  concentration = 1500;
  queueSoulbeastBuff(context, trigger, 'might', 4, 1, 'Vulture Stance', 10);
  queueSoulbeastBuff(context, trigger, 'twice-as-vicious', 4, 1, 'Twice as Vicious', 11);
  const fixed = buildResolverBuff({
    at: 1,
    source: 'fixture',
    sourceId: 'fixed',
    actorType: 'effect',
    kind: 'might',
    duration: 4,
    stacks: 1,
    fixedDuration: true,
    priority: 5,
    audience: { recipients: 'summons', eligibleCompanionIds: ['pet:1'] }
  });
  queueResolverBoon(context, trigger, fixed);
  assert.deepEqual(
    packets.map((event) => event.duration),
    [6, 8, 4, 4]
  );
  assert.equal(samples, 2);
  assert.deepEqual(packets[3].audience, fixed.audience);
  assert.equal(packets[3].priority, 5);
});

// A derived strike owns its finisher and does not inherit the triggering player's proc eligibility.
test('Engineer derived strikes retain their owner and one combo descriptor', () => {
  const packets = [];
  const context = {
    combo: { fields: new Map() },
    queue: {
      enqueue(event) {
        packets.push(event);
        return event;
      }
    }
  };
  queueDamage(context, trigger, {
    name: 'Derived blast',
    sourceId: 42,
    coefficient: 0.5,
    actorType: 'effect',
    ownerActorType: 'player',
    comboFinisher: { ownerId: 'engineer', attemptId: 'blast:1', finisherType: 'Blast' }
  });
  const [strike] = packets;
  assert.equal(packets.length, 1);
  assert.equal(strike.hitIndex, 1);
  assert.equal(strike.skillId, undefined);
  assert.equal(strike.skillWeapon, 'Unequipped');
  assert.equal(strike.holosmithStrikeFactor, undefined);
  assert.equal(strike.comboFinishers[0].finisherType, 'Blast');
  assert.equal(strike.sourceId, 42);
  assert.equal(strike.actorType, 'effect');
  assert.equal(strike.ownerActorType, 'player');
});

// Delayed paired effects use the captured heat tier rather than current profession state.
test('Holosmith delayed packets retain activation heat after live heat and traits change', () => {
  const packets = [];
  const context = {
    config: { selectedTraitIds: [] },
    helpers: engineerCatalog,
    profession: { specialization: { kind: 'Holosmith', state: { heat: 0 } } },
    queue: { enqueue: (event) => packets.push(event) }
  };
  holosmithResolverEventHandlers['engineer.prime-light-beam-field'](context, {
    ...trigger,
    type: 'engineer.prime-light-beam-field',
    holosmithActivationHeat: 101,
    holosmithEnhancedCapacitySelected: true
  });
  const strike = packets.findLast((event) => event.type === 'damage');
  const condition = packets.findLast((event) => event.type === 'condition');
  assert.ok(strike.at > trigger.at);
  assert.equal(strike.holosmithStrikeFactor, 1.2);
  assert.equal(condition.at, strike.at);
  assert.equal(condition.holosmithConditionBaseDurationFactor, 1.5);
});

// A flat siphon must continue bypassing weapon strength, armor and critical multipliers.
test('neutral strike construction preserves the flat siphon formula and no-crit policy', () => {
  const siphon = buildResolverStrike({
    at: 1,
    source: 'Trait',
    sourceId: 'siphon',
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Siphon',
    flatStrikeBase: 99,
    flatStrikePowerCoeff: 0.005,
    noCrit: true,
    lifeSiphon: true
  });
  const result = resolveTestGw2Events({
    config: { stats: { power: 2000, precision: 4000, ferocity: 1500 }, target: { armor: 9000 } },
    traits: new Set(),
    ...{ events: [siphon], endTime: 2 }
  });
  assert.equal(result.strikeDamage, 109);
  assert.equal(result.resolvedEvents.find((event) => event.type === 'damage').critEligible, false);
});

// Explicit packet names and lineage survive default construction without changing caller metadata.
test('neutral packets retain explicit labels, activation identity and duration policy', () => {
  const packet = buildResolverCondition({
    at: 2,
    source: 'Trait',
    sourceId: 7,
    actorType: 'effect',
    skillId: 8,
    skillName: 'Actual skill',
    name: 'Display label',
    triggeredBy: resolverSourceSkill(trigger),
    activationId: 'child:1',
    priority: 5,
    condition: 'Bleeding',
    stacks: 2,
    duration: 4,
    fixedDuration: true,
    metadata: { procCount: 3 }
  });
  assert.equal(packet.name, 'Display label');
  assert.equal(packet.skillId, 8);
  assert.equal(packet.triggeredBy, 'Trigger');
  assert.equal(packet.activationId, 'child:1');
  assert.equal(packet.priority, 5);
  assert.equal(packet.duration, 4);
  assert.equal(packet.fixedDuration, true);
  assert.deepEqual(packet.metadata, { procCount: 3 });
  assert.equal(resolverSourceSkill({ name: 'Fallback name', source: 'Source' }), 'Fallback name');
  assert.equal(resolverSourceSkill({ source: 'Source' }), 'Source');
});
