// Focused equipment histories protect proc eligibility, shared cooldowns, and live boon/condition state.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { applyRuntimeSigilStrike } from '#gw2/platform/equipment/sigils/runtime.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { enteredCombat } from '#tests/helpers/engagement.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

const owner = { source: 'Fixture', sourceId: 'strike', actorType: 'player' };
const strike = (at, overrides = {}) => ({
  ...owner,
  type: 'damage',
  at,
  coefficient: 1,
  weaponStrength: 1000,
  skillName: 'Strike',
  ...overrides
});

for (const [name, cooldown] of [
  ['Strength', 1],
  ['Frailty', 2]
]) {
  test(`${name} requires eligible hits and shares its cooldown across duplicate sockets and weapon sets`, () => {
    const id = SIGIL_IDS[name.toUpperCase()];
    const deadline = 1 + cooldown;
    const result = resolveTestGw2Events({
      config: {
        attributeInputs: baseAttributeInputs({ power: 1000, precision: 4000 }),
        target: { defiant: true },
        sigilSets: [{ names: [name, name] }, { names: [name] }]
      },
      events: [
        strike(0.1, { actorType: 'summon' }),
        strike(0.2, { offTarget: true }),
        strike(0.3, { coefficient: 0 }),
        ...(name === 'Strength' ? [strike(0.4, { canCrit: false })] : []),
        strike(1, { canCrit: name === 'Strength' }),
        { ...owner, type: 'weapon_set', at: 1.1, weaponSet: 2 },
        strike(1.5),
        strike(deadline),
        strike(deadline + 0.001)
      ],
      endTime: deadline + 0.1
    });
    const applications = result.events.filter((event) => event.sourceId === `sigil.${id}`);
    assert.deepEqual(
      applications.map((event) => event.at),
      [1, deadline + 0.001]
    );
    assert.ok(applications.every((event) => event.ownerActorType === 'player'));
  });

  test(`${name} cannot proc from an inactive weapon set`, () => {
    const result = resolveTestGw2Events({
      config: {
        attributeInputs: baseAttributeInputs({ precision: 4000 }),
        target: { defiant: true },
        sigilSets: [{ names: [] }, { names: [name] }]
      },
      events: [strike(1)],
      endTime: 2
    });
    assert.ok(!result.events.some((event) => event.source === 'Sigil'));
  });
}

test('Strength Might scales with boon duration, increases live attributes, and expires in both output modes', () => {
  for (const output of ['detailed', 'score']) {
    const observed = [];
    const result = resolveTestGw2Events({
      output,
      config: {
        attributeInputs: baseAttributeInputs({ power: 1000, precision: 4000, concentration: 750 }),
        sigilSets: [{ names: ['Strength'] }]
      },
      events: [strike(1), strike(2, { canCrit: false }), strike(16, { canCrit: false })],
      endTime: 17,
      engineReactions: {
        'damage.resolved': (ctx, event) => {
          const stats = ctx.query.statsAt(event.at, event, ctx);
          observed.push([event.at, ctx.combat.activeBoonStacks('might', event.at), stats.power]);
        }
      }
    });
    assert.deepEqual(observed, [
      [1, 0, 1000],
      [2, 1, 1030],
      [16, 0, 1000]
    ]);

    if (output === 'detailed') {
      const might = result.events.find((event) => event.sourceId === `sigil.${SIGIL_IDS.STRENGTH}`);
      assert.equal(might.kind, 'might');
      assert.equal(might.stacks, 1);
      assert.equal(might.duration, 15);
    }
  }
});

test('Frailty rejects non-defiant hits without spending its cooldown', () => {
  const captured = captureEffectEmissions();
  const runtime = {
    ...createGw2ResolverRuntimeState({ config: {} }),
    engagement: enteredCombat(),
    activeWeaponSet: 1,
    config: { target: { defiant: false }, sigilSets: [{ names: ['Frailty'] }] },
    effects: captured.effects
  };
  applyRuntimeSigilStrike(runtime, strike(1));
  assert.deepEqual(captured.events, []);
  assert.equal(runtime.procs.deadline(`sigil.${SIGIL_IDS.FRAILTY}`), 0);
  runtime.config.target.defiant = true;
  applyRuntimeSigilStrike(runtime, strike(1.1, { canCrit: false }));
  assert.equal(runtime.procs.deadline(`sigil.${SIGIL_IDS.FRAILTY}`), 3.1);
  assert.equal(captured.events[0].condition, 'Vulnerability');
  assert.equal(captured.events[0].stacks, 2);
  assert.equal(captured.events[0].duration, 8);
});

test('Frailty Vulnerability scales with expertise and persists after swapping until expiry', () => {
  for (const output of ['detailed', 'score']) {
    const observed = [];
    resolveTestGw2Events({
      output,
      config: {
        attributeInputs: baseAttributeInputs({ power: 1000, expertise: 750 }),
        target: { defiant: true },
        sigilSets: [{ names: ['Frailty'] }, { names: [] }]
      },
      events: [
        strike(1, { canCrit: false }),
        { ...owner, type: 'weapon_set', at: 1.1, weaponSet: 2 },
        strike(2, { canCrit: false }),
        strike(12.9, { canCrit: false }),
        strike(13.04, { canCrit: false })
      ],
      endTime: 14,
      engineReactions: {
        'damage.resolved': (ctx, event) => {
          observed.push([event.at, ctx.query.vulnerabilityStacksAt(event.at, ctx)]);
        }
      }
    });
    assert.deepEqual(observed, [
      [1, 0],
      [2, 2],
      [12.9, 2],
      [13.04, 0]
    ]);
  }
});
