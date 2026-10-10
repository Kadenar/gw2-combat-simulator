import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { ENGINEER_TRAIT_IDS as E, ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { GUARDIAN_TRAIT_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import { aimAssistedRocket, shortFuse } from '#gw2/professions/engineer/core/traits/explosives/index.js';
import { hematicFocus } from '#gw2/professions/engineer/core/traits/firearms/index.js';
import { appliedForce } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';
import { mechStruck } from '#gw2/professions/engineer/core/mechanics/mech-strikes.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { firebrandBuffApplied } from '#gw2/professions/guardian/specializations/firebrand/mechanics/activations.js';
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
// A trait's compiled stage triggers, applied to an observed runtime's mechanic capabilities.
const stageTrigger = (trait, stage) => (runtime, event) =>
  compileProfessionRules({ traitTriggers: trait.triggers.map((rule) => ({ ...rule, trait: trait.id })) }).reactions[
    stage
  ](runtime.mechanics, event, {});
const mechStrike = (runtime) => runtime.fireTrigger(mechStruck, { cause: mechHit(runtime), details: {} });

// Real trait handlers share cooldown admission while retaining their own removed-effect consumption rules.
const cases = [
  {
    trait: E.SHORT_FUSE,
    key: 'shortFuse',
    consumesRemoved: true,
    invoke: (r) => stageTrigger(shortFuse, 'damage.resolved')(r, hit(r, { explosion: true }))
  },
  {
    trait: E.AIM_ASSISTED_ROCKET,
    key: String(E.AIM_ASSISTED_ROCKET),
    consumesRemoved: true,
    invoke: (r) => stageTrigger(aimAssistedRocket, 'damage.resolved')(r, hit(r, { projectile: true }))
  },
  {
    trait: E.HEMATIC_FOCUS,
    key: 'hematicFocus',
    invoke: (r) =>
      stageTrigger(hematicFocus, 'condition.applied')(r, hit(r, { type: 'condition', condition: 'Bleeding' }))
  },
  {
    trait: E.APPLIED_FORCE,
    key: 'appliedForce',
    specialization: 'Scrapper',
    consumesRemoved: true,
    invoke: (r) => stageTrigger(appliedForce, 'buff.applied')(r, hit(r, { type: 'buff', kind: 'might' }))
  },
  {
    trait: E.MECH_ARMS_SINGLE_EDGE_CUTTERS,
    key: 'singleEdgeCutters',
    specialization: 'Mechanist',
    invoke: mechStrike
  },
  {
    trait: E.MECH_ARMS_HIGH_IMPACT_DRIVERS,
    key: 'highImpactDrivers',
    specialization: 'Mechanist',
    invoke: mechStrike
  },
  {
    family: guardianProfession,
    trait: G.STALWART_SPEED,
    key: 'guardian.firebrand.stalwartSpeed',
    specialization: 'Firebrand',
    invoke: (r) =>
      r.fireTrigger(firebrandBuffApplied, {
        cause: hit(r, { type: 'buff', kind: 'aegis', resolvedAudience: { includesSelf: false, alliedPlayerCount: 2 } })
      })
  },
  {
    family: guardianProfession,
    trait: G.LIBERATORS_VOW,
    key: 'guardian.firebrand.liberatorsVow',
    specialization: 'Firebrand',
    invoke: (r) =>
      compileProfessionRules({
        traitTriggers: liberatorsVow.triggers.map((rule) => ({ ...rule, trait: liberatorsVow.id }))
      }).onCastCommit(r.mechanics, { id: 'heal', skill: { id: 'heal', name: 'Fixture heal', type: 'Heal' } })
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
