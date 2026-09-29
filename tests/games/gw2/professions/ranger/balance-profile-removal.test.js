import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createProcRegistry } from '#gw2/platform/combat/procs.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { triggerPoisonousStrikes } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/ranger/core/profiles.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { applyRangerWeaponSwapTraits } from '#gw2/professions/ranger/core/traits/behavior.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerCatalog, rangerProfession } from '#gw2/professions/ranger/profession.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as SOULBEAST } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const patched = (balanceProfiles) => applyBalanceProfilePatch(rangerCatalog, { balanceProfiles });

// Only the state-selected packet can claim the shared deadline; its removed sibling cannot substitute for it.
test('Untamed control declarations gate cooldowns on the selected surviving effect', () => {
  for (const unleashed of [true, false]) {
    for (const [trait, profile, type, selected, sibling] of [
      [
        TRAIT.DEBILITATING_BLOWS,
        TRAIT.DEBILITATING_BLOWS,
        'condition',
        unleashed ? 'Poisoned' : 'Slow',
        unleashed ? 'Slow' : 'Poisoned'
      ],
      [
        TRAIT.ENHANCING_IMPACT,
        TRAIT.ENHANCING_IMPACT,
        'boon',
        unleashed ? 'quickness' : 'stability',
        unleashed ? 'stability' : 'quickness'
      ]
    ]) {
      for (const removed of [selected, sibling]) {
        const result = runRanger(
          [wait(1500)],
          { specialization: 'Untamed', selectedTraitIds: [trait] },
          {
            extend: () => ({ catalog: patched({ [profile]: remove(type, removed) }) }),
            initialize(runtime) {
              runtime.profession.specialization.state.rangerUnleashed = unleashed;
              runtime.emit({
                type: 'control',
                at: 1,
                source: 'fixture',
                sourceId: 'control',
                actorType: 'player',
                skillName: 'Test',
                controlKind: 'daze',
                duration: 1
              });
            }
          }
        );
        const rewards = result.events.filter((event) => event.sourceId === trait);
        assert.deepEqual(
          rewards.map((event) => event.condition ?? event.kind),
          removed === selected ? [] : [selected]
        );
        assert.equal(observedRuntime(result).procs.deadline(profile) > 1, removed !== selected);
        assert.deepEqual(result.warnings, []);
      }
    }
  }
});

// Small patched rotations exercise removal through the real scheduler and resolver.
function run(balanceProfiles, specialization, rotation, config = {}) {
  const profession = withPatchPreview(rangerProfession, {
    id: 'ranger-removal',
    label: 'Ranger removal',
    professions: { ranger: { balanceProfiles } }
  });
  const result = createObservedProfessionSimulator(profession, {
    initialAstralForce: 100,
    selectedPet: 'Jacaranda',
    selectedPet2: 'Carrion Devourer',
    stats: { power: 2000, precision: 1500, ferocity: 0, conditionDamage: 1000 },
    target: { armor: 2597, health: 1_000_000 }
  })(specialization, rotation, { patchId: 'ranger-removal', ...config });
  assert.deepEqual(result.warnings, []);
  return result;
}

// Resolver contexts expose the owned state that a removed packet must leave untouched.
function resolverContext(balanceProfiles, selectedTraitIds, specialization) {
  const config = { specialization: specialization?.kind ?? 'Core', selectedTraitIds };
  const queued = [];
  const context = {
    procs: createProcRegistry(() => context),
    config,
    catalog: patched(balanceProfiles),
    boons: new Map(),
    // Neutral stats keep derived boon durations at their authored values.
    query: { statsAt: () => ({}) },
    queued,
    queue: { enqueue: (event) => queued.push(event) },
    profession: { core: createRangerCoreState(config), ...(specialization ? { specialization } : {}) }
  };
  return context;
}

test('removing one Eclipse pulse packet never rebinds another Celestial Avatar skill', () => {
  const eclipse = (result) =>
    result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.ECLIPSE);
  const result = run(
    { [TRAIT.ECLIPSE]: remove('condition', 'Natural Convergence final pulse') },
    'Druid',
    ['Celestial Avatar', 'Natural Convergence', 'Lunar Impact'],
    { selectedTraitIds: [TRAIT.ECLIPSE] }
  );
  const burning = eclipse(result).filter((event) => event.condition === 'Burning');
  // Only the ordinary single-stack pulses remain; the final three-stack pulse is not substituted.
  assert.ok(burning.length > 0);
  assert.ok(burning.every((event) => event.stacks === 1));
  assert.ok(eclipse(result).some((event) => event.condition === 'Immobilized'));
});

test('removed One Wolf Pack echo emits no strike while the stance still applies', () => {
  const result = run({ [SOULBEAST.oneWolfPack]: remove('strike', 'Strike') }, 'Soulbeast', [
    ID.ONE_WOLF_PACK,
    ID.DRAKES_SWIPE,
    wait(1000)
  ]);
  assert.ok(result.events.some((event) => event.kind === 'one-wolf-pack'));
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === ID.ONE_WOLF_PACK_STRIKE),
    false
  );
});

