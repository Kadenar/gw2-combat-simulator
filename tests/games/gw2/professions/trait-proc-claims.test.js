import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { ENGINEER_TRAIT_IDS as E, ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { GUARDIAN_TRAIT_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import { shortFuse } from '#gw2/professions/engineer/core/traits/explosives/index.js';
import { applyAimAssistedRocket } from '#gw2/professions/engineer/core/traits/explosives/explosions.js';
import { hematicFocus } from '#gw2/professions/engineer/core/traits/firearms/index.js';
import { reactToAppliedForceBuff } from '#gw2/professions/engineer/specializations/scrapper/traits/behavior.js';
import { reactToMechArmDamage } from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import { reactToFirebrandBuff } from '#gw2/professions/guardian/specializations/firebrand/traits/behavior.js';
import { liberatorsVow } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { skillEffectKey } from '#gw2/platform/effects/validation.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

const hit = (runtime, extra = {}) => ({
  type: 'damage',
  actorType: 'player',
  at: runtime.time,
  coefficient: 1,
  skillName: 'Fixture hit',
  ...extra
});
const mechHit = (runtime) => hit(runtime, { actorType: 'summon', metadata: { engineerMech: true } });

// Real trait handlers share cooldown admission while retaining their own removed-effect consumption rules.
const cases = [
  {
    trait: E.SHORT_FUSE,
    key: 'shortFuse',
    consumesRemoved: true,
    invoke: (r) => shortFuse.hooks.reactions['damage.resolved'](r, hit(r, { explosion: true }))
  },
  {
    trait: E.AIM_ASSISTED_ROCKET,
    key: 'aimAssistedRocket',
    consumesRemoved: true,
    invoke: (r) => applyAimAssistedRocket(r, hit(r, { projectile: true }))
  },
  {
    trait: E.HEMATIC_FOCUS,
    key: 'hematicFocus',
    invoke: (r) =>
      hematicFocus.hooks.reactions['condition.applied'](r, hit(r, { type: 'condition', condition: 'Bleeding' }))
  },
  {
    trait: E.APPLIED_FORCE,
    key: 'appliedForce',
    specialization: 'Scrapper',
    consumesRemoved: true,
    invoke: (r) => reactToAppliedForceBuff(r, hit(r, { type: 'buff', kind: 'might' }))
  },
  {
    trait: E.MECH_ARMS_SINGLE_EDGE_CUTTERS,
    key: 'singleEdgeCutters',
    specialization: 'Mechanist',
    invoke: (r) => reactToMechArmDamage(r, mechHit(r))
  },
  {
    trait: E.MECH_ARMS_HIGH_IMPACT_DRIVERS,
    key: 'highImpactDrivers',
    specialization: 'Mechanist',
    invoke: (r) => reactToMechArmDamage(r, mechHit(r))
  },
  {
    family: guardianProfession,
    trait: G.STALWART_SPEED,
    key: 'guardian.firebrand.stalwartSpeed',
    specialization: 'Firebrand',
    invoke: (r) =>
      reactToFirebrandBuff(
        r,
        hit(r, { type: 'buff', kind: 'aegis', resolvedAudience: { includesSelf: false, alliedPlayerCount: 2 } })
      )
  },
  {
    family: guardianProfession,
    trait: G.LIBERATORS_VOW,
    key: 'guardian.firebrand.liberatorsVow',
    specialization: 'Firebrand',
    invoke: (r) =>
      liberatorsVow.hooks.onCastCommit(r, { id: 'heal', skill: { id: 'heal', name: 'Fixture heal', type: 'Heal' } })
  }
];

function fixture({ family = engineerProfession, trait, key, specialization = 'Core' }, removed = false) {
  const config = { specialization, selectedTraitIds: [trait], boons: { might: 25 }, allies: { count: 2 } };
  const native = family.runtimeFor(config);
  const profile = native.catalog.balanceProfilesById.get(trait);
  let catalog = withProfile(native.catalog, trait, {
    internalCooldown: 2,
    ...(removed
      ? { effects: [], removedEffectKeys: profile.effects.map((effect) => skillEffectKey(effect.type, effect.name)) }
      : {})
  });
  // Rocket damage belongs to the produced skills; removing it still consumes the trait's interval and counter.
  if (removed && trait === E.AIM_ASSISTED_ROCKET) {
    for (const id of [ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL, ID.ORBITAL_COMMAND_STRIKE]) {
      catalog = withSkill(catalog, id, { effects: [] });
    }
  }

  const result = observeGw2Runtime({ profession: { ...native, catalog }, config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  // Guardian's initial Aegis may proc Stalwart Speed; isolate the opportunities exercised below.
  runtime.procs.reset(key);
  runtime.time = 1;
  return runtime;
}

for (const entry of cases) {
  test(`${entry.key} reserves its interval before delivery and keeps an exclusive boundary`, () => {
    const runtime = fixture(entry);
    let reentered = false;
    const capture = captureEffectEmissions({
      now: () => runtime.time,
      submit(event) {
        assert.equal(runtime.procs.deadline(entry.key), runtime.time + 2);
        // Derived effects may synchronously cause another opportunity; the first claim must already be visible.
        if (!reentered) {
          reentered = true;
          entry.invoke(runtime);
        }

        return event;
      }
    });
    runtime.effects = capture.effects;
    runtime.traits.delete(entry.trait);
    entry.invoke(runtime);
    assert.equal(runtime.procs.deadline(entry.key), 0);
    assert.equal(capture.events.length, 0);
    runtime.traits.add(entry.trait);
    entry.invoke(runtime);
    assert.equal(runtime.procs.deadline(entry.key), 3);
    assert.ok(capture.events.length > 0);
    const count = capture.events.length;
    for (const at of [1, 2.999999, 3]) {
      runtime.time = at;
      entry.invoke(runtime);
      assert.equal(runtime.procs.deadline(entry.key), 3);
      assert.equal(capture.events.length, count);
    }

    runtime.time = 3.000001;
    entry.invoke(runtime);
    assert.equal(runtime.procs.deadline(entry.key), 5.000001);
    assert.ok(capture.events.length > count);
    assert.deepEqual(Object.keys(runtime.procs.snapshot()), [entry.key]);
  });

  test(`${entry.key} preserves cooldown eligibility when its effect is removed`, () => {
    const runtime = fixture(entry, true);
    const capture = captureEffectEmissions({ now: () => runtime.time });
    runtime.effects = capture.effects;
    entry.invoke(runtime);
    assert.equal(runtime.procs.deadline(entry.key), entry.consumesRemoved ? 3 : 0);
    assert.deepEqual(capture.events, []);
    assert.deepEqual(capture.announcements, []);
    if (entry.trait === E.AIM_ASSISTED_ROCKET) {
      assert.equal(runtime.profession.core.aimAssistedRocketCount, 1);
      entry.invoke(runtime);
      assert.equal(runtime.profession.core.aimAssistedRocketCount, 1);
    }
  });
}
