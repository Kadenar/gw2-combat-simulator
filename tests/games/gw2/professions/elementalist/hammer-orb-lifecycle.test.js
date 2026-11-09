/** Protect orb expiry, packet cancellation, and admission through the runtime hooks. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createEffectOwnershipContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCoreTooltips } from '#gw2/professions/elementalist/app/tooltips/core.js';
import { elementalistHammerOrbLifecycle } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { commitHammerOrbFixture } from '#tests/helpers/elementalist-hammer-orbs.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const config = { specialization: 'Core', primaryWeapon: 'Hammer', startAttunement: 'Fire', selectedTraitIds: [] };

// A fractional completion must expire on the queued deadline and release its activation for a boundary recast.
test('canonical orb expiry clears state and permits recasting at the deadline', () => {
  const options = { catalog: (catalog) => applySkillPatch(catalog, { skills: { [ID.FLAME_WHEEL]: { cooldown: 0 } } }) };
  const opening = [
    { type: 'wait', durationMs: 2240 },
    { type: 'cast', skillId: ID.FLAME_WHEEL }
  ];
  const accepted = runElementalist(opening, config, options);
  assert.deepEqual(accepted.warnings, []);
  const end = accepted.steps.find((step) => step.skillId === ID.FLAME_WHEEL).end / 1000;
  const duration = elementalistCatalog.skillsById.get(ID.FLAME_WHEEL).orbDuration;
  const expiry = canonicalTime(end + duration);
  assert.equal(observedRuntime(accepted).profession.core.hammerOrbs.Fire, expiry);
  const rotation = [...opening, { type: 'wait', durationMs: (expiry - end) * 1000 }];
  const expired = runElementalist(rotation, config, options);
  assert.deepEqual(expired.warnings, []);
  const state = observedRuntime(expired).profession.core;
  assert.equal(state.hammerOrbs.Fire, null);
  assert.equal(state.hammerOrbActivationIds.Fire, null);
  const recast = runElementalist([...rotation, { type: 'cast', skillId: ID.FLAME_WHEEL }], config, options);
  assert.deepEqual(recast.warnings, []);
  assert.ok(observedRuntime(recast).profession.core.hammerOrbs.Fire > expiry);
});

// Resource denials must win over an incompatible hand pair, with a retry only for the shared lockout.
test('dual orb lockout and duplicate denial precede Weaver hand checks', () => {
  const weaverConfig = { ...config, specialization: 'Weaver', secondaryAttunement: 'Water' };
  const result = runElementalist([], weaverConfig);
  const native = elementalistProfession.runtimeFor(weaverConfig);
  const runtime = observedRuntime(result);
  const state = runtime.profession.core;
  const skill = runtime.helpers.skillsById.get(ID.DUAL_ORBITS_FIRE_AND_AIR);
  const verdict = () => native.availability(runtime.mechanics.queries, skill);
  state.hammerOrbLastCastAt = runtime.time;
  state.hammerOrbs.Fire = runtime.time + 5;
  const locked = verdict();
  assert.equal(locked.code, 'elementalist.hammer-orb-lockout');
  assert.ok(locked.retryAt > runtime.time);
  state.hammerOrbLastCastAt = -Infinity;
  assert.equal(verdict().code, 'elementalist.hammer-orb-active');
  assert.equal(verdict().retryAt, null);
  state.hammerOrbs.Fire = null;
  assert.equal(verdict().code, 'elementalist.weaver-attunement');
});

// Copied attribution does not make a proc or preview packet part of an orb's cancellation lifetime.
test('orb ownership leaves copied attribution and missing activations unowned', () => {
  const context = createEffectOwnershipContext(elementalistCatalog);
  const hook = elementalistHammerOrbLifecycle.effectOwner;
  for (const type of ['damage', 'condition']) {
    for (const id of [ID.FLAME_WHEEL, ID.DUAL_ORBITS_FIRE_AND_AIR]) {
      assert.deepEqual(hook(context, { type, sourceId: id, activationId: 'orb' }), { id: 'orb', generation: 0 });
      for (const activationId of [undefined, null, ''])
        assert.equal(hook(context, { type, sourceId: id, skillId: id, activationId }), undefined);
      assert.equal(
        hook(context, {
          type,
          sourceId: id,
          skillId: id,
          activationId: 'orb',
          actorType: 'effect'
        }),
        undefined
      );
      assert.equal(
        hook(context, { type, sourceId: id, skillId: id, activationId: 'orb', procType: 'fixture' }),
        undefined
      );
      assert.equal(hook(context, { type, sourceId: 'combo', skillId: id, activationId: 'orb' }), undefined);
    }
  }
});

// Ownership follows the selected declaration, including removing it in a patched catalog.
test('only declared orb creators own contacts in each selected catalog', () => {
  const hook = elementalistHammerOrbLifecycle.effectOwner;
  const event = { type: 'damage', sourceId: ID.DUAL_ORBITS_FIRE_AND_AIR, activationId: 'orb' };
  const removed = withSkill(elementalistCatalog, ID.DUAL_ORBITS_FIRE_AND_AIR, { sideEffects: [] });
  assert.equal(hook(createEffectOwnershipContext(removed), event), undefined);
  assert.deepEqual(hook(createEffectOwnershipContext(elementalistCatalog), event), { id: 'orb', generation: 0 });
  const unrelated = withSkill(elementalistCatalog, ID.TWIN_STRIKE, { weapon: 'Hammer' });
  assert.equal(hook(createEffectOwnershipContext(unrelated), { ...event, sourceId: ID.TWIN_STRIKE }), undefined);
});

// A source-only packet must share the creator's owner so Finale can retire it before impact.
test('Finale cancels source-only orb damage and conditions', () => {
  const options = {
    timeline: [
      {
        at: 0.1,
        run(runtime) {
          for (const type of ['damage', 'condition'])
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type,
                source: 'fixture',
                sourceId: ID.FLAME_WHEEL,
                at: 2,
                activationId: runtime.profession.core.hammerOrbActivationIds.Fire,
                actorType: 'player',
                coefficient: 1,
                weaponStrength: 1000,
                skillWeapon: 'Hammer',
                condition: 'Burning',
                stacks: 1,
                duration: 1,
                metadata: { sourceOnlyOrbFixture: true }
              }
            });
        }
      }
    ]
  };
  const first = { type: 'cast', skillId: ID.FLAME_WHEEL };
  const baseline = runElementalist([first, { type: 'wait', durationMs: 4000 }], config, options);
  const consumed = runElementalist(
    [
      first,
      { type: 'wait', durationMs: 500 },
      { type: 'cast', skillId: ID.GRAND_FINALE },
      { type: 'wait', durationMs: 4000 }
    ],
    config,
    options
  );
  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(consumed.warnings, []);
  for (const type of ['damage', 'condition']) {
    const delivered = (result) =>
      result.events.some((event) => event.type === type && event.metadata?.sourceOnlyOrbFixture);
    assert.equal(delivered(baseline), true);
    assert.equal(delivered(consumed), false);
  }
});

// Malformed dual metadata cannot allocate arbitrary state keys through the creation handler.
test('invalid orb metadata rejects creation without corrupting element slots', () => {
  for (const attunement of [undefined, 'Fire+Fire', 'Fire+Void']) {
    const result = runElementalist([], config, {
      catalog: (catalog) => withSkill(catalog, ID.DUAL_ORBITS_FIRE_AND_AIR, { attunement }),
      initialize(runtime) {
        assert.throws(
          () => commitHammerOrbFixture(runtime, ID.DUAL_ORBITS_FIRE_AND_AIR, 'invalid'),
          /Invalid hammer orb/
        );
        assert.deepEqual(runtime.profession.core.hammerOrbs, { Fire: null, Water: null, Air: null, Earth: null });
      }
    });
    assert.deepEqual(result.warnings, []);
  }
});

// A shorter authored lifetime retires both the orb and pending contacts, even before their first impact.
test('orb expiry cancels pending damage and conditions', () => {
  const rotation = [
    { type: 'cast', skillId: ID.FLAME_WHEEL },
    { type: 'wait', durationMs: 3000 }
  ];
  const baseline = runElementalist(rotation, config);
  const expired = runElementalist(rotation, config, {
    catalog: (catalog) => applySkillPatch(catalog, { skills: { [ID.FLAME_WHEEL]: { fields: { orbDuration: 0.5 } } } })
  });
  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(expired.warnings, []);
  for (const type of ['damage', 'condition']) {
    const contacts = (result) =>
      result.events.filter((event) => event.type === type && event.sourceId === ID.FLAME_WHEEL);
    assert.ok(contacts(baseline).length > 0);
    assert.deepEqual(contacts(expired), []);
  }

  assert.equal(observedRuntime(expired).profession.core.hammerOrbActivationIds.Fire, null);
});

// Declared preparation owns the snapshot regardless of whether the Finale identity is numeric or custom.
for (const id of [String(ID.GRAND_FINALE), 'fixture.finale']) {
  test(`Finale declarations capture the accepted orbs for ${id}`, () => {
    const options = {
      catalog: (catalog) => {
        const skills = catalog.skills.map((skill) => (skill.id === ID.GRAND_FINALE ? { ...skill, id } : skill));
        return { ...catalog, skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
      }
    };
    const denied = runElementalist([{ type: 'cast', skillId: id }], config, options);
    assert.equal(denied.warnings.length, 1);
    assert.match(denied.warnings[0].message ?? denied.warnings[0], /active orb/);
    assert.equal(
      denied.events.some((event) => event.type === 'action' && event.skillId === id),
      false
    );
    const result = runElementalist(
      [
        { type: 'cast', skillId: ID.FLAME_WHEEL },
        { type: 'cast', skillId: id },
        { type: 'wait', durationMs: 2000 }
      ],
      config,
      options
    );
    assert.deepEqual(result.warnings, []);
    assert.ok(result.events.some((event) => event.type === 'damage' && event.skillId === id && event.name === 'Fire'));
    assert.equal(observedRuntime(result).profession.core.hammerOrbs.Fire, null);
  });
}

// A new accepted orb has its own buff application; a second Finale cannot extend the previous Finale's residual buff.
test('successive Finales extend only their own orb buff applications', () => {
  const rotation = [
    { type: 'cast', skillId: ID.FLAME_WHEEL },
    { type: 'cast', skillId: ID.GRAND_FINALE },
    { type: 'cooldown-reset' },
    { type: 'cast', skillId: ID.FLAME_WHEEL },
    { type: 'cast', skillId: ID.WATER_ATTUNEMENT },
    { type: 'cast', skillId: ID.ICY_COIL },
    { type: 'cast', skillId: ID.GRAND_FINALE },
    { type: 'wait', durationMs: 2000 }
  ];
  const baseline = runElementalist(rotation, config);
  assert.deepEqual(baseline.warnings, []);
  const first = baseline.steps.find((step) => step.skillId === ID.GRAND_FINALE);
  const last = baseline.steps.findLast((step) => step.skillId === ID.GRAND_FINALE);
  let observed = false;
  const result = runElementalist(rotation, config, {
    probes: [
      [
        canonicalTime(first.end / 1000 + 1.001),
        (runtime) => {
          observed = true;
          const active = runtime.buffs
            .get('hammer fire orb')
            .filter((buff) => buff.at <= runtime.time && buff.expiresAt > runtime.time);
          assert.equal(active.length, 1);
        }
      ]
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.ok(observed);
  const runtime = observedRuntime(result);
  const buffs = runtime.buffs.get('hammer fire orb');
  assert.equal(buffs[0].expiresAt, canonicalTime(first.end / 1000 + 1));
  assert.ok(buffs.every((buff) => buff.expiresAt <= canonicalTime(last.end / 1000 + 1)));
  assert.deepEqual(runtime.profession.core.hammerOrbs, { Fire: null, Water: null, Air: null, Earth: null });
});

// A refresh at another orb's exact expiry must leave that expired state and buff retired.
test('orb creation excludes an element at its exact expiry', () => {
  const rotation = [
    { type: 'cast', skillId: ID.FLAME_WHEEL },
    { type: 'cast', skillId: ID.WATER_ATTUNEMENT },
    { type: 'cast', skillId: ID.ICY_COIL }
  ];
  const baseline = runElementalist(rotation, config);
  assert.deepEqual(baseline.warnings, []);
  const opening = baseline.steps.find((step) => step.skillId === ID.FLAME_WHEEL);
  const coil = baseline.steps.find((step) => step.skillId === ID.ICY_COIL);
  const result = runElementalist(rotation, config, {
    catalog: (catalog) =>
      applySkillPatch(catalog, {
        skills: { [ID.FLAME_WHEEL]: { fields: { orbDuration: (coil.end - opening.end) / 1000 } } }
      })
  });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.equal(runtime.profession.core.hammerOrbs.Fire, null);
  assert.ok(runtime.profession.core.hammerOrbs.Water > coil.end / 1000);
  assert.ok(runtime.buffs.get('hammer fire orb').every((buff) => buff.expiresAt === canonicalTime(coil.end / 1000)));
});

// Finale may consume a live primary orb while a secondary orb expires at that same cast-start boundary.
test('Finale excludes an orb expiring exactly at cast start', () => {
  const rotation = [
    { type: 'cast', skillId: ID.DUAL_ORBITS_FIRE_AND_WATER },
    { type: 'wait', durationMs: 100 },
    { type: 'cast', skillId: ID.GRAND_FINALE },
    { type: 'wait', durationMs: 2000 }
  ];
  const weaver = { ...config, specialization: 'Weaver', secondaryAttunement: 'Water' };
  const baseline = runElementalist(rotation, weaver);
  const start = baseline.steps.find((step) => step.skillId === ID.GRAND_FINALE).start / 1000;
  // Expire Water before the cast-start snapshot while retaining the shared activation's live Fire orb.
  const result = runElementalist(rotation, weaver, {
    timeline: [
      {
        at: start,
        priority: -100,
        run(runtime) {
          runtime.profession.core.hammerOrbs.Water = start;
          runtime.mechanics.combat.reviseBuffExpiry(
            'hammer water orb',
            () => true,
            () => start
          );
        }
      }
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'damage' && event.skillId === ID.GRAND_FINALE)
      .map((event) => event.name),
    ['Fire']
  );
  assert.ok(
    observedRuntime(result)
      .buffs.get('hammer water orb')
      .every((buff) => buff.expiresAt === start)
  );
});

// Selected declarations determine modifier facts even when an ID is reused or a dual skill uses a hammer.
test('orb tooltip facts follow selected creation declarations', () => {
  const context = elementalistAppAdapter.profession.resolvePatch().balanceContext;
  for (const id of [ID.FLAME_WHEEL, ID.DUAL_ORBITS_FIRE_AND_AIR]) {
    const skill = elementalistCatalog.skillsById.get(id);
    const facts = (value) => elementalistCoreTooltips.skillFacts(context, value);
    assert.ok(facts(skill).some((fact) => fact.name === 'Strike damage while Fire orb is active'));
    assert.equal(
      facts({ ...skill, sideEffects: [] }).some((fact) => fact.name.includes('orb')),
      false
    );
    assert.equal(
      facts({ ...skill, attunement: 'Fire+Void' }).some((fact) => fact.name.includes('orb')),
      false
    );
  }
});
