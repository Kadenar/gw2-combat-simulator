import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/traits/modifiers.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { firebrandModifierRules } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes-and-mantras.js';

// Build real recipient metadata so player queries can distinguish shared, ally-only, and companion-only applications.
function buff(kind, audience = { recipients: 'self' }) {
  const event = {
    type: 'buff',
    source: 'Fixture',
    sourceId: 'fixture-boon',
    actorType: 'player',
    at: 4,
    duration: 2,
    stacks: 1,
    kind,
    audience
  };
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
  assert.equal(rule.amount({ catalog: guardianCatalog, ...context }, 'attributeConditionDamage', rule.parameters), 0);
  recordBuffApplication(context.runtime.boons, event);
  recordBuffApplication(context.runtime.boons, event);
  // Two overlapping two-second applications last four seconds, beyond either individual expiry.
  assert.equal(
    rule.amount({ catalog: guardianCatalog, ...context, time: 6 }, 'attributeConditionDamage', rule.parameters),
    250
  );
  assert.equal(
    rule.amount({ catalog: guardianCatalog, ...context, time: 8 }, 'attributeConditionDamage', rule.parameters),
    0
  );
});

test('Righteous Instincts preserves stacked self Resolution without accepting other recipients', () => {
  const others = buff('resolution', { recipients: 'party', affectsSelf: false });
  // Actual deliveries extend one self-duration pool and one recurring Might cadence.
  for (const self of [false, true]) {
    const result = runGuardian(
      [{ type: 'wait', durationMs: 8000 }],
      { selectedTraitIds: [TRAIT.RIGHTEOUS_INSTINCTS], allies: { count: 4 } },
      (runtime) => {
        runtime.emit(others);
        if (self) {
          runtime.emit(buff('resolution'));
          runtime.emit(buff('resolution'));
        }

        runtime.emit(others);
      }
    );
    const runtime = observedRuntime(result);
    const might = result.events.filter(
      (event) => event.type === 'buff' && event.sourceId === TRAIT.RIGHTEOUS_INSTINCTS
    );
    assert.deepEqual(
      might.map((event) => event.at),
      self ? [4, 5, 6, 7] : []
    );
    assert.equal(guardianBoonActive({ time: 6, runtime }, 'resolution'), self);
    assert.equal(guardianBoonActive({ time: 8, runtime }, 'resolution'), false);
    assert.equal(runtime.profession.core.resolutionUntil, 0);
  }
});
