import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildResolverBuff,
  buildResolverCondition,
  buildResolverStrike,
  resolverSourceSkill
} from '#gw2/platform/effects/packet-builders.js';
import {
  buildEngineerCondition,
  buildEngineerStrike
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { holosmithSlotEventHandlers } from '#gw2/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { buildRangerCondition } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
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
  canCrit: false,
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
          // Computed applications enter the same service; only transaction visibility differs.
          context.effects.emit({
            kind: 'packet',
            cause: event,
            settlement: 'reaction',
            event: buildResolverCondition({
              at: event.at,
              source: 'Elementalist proc',
              sourceId: 1,
              actorType: 'player',
              condition: 'Burning',
              stacks: 1,
              duration: 1,
              metadata: { procCount: 2 }
            })
          });
          context.effects.emit({
            kind: 'packet',
            cause: event,
            settlement: 'reaction',
            event: buildEngineerCondition(event, {
              name: 'Engineer proc',
              condition: 'Bleeding',
              stacks: 1,
              duration: 1,
              actorType: 'effect',
              ownerActorType: 'player'
            })
          });
          context.effects.emit({
            kind: 'packet',
            cause: event,
            settlement: 'reaction',
            event: buildResolverCondition({
              at: event.at,
              source: 'Trait',
              sourceId: 2,
              actorType: 'effect',
              ownerActorType: 'player',
              condition: 'Poisoned',
              stacks: 1,
              duration: 1
            })
          });
          context.effects.emit({
            kind: 'packet',
            cause: event,
            event: buildResolverCondition({
              at: event.at,
              source: 'Trait',
              sourceId: 3,
              actorType: 'effect',
              condition: 'Vulnerability',
              stacks: 1,
              duration: 1
            })
          });
        } else {
          assert.ok(context.combat.targetHasCondition('Burning', event.at, context));
          assert.ok(context.combat.targetHasCondition('Bleeding', event.at, context));
          assert.ok(context.combat.targetHasCondition('Poisoned', event.at, context));
          assert.equal(context.combat.targetHasCondition('Vulnerability', event.at, context), false);
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
test('profession packet builders retain pet and mech ownership without copying trigger annotations', () => {
  const { effects, events: packets } = captureEffectEmissions();
  const config = { selectedPet: 'Carrion Devourer', selectedTraitIds: [] };
  const context = { config, profession: { core: createRangerCoreState(config) } };
  effects.emit({
    kind: 'packet',
    event: buildRangerCondition(
      context,
      { ...trigger, source: 'ranger-pet', summonOwner: 'pet:old-generation' },
      'Bleeding',
      4,
      2,
      10,
      'Pet proc'
    )
  });
  const pet = packets[0];
  assert.equal(pet.actorType, 'summon');
  assert.equal(pet.summonOwner, 'pet:old-generation');
  assert.equal(pet.independentConditionOwner, true);
  assert.equal(typeof pet.summonBaseConditionDamage, 'number');
  assert.equal(pet.metadata, undefined);
  effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildEngineerCondition(
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
    )
  });
  const mech = packets[1];
  assert.equal(mech.summonOwner, 'mech:1');
  assert.equal(mech.independentConditionOwner, true);
  assert.equal(mech.fixedDuration, true);
  // Explicit mech identity selects companion attributes without inheriting trigger annotations.
  assert.deepEqual(mech.metadata, { engineerMech: true, procCount: 2 });
  assert.equal(mech.summonInheritsAttributes, true);
  assert.equal(mech.holosmithStrikeFactor, undefined);
});

// Fresh boons sample live duration once; generic buffs and explicitly fixed durations bypass scaling.
test('derived boons scale once using live stats while preserving fixed durations and recipients', () => {
  const fixed = buildResolverBuff({
    at: 2,
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
  const events = [1, 2].map((at) =>
    buildResolverBuff({ at, source: 'Trait', sourceId: 10, actorType: 'effect', kind: 'might', duration: 4, stacks: 1 })
  );
  events.push(
    buildResolverBuff({
      at: 2,
      source: 'Trait',
      sourceId: 11,
      actorType: 'effect',
      kind: 'twice-as-vicious',
      duration: 4,
      stacks: 1
    }),
    fixed
  );
  const result = resolveTestGw2Events({
    events,
    buffPolicies: [{ kind: 'twice-as-vicious', maximumStacks: 1 }],
    endTime: 2,
    query: { statsAt: (at) => ({ concentration: at === 1 ? 750 : 1500 }) }
  });
  const packets = result.events.filter((event) => event.type === 'buff');
  assert.deepEqual(
    packets.map((event) => event.duration),
    [6, 8, 4, 4]
  );
  assert.deepEqual(packets[3].audience, fixed.audience);
  assert.equal(packets[3].priority, 5);
});

// A derived strike owns its finisher and does not inherit the triggering player's proc eligibility.
test('Engineer derived strikes retain their owner and one combo descriptor', () => {
  const { effects, events: packets } = captureEffectEmissions();
  effects.emit({
    kind: 'packet',
    event: buildEngineerStrike(trigger, {
      skillWeapon: 'Unequipped',
      name: 'Derived blast',
      sourceId: 42,
      coefficient: 0.5,
      actorType: 'effect',
      ownerActorType: 'player',
      comboFinisher: { ownerId: 'engineer', finisherType: 'Blast' }
    })
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

// The general Engineer helper preserves a caller's weapon choice independently of the actor or trigger.
test('Engineer strikes require explicit weapon attribution for weapon and effect actors', () => {
  for (const [actorType, skillWeapon] of [
    ['player', 'Rifle'],
    ['player', 'Spear'],
    ['effect', 'Unequipped']
  ]) {
    const packet = buildEngineerStrike(trigger, { name: 'Explicit weapon', coefficient: 1, actorType, skillWeapon });
    assert.equal(packet.skillWeapon, skillWeapon);
  }
});

// Delayed paired effects use the captured heat tier rather than current profession state.
test('Holosmith delayed packets retain activation heat after live heat and traits change', () => {
  const { effects, events: packets } = captureEffectEmissions();
  const context = {
    config: { selectedTraitIds: [] },
    helpers: engineerCatalog,
    profession: { specialization: { kind: 'Holosmith', state: { heat: 0 } } },
    effects
  };
  holosmithSlotEventHandlers['engineer.prime-light-beam-field'](context, {
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
    canCrit: false,
    damageKind: 'life-steal'
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
