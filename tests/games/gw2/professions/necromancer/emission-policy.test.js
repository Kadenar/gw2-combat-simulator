import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2BuffApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { harbingerCastEmissionPolicy } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/cast-emission-policy.js';
import { ritualistPartyBoonPolicy } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/party-boons.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

// A granting source can override the trigger's identity without changing its cast or Blight snapshot.
test('Harbinger cast policy preserves per-effect ownership and independent trait activations', () => {
  const { effects, events } = captureEffectEmissions();
  const skill = { id: 'test.elixir', name: 'Elixir', type: 'Utility' };
  const cast = { id: 'cast:elixir', skill, command: { offTarget: true } };
  effects.emit({
    kind: 'profile',
    profile: skill,
    effects: [
      { type: 'strike', coefficient: 1 },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1,
        source: 'Trait',
        sourceId: 'test.brew',
        actorType: 'effect'
      }
    ],
    ...harbingerCastEmissionPolicy(cast, skill, { necromancerBlight: 7 })
  });
  const strike = events.find((event) => event.type === 'damage');
  const boon = events.find((event) => event.type === 'buff');
  assert.equal(strike.source, 'necromancer');
  assert.equal(strike.actorType, 'player');
  assert.equal(boon.source, 'Trait');
  assert.equal(boon.sourceId, 'test.brew');
  assert.equal(boon.actorType, 'effect');
  for (const event of [strike, boon]) {
    assert.equal(event.activationId, cast.id);
    assert.equal(event.skillId, skill.id);
    assert.equal(event.parentSkillName, undefined);
    assert.equal(event.metadata.necromancerBlight, 7);
    assert.equal(event.offTarget, true);
  }

  const trait = { id: 'test.corruption', name: 'Corruption', type: 'Trait' };
  effects.emit({
    kind: 'profile',
    profile: trait,
    effects: [{ type: 'condition', condition: 'Torment', duration: 5, stacks: 1 }],
    ...harbingerCastEmissionPolicy(cast, trait)
  });
  const condition = events.find((event) => event.type === 'condition');
  assert.equal(condition.source, 'Trait');
  assert.equal(condition.sourceId, trait.id);
  assert.equal(condition.actorType, 'effect');
  assert.equal(condition.activationId, `${cast.id}:effect:${trait.id}`);
  assert.equal(condition.skillId, trait.id);
  assert.equal(condition.parentSkillName, skill.name);
  assert.equal(condition.name, 'Corruption — Torment');
  assert.equal(condition.offTarget, true);
});

// Eligibility must be sampled for each emission so summoned and removed companions occupy the correct party slots.
test('Ritualist party policy uses live companion eligibility and preserves the triggering cast', () => {
  const runtime = {
    profession: {
      core: { activeMinions: {} },
      specialization: { kind: 'Ritualist', state: { activeSpirits: {} } }
    }
  };
  const skill = { id: 'test.preservation', name: 'Preservation', icon: 'spirit-icon' };
  const cast = { id: 'cast:preservation', skill, effectiveEnd: 0, command: { offTarget: true } };
  const policy = ritualistPartyBoonPolicy(runtime, cast);
  const { effects, events } = captureEffectEmissions();
  const emit = () => {
    effects.emit({
      kind: 'profile',
      profile: skill,
      effects: [{ type: 'boon', boon: 'might', duration: 5, stacks: 1 }],
      ...policy
    });
    return events.at(-1);
  };

  const before = emit();
  assert.deepEqual(before.audience.eligibleCompanionIds, []);
  runtime.profession.core.activeMinions['bone-minion'] = 2;
  runtime.profession.specialization.state.activeSpirits.preservation = {
    skillId: skill.id,
    activationId: 'preservation',
    generation: 1,
    started: false,
    initialUntil: 0,
    busyUntil: 0
  };
  const summoned = emit();
  assert.deepEqual(summoned.audience.eligibleCompanionIds, [
    'minion:bone-minion:0',
    'minion:bone-minion:1',
    'spirit:preservation'
  ]);
  const recipients = gw2BuffApplicationRecipients({ allies: { count: 4 } }, summoned);
  assert.equal(recipients.recipientCount, 5);
  assert.equal(recipients.includesSelf, true);
  assert.equal(recipients.alliedPlayerCount, 4);
  assert.deepEqual(recipients.companionIds, []);

  runtime.profession.core.activeMinions['bone-minion'] = 0;
  delete runtime.profession.specialization.state.activeSpirits.preservation;
  assert.deepEqual(emit().audience.eligibleCompanionIds, []);
  // Already emitted packets retain the eligibility snapshot they were given.
  assert.equal(summoned.audience.eligibleCompanionIds.length, 3);
  for (const event of events) {
    assert.equal(event.source, 'necromancer');
    assert.equal(event.sourceId, skill.id);
    assert.equal(event.activationId, cast.id);
    assert.equal(event.icon, skill.icon);
    assert.equal(event.offTarget, true);
  }
});
