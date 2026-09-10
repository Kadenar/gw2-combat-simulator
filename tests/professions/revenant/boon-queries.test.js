import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { recordBuffApplication } from '#gw2/platform/combat/state/boons.js';
import {
  revenantActiveBoonCount,
  revenantCoreAttributeRules,
  revenantCoreModifierRules,
  revenantTimedBuff
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import { renegadeModifierRules } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-rules.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

// Recipient metadata keeps player boons distinct from party-only and companion-only applications.
function buff(kind, audience = { recipients: 'self' }, stacks = 1) {
  const event = { type: 'buff', source: 'Fixture', actorType: 'player', at: 4, duration: 2, kind, stacks, audience };
  return { ...event, resolvedAudience: gw2BoonApplicationRecipients({ allies: { count: 4 } }, event) };
}

test('Revenant and Renegade use live self boons, duration stacking, and timeline fallback consistently', () => {
  const fury = buff('fury');
  const resolution = buff('resolution');
  const context = {
    time: 4,
    event: { actorType: 'player' },
    condition: 'Bleeding',
    traits: new Set([TRAIT.ROILING_MISTS, TRAIT.VICIOUS_REPRISAL, TRAIT.BLOOD_FURY]),
    timeline: createGw2TimelineIndex({ events: [fury, resolution] }),
    runtime: { boons: new Map() }
  };
  const reprisal = revenantCoreModifierRules.find(({ id }) => id === 'revenant.vicious-reprisal');
  const bloodFury = renegadeModifierRules.find(({ id }) => id === 'revenant.blood-fury-bleeding-duration');
  const criticalBonus = (value) => revenantCoreAttributeRules.modifyCriticalChance(value, 0);
  assert.equal(revenantActiveBoonCount({ ...context, runtime: undefined }), 2);
  assert.equal(bloodFury.when({ ...context, runtime: undefined }), true);
  for (const kind of ['fury', 'resolution']) {
    recordBuffApplication(context.runtime.boons, buff(kind, { recipients: 'party', affectsSelf: false }));
    recordBuffApplication(
      context.runtime.boons,
      buff(kind, { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: ['pet'] })
    );
  }

  assert.equal(revenantActiveBoonCount(context), 0);
  assert.equal(reprisal.when(context), false);
  assert.equal(bloodFury.when(context), false);
  assert.equal(criticalBonus(context), 0);
  recordBuffApplication(context.runtime.boons, fury);
  recordBuffApplication(context.runtime.boons, fury);
  recordBuffApplication(context.runtime.boons, resolution);
  assert.equal(revenantActiveBoonCount(context), 2);
  assert.equal(reprisal.when(context), true);
  assert.equal(bloodFury.when(context), true);
  assert.equal(criticalBonus(context), 0.25);
  assert.equal(revenantActiveBoonCount({ ...context, time: 3 }), 0);
  assert.equal(revenantActiveBoonCount({ ...context, time: 6 }), 1);
  assert.equal(bloodFury.when({ ...context, time: 6 }), true);
  assert.equal(reprisal.when({ ...context, time: 6 }), false);
  assert.equal(criticalBonus({ ...context, time: 8 }), 0);
  assert.equal(revenantActiveBoonCount({ ...context, time: 8 }), 0);
  assert.equal(revenantActiveBoonCount({ time: 8, config: { boons: { fury: true, might: 25, vigor: 0 } } }), 2);
  assert.equal(revenantActiveBoonCount({ time: 8 }), 0);
});

test('Notoriety converts configured and live self Might with explicit zero stacks and a combined cap', () => {
  const context = {
    time: 4,
    config: { boons: { might: 4 } },
    traits: new Set([TRAIT.NOTORIETY]),
    runtime: { boons: new Map() }
  };
  recordBuffApplication(context.runtime.boons, buff('might', { recipients: 'party' }, 3));
  recordBuffApplication(context.runtime.boons, buff('might', { recipients: 'party', affectsSelf: false }, 20));
  const applications = context.runtime.boons.get('might');
  applications.push(
    { at: 0, expiresAt: 4, stacks: 20, resolvedAudience: { includesSelf: true } },
    { at: 5, expiresAt: 10, stacks: 20, resolvedAudience: { includesSelf: true } },
    { at: 4, expiresAt: 10, stacks: 0, resolvedAudience: { includesSelf: true } }
  );
  const attributes = { power: 1000, conditionDamage: 1000 };
  assert.deepEqual(revenantCoreAttributeRules.modifyAttributes(context, attributes), {
    power: 1070,
    conditionDamage: 930
  });
  assert.deepEqual(revenantCoreAttributeRules.modifyAttributes({ ...context, time: 5 }, attributes), {
    power: 1250,
    conditionDamage: 750
  });
  assert.deepEqual(revenantCoreAttributeRules.modifyAttributes({ ...context, time: 10 }, attributes), {
    power: 1040,
    conditionDamage: 960
  });
  assert.deepEqual(revenantCoreAttributeRules.modifyAttributes({ ...context, runtime: undefined }, attributes), {
    power: 1040,
    conditionDamage: 960
  });
  assert.deepEqual(attributes, { power: 1000, conditionDamage: 1000 });
});

test('Herald custom buffs retain their local query and never count as standard boons', () => {
  const context = {
    time: 4,
    runtime: { boons: new Map([['burst-of-strength', [{ at: 4, expiresAt: 6, stacks: 1 }]]]) }
  };
  assert.equal(revenantTimedBuff(context, 'burst-of-strength'), true);
  assert.equal(revenantTimedBuff({ ...context, time: 6 }, 'burst-of-strength'), false);
  assert.equal(revenantActiveBoonCount(context), 0);
});
