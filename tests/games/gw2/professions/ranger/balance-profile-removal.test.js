import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createLiveProfessionSimulator } from '#tests/helpers/live-runtime.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { rangerCatalog, rangerProfession } from '#gw2/professions/ranger/profession.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/ranger/core/profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as DRUID } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as SOULBEAST } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { applyRangerWeaponSwapTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { triggerPoisonousStrikes } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { createSoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { reactToSoulbeastControl } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const patched = (balanceProfiles) => applyBalanceProfilePatch(rangerCatalog, { balanceProfiles });

// Small patched rotations exercise removal through the real scheduler and resolver.
function run(balanceProfiles, specialization, rotation, config = {}) {
  const profession = withPatchPreview(rangerProfession, {
    id: 'ranger-removal',
    label: 'Ranger removal',
    professions: { ranger: { balanceProfiles } }
  });
  const result = createLiveProfessionSimulator(profession, {
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
  return {
    config,
    catalog: patched(balanceProfiles),
    boons: new Map(),
    // Neutral stats keep derived boon durations at their authored values.
    query: { statsAt: () => ({}) },
    queued,
    queue: { enqueue: (event) => queued.push(event) },
    profession: { core: createRangerCoreState(config), ...(specialization ? { specialization } : {}) }
  };
}

test('removing one Eclipse pulse packet never rebinds another Celestial Avatar skill', () => {
  const eclipse = (result) =>
    result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.ECLIPSE);
  const result = run(
    { [DRUID.eclipse]: remove('condition', 'Natural Convergence final pulse') },
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
    config,
    catalog: patched({ [CORE.quickDraw]: remove('boon', 'quickness') }),
    combatStartTime: 0,
    effectiveEnd: 1,
    state: { time: 1, profession: { core: createRangerCoreState(config) } },
    emit: (event) => events.push(event)
  };
  applyRangerWeaponSwapTraits(context, rangerCatalog.skillsById.get(ID.SWAP_WEAPONS), 1);
  const core = context.state.profession.core;
  assert.equal(core.quickDrawUntil, 6);
  assert.equal(core.quickDrawReadyAt, 10);
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
  const soulbeast = () => ({ kind: 'Soulbeast', state: createSoulbeastState() });
  const control = { type: 'control', at: 1, actorType: 'player', skillName: 'Test' };
  const partial = resolverContext(
    { [SOULBEAST.bestialRage]: remove('boon', 'might') },
    [TRAIT.BESTIAL_RAGE],
    soulbeast()
  );
  reactToSoulbeastControl(partial, control);
  assert.deepEqual(
    partial.queued.map((event) => event.kind),
    ['fury']
  );
  assert.equal(partial.profession.specialization.state.bestialRageReadyAt, 1.25);

  const empty = resolverContext(
    {
      [SOULBEAST.bestialRage]: {
        removeEffects: [
          { type: 'boon', name: 'might' },
          { type: 'boon', name: 'fury' }
        ]
      }
    },
    [TRAIT.BESTIAL_RAGE],
    soulbeast()
  );
  reactToSoulbeastControl(empty, control);
  assert.deepEqual(empty.queued, []);
  assert.equal(empty.profession.specialization.state.bestialRageReadyAt, 0);
});

test('a missing required Ranger scalar fails instead of using a local default', () => {
  const profile = { ...rangerCatalog.balanceProfilesById.get(CORE.quickDraw) };
  delete profile.durationMultiplier;
  const config = { selectedTraitIds: [TRAIT.QUICK_DRAW] };
  const context = {
    config,
    catalog: { balanceProfilesById: new Map([[CORE.quickDraw, profile]]) },
    combatStartTime: 0,
    effectiveEnd: 1,
    state: { time: 1, profession: { core: createRangerCoreState(config) } },
    emit() {}
  };
  assert.throws(
    () => applyRangerWeaponSwapTraits(context, rangerCatalog.skillsById.get(ID.SWAP_WEAPONS), 1),
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