test('removed Quick Draw quickness keeps the trait-owned recharge window and cooldown', () => {
  const config = { selectedTraitIds: [TRAIT.QUICK_DRAW] };
  const events = [];
  const context = {
    procs: createProcRegistry(() => context),
    config,
    catalog: patched({ [TRAIT.QUICK_DRAW]: remove('boon', 'quickness') }),
    combatStartTime: 0,
    effectiveEnd: 1,
    state: { time: 1, profession: { core: createRangerCoreState(config) } },
    emit: (event) => events.push(event)
  };
  applyRangerWeaponSwapTraits(context, rangerCatalog.skillsById.get(SHARED_SKILL_IDS.SWAP_WEAPONS), 1);
  const core = context.state.profession.core;
  assert.equal(core.quickDrawUntil, 6);
  assert.equal(context.procs.deadline('ranger.core.quickDraw'), 10);
  assert.deepEqual(events, []);
});

test('removed Poisonous Strikes poison leaves its charges unspent', () => {
  const context = resolverContext({ [CORE.poisonousStrikes]: remove('condition', 'Poisoned') }, []);
  context.profession.core.poisonousStrikes = grantCharges(2, 10);
  triggerPoisonousStrikes(context, { type: 'damage', at: 1, source: 'ranger-pet', coefficient: 1 });
  assert.equal(context.profession.core.poisonousStrikes.charges, 2);
  assert.deepEqual(context.queued, []);
});

test('Bestial Rage keeps its sibling boon and cooldown, and releases the cooldown when both are removed', () => {
  for (const both of [false, true]) {
    const result = runRanger(
      [wait(1500)],
      { specialization: 'Soulbeast', selectedTraitIds: [TRAIT.BESTIAL_RAGE] },
      {
        extend: () => ({
          catalog: patched({
            [TRAIT.BESTIAL_RAGE]: {
              removeEffects: [{ type: 'boon', name: 'might' }, ...(both ? [{ type: 'boon', name: 'fury' }] : [])]
            }
          })
        }),
        initialize(runtime) {
          runtime.emit({
            type: 'control',
            at: 1,
            source: 'fixture',
            sourceId: 'control',
            actorType: 'player',
            skillName: 'Test',
            controlKind: 'daze',
            duration: 1
          });
        }
      }
    );
    assert.deepEqual(
      result.events.filter((event) => event.sourceId === TRAIT.BESTIAL_RAGE).map((event) => event.kind),
      both ? [] : ['fury']
    );
    assert.equal(observedRuntime(result).procs.deadline(TRAIT.BESTIAL_RAGE), both ? 0 : 1.25);
    assert.deepEqual(result.warnings, []);
  }
});

test('a missing required Ranger scalar fails instead of using a local default', () => {
  const profile = { ...rangerCatalog.balanceProfilesById.get(TRAIT.QUICK_DRAW) };
  delete profile.durationMultiplier;
  const config = { selectedTraitIds: [TRAIT.QUICK_DRAW] };
  const context = {
    procs: createProcRegistry(() => context),
    config,
    catalog: { balanceProfilesById: new Map([[TRAIT.QUICK_DRAW, profile]]) },
    combatStartTime: 0,
    effectiveEnd: 1,
    state: { time: 1, profession: { core: createRangerCoreState(config) } },
    emit() {}
  };
  assert.throws(
    () => applyRangerWeaponSwapTraits(context, rangerCatalog.skillsById.get(SHARED_SKILL_IDS.SWAP_WEAPONS), 1),
    /Invalid balance data: .*field=durationMultiplier/
  );
});

test("removed Stalker's Strike impaired Poison keeps the skill's own Poison and the doubled strike", () => {
  const impaired = { defiant: false, conditions: { Cripple: true } };
  const config = { target: impaired, primaryWeapon: 'Axe', secondaryWeapon: 'Dagger', selectedTraitIds: [] };
  const poisonStacks = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === ID.STALKERS_STRIKE)
      .reduce((total, event) => total + event.stacks, 0);
  const strike = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.STALKERS_STRIKE).damage;
  const baseline = run({}, 'Core', ["Stalker's Strike"], config);
  const removed = run(
    { [CORE.stalkersStrikeImpaired]: remove('condition', 'Poisoned') },
    'Core',
    ["Stalker's Strike"],
    config
  );
  assert.equal(poisonStacks(baseline), 5);
  assert.equal(poisonStacks(removed), 3);
  assert.equal(strike(removed), strike(baseline));
});

// Autonomous recharge reads Pack Alpha normally and the separately authored quickness variant when active.
test('pet recharge consumes patched Pack Alpha and Crippling Anguish values', () => {
  for (const quickness of [false, true]) {
    const result = runRanger(
      [{ type: 'combat-start' }, wait(6000)],
      {
        selectedPet: 'Fanged Iboga',
        selectedTraitIds: [TRAIT.PACK_ALPHA]
      },
      {
        extend: () => ({
          catalog: patched({
            [TRAIT.PACK_ALPHA]: { fields: { rechargeMultiplier: 0.5 } },
            [CORE.cripplingAnguishQuickness]: { fields: { cooldown: 7 } }
          })
        }),
        initialize(runtime) {
          if (quickness)
            runtime.emit({
              type: 'buff',
              kind: 'quickness',
              at: 0,
              duration: 10,
              stacks: 1,
              source: 'fixture',
              sourceId: 'fixture',
              actorType: 'player',
              audience: { recipients: 'summons' }
            });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const cast = result.events.find((event) => event.type === 'action' && event.skillId === ID.CRIPPLING_ANGUISH_PET);
    assert.ok(cast);
    const deadline = observedRuntime(result).profession.core.petAutoCooldowns[String(ID.CRIPPLING_ANGUISH_PET)];
    assert.ok(Math.abs(deadline - cast.at - (quickness ? 7 : 10)) < 1e-9);
  }
});
