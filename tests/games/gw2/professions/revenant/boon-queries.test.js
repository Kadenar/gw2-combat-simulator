// Resolve baseline and adjusted Might together while leaving the source attributes immutable.
function notorietyAttributes(context, attributes) {
  const facts = attributeContext(context, { catalog: revenantCatalog, modifierRulesById: new Map() });
  return applyMightAttributes(attributes, activeBoonStacks(context, 'might'), [notoriety.attributes(facts)]);
}

import { applyMightAttributes, attributeContext } from '#gw2/platform/builds/attribute-evaluation.js';
import { notoriety } from '#gw2/professions/revenant/core/traits/devastation/index.js';
import { activeBoonStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { buffActive, countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
const revenantCoreModifierRules = revenantCoreModule.modifiers.modifierRules;
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { revenantCoreModifiers } from '#gw2/professions/revenant/core/modifiers.js';
import { renegadeModule } from '#gw2/professions/revenant/specializations/renegade/module.js';
const renegadeModifierRules = renegadeModule.modifiers.modifierRules;
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
    runtime: { boons: new Map(), buffs: new Map() }
  };
  const reprisal = revenantCoreModifierRules.find(({ id }) => id === 'revenant.vicious-reprisal');
  const bloodFury = renegadeModifierRules.find(({ id }) => id === 'revenant.blood-fury-bleeding-duration');
  const criticalBonus = (value) =>
    revenantCoreModifiers.modifyCriticalChance({ catalog: revenantCatalog, ...value }, 0);
  assert.equal(countActiveBoons({ ...context, runtime: undefined }), 2);
  assert.equal(bloodFury.when({ ...context, runtime: undefined }), true);
  for (const kind of ['fury', 'resolution']) {
    recordBuffApplication(context.runtime.boons, buff(kind, { recipients: 'party', affectsSelf: false }));
    recordBuffApplication(
      context.runtime.boons,
      buff(kind, { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: ['pet'] })
    );
  }

  assert.equal(countActiveBoons(context), 0);
  assert.equal(reprisal.when(context), false);
  assert.equal(bloodFury.when(context), false);
  assert.equal(criticalBonus(context), 0);
  recordBuffApplication(context.runtime.boons, fury);
  recordBuffApplication(context.runtime.boons, fury);
  recordBuffApplication(context.runtime.boons, resolution);
  assert.equal(countActiveBoons(context), 2);
  assert.equal(reprisal.when(context), true);
  assert.equal(bloodFury.when(context), true);
  assert.equal(criticalBonus(context), 0.25);
  assert.equal(countActiveBoons({ ...context, time: 3 }), 0);
  assert.equal(countActiveBoons({ ...context, time: 6 }), 1);
  assert.equal(bloodFury.when({ ...context, time: 6 }), true);
  assert.equal(reprisal.when({ ...context, time: 6 }), false);
  assert.equal(criticalBonus({ ...context, time: 8 }), 0);
  assert.equal(countActiveBoons({ ...context, time: 8 }), 0);
  assert.equal(countActiveBoons({ time: 8, config: { boons: { fury: true, might: 25, vigor: 0 } } }), 2);
  assert.equal(countActiveBoons({ time: 8 }), 0);
});

test('Notoriety converts configured and live self Might with a combined cap', () => {
  const context = {
    time: 4,
    config: { boons: { might: 4 } },
    traits: new Set([TRAIT.NOTORIETY]),
    runtime: { boons: new Map(), buffs: new Map() }
  };
  recordBuffApplication(context.runtime.boons, buff('might', { recipients: 'party' }, 3));
  recordBuffApplication(context.runtime.boons, buff('might', { recipients: 'party', affectsSelf: false }, 20));
  const applications = context.runtime.boons.get('might');
  applications.push(
    { at: 0, expiresAt: 4, stacks: 20, resolvedAudience: { includesSelf: true } },
    { at: 5, expiresAt: 10, stacks: 20, resolvedAudience: { includesSelf: true } }
  );
  const attributes = { power: 1000, conditionDamage: 1000 };
  assert.deepEqual(notorietyAttributes({ catalog: revenantCatalog, ...context }, attributes), {
    power: 1280,
    conditionDamage: 1140
  });
  assert.deepEqual(notorietyAttributes({ catalog: revenantCatalog, ...context, time: 5 }, attributes), {
    power: 2000,
    conditionDamage: 1500
  });
  assert.deepEqual(notorietyAttributes({ catalog: revenantCatalog, ...context, time: 10 }, attributes), {
    power: 1160,
    conditionDamage: 1080
  });
  assert.deepEqual(notorietyAttributes({ catalog: revenantCatalog, ...context, runtime: undefined }, attributes), {
    power: 1160,
    conditionDamage: 1080
  });
  assert.deepEqual(attributes, { power: 1000, conditionDamage: 1000 });
});

test('Herald custom buffs retain their local query and never count as standard boons', () => {
  const context = {
    time: 4,
    runtime: {
      boons: new Map([]),
      buffs: new Map([
        ['burst-of-strength', [{ resolvedAudience: { includesSelf: true }, at: 4, expiresAt: 6, stacks: 1 }]]
      ])
    }
  };
  assert.equal(buffActive(context, 'burst-of-strength'), true);
  assert.equal(buffActive({ ...context, time: 6 }, 'burst-of-strength'), false);
  assert.equal(countActiveBoons(context), 0);
});
