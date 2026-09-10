import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { recordBuffApplication } from '#gw2/platform/combat/state/boons.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createGuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/traits/modifiers.js';
import { reactToRighteousInstincts } from '#gw2/professions/guardian/core/traits/radiance.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { firebrandModifierRules } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes-and-mantras.js';

// Build real recipient metadata so player queries can distinguish shared, ally-only, and companion-only applications.
function buff(kind, audience = { recipients: 'self' }) {
  const event = { type: 'buff', source: 'Fixture', actorType: 'player', at: 4, duration: 2, stacks: 1, kind, audience };
  return {
    ...event,
    resolvedAudience: gw2BoonApplicationRecipients({ allies: { count: 4 } }, event)
  };
}

test('Guardian boons prefer live self applications over later same-time timeline events', () => {
  for (const kind of ['aegis', 'might', 'quickness']) {
    const self = buff(kind, { recipients: 'party' });
    const timeline = createGw2TimelineIndex({ events: [self] });
    const context = { time: 4, timeline, runtime: { boons: new Map() } };
    assert.equal(guardianBoonActive({ time: 4, timeline }, kind), true);
    assert.equal(guardianBoonActive(context, kind), false);
    for (const audience of [
      { recipients: 'party', affectsSelf: false },
      { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: ['pet'] }
    ]) {
      recordBuffApplication(context.runtime.boons, buff(kind, audience));
      assert.equal(guardianBoonActive(context, kind), false);
    }

    recordBuffApplication(context.runtime.boons, self);
    assert.equal(guardianBoonActive(context, kind), true);
    assert.equal(guardianBoonActive({ ...context, time: 3 }, kind), false);
    assert.equal(guardianBoonActive({ ...context, time: 6 }, kind), false);
    assert.equal(guardianBoonActive({ ...context, time: 6, config: { boons: { [kind]: true } } }, kind), true);
    assert.equal(guardianBoonActive({ time: 4 }, kind), false);
  }
});

test('Firebrand Imbued Haste follows the live duration pool and its expiry', () => {
  const event = buff('quickness');
  const context = { time: 4, timeline: createGw2TimelineIndex({ events: [event] }), runtime: { boons: new Map() } };
  const rule = firebrandModifierRules.find(({ id }) => id === 'guardian.firebrand.imbued-haste-attributes');
  assert.equal(rule.amount(context, 'attributeConditionDamage', rule.parameters), 0);
  recordBuffApplication(context.runtime.boons, event);
  recordBuffApplication(context.runtime.boons, event);
  // Two overlapping two-second applications last four seconds, beyond either individual expiry.
  assert.equal(rule.amount({ ...context, time: 6 }, 'attributeConditionDamage', rule.parameters), 250);
  assert.equal(rule.amount({ ...context, time: 8 }, 'attributeConditionDamage', rule.parameters), 0);
});

test('Righteous Instincts preserves stacked self Resolution without accepting other recipients', () => {
  const core = createGuardianCoreState();
  const runtime = createGw2ResolverRuntimeState({
    config: {},
    traits: new Set([TRAIT.RIGHTEOUS_INSTINCTS]),
    professionState: { core },
    horizon: 10,
    queue: new StableEventQueue(),
    query: { statsAt: () => ({}) },
    helpers: {}
  });
  const others = buff('resolution', { recipients: 'party', affectsSelf: false });
  recordBuffApplication(runtime.boons, others);
  reactToRighteousInstincts(runtime, others);
  assert.equal(core.resolutionUntil, 0);
  assert.equal(core.righteousNextMightAt, 0);
  assert.equal(guardianBoonActive({ time: 4, runtime }, 'resolution'), false);

  const self = buff('resolution');
  for (let index = 0; index < 2; index += 1) {
    recordBuffApplication(runtime.boons, self);
    reactToRighteousInstincts(runtime, self);
  }

  reactToRighteousInstincts(runtime, others);
  assert.equal(core.resolutionUntil, 8);
  assert.equal(core.righteousNextMightAt, 5);
  assert.equal(guardianBoonActive({ time: 6, runtime }, 'resolution'), true);
  assert.equal(guardianBoonActive({ time: 8, runtime }, 'resolution'), false);
  assert.equal(guardianBoonActive({ time: 6, runtime: { profession: { resolutionUntil: 8 } } }, 'resolution'), true);
});
