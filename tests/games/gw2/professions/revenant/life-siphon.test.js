// Exercise life-siphon composition through the profession's resolver hook, including live state and catalog patches.
import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { createTestLiveEffects } from '#tests/helpers/live-effects.js';

function fixture(overrides = {}, stacks = [], balanceProfiles = {}) {
  const config = { specialization: 'Renegade', selectedTraitIds: [], boons: {}, ...overrides };
  const native = revenantProfession.runtimeFor(config);
  const context = {
    config,
    traits: new Set(config.selectedTraitIds),
    helpers: applyBalanceProfilePatch(native.catalog, { balanceProfiles }),
    profession: native.createState(config),
    time: 1,
    liveEffects: createTestLiveEffects()
  };

  if (config.specialization === 'Renegade') context.profession.specialization.state.kallasFervor = stacks;

  return {
    context,
    resolve: (fields = {}) => native.reactions['damage.resolving'](context, { at: context.time, ...fields })
  };
}

const fiveStacks = () => Array.from({ length: 5 }, () => ({ at: 0, expiresAt: 2 }));
const siphon = { damageKind: 'life-steal', flatStrikeBase: 100 };

test('life siphon combines Core and Fervor additively while preserving the incoming multiplier', () => {
  for (const [core, fervor, expected] of [
    [false, false, 1],
    [true, false, 1.1],
    [false, true, 1.15],
    [true, true, 1.25]
  ]) {
    const { resolve } = fixture(
      {
        selectedTraitIds: [TRAIT.LASTING_LEGACY, ...(core ? [TRAIT.FEROCIOUS_AGGRESSION] : [])],
        boons: { fury: true }
      },
      fervor ? fiveStacks() : []
    );
    for (const incoming of [undefined, 0, 2]) {
      assert.equal(
        resolve({ ...siphon, flatStrikeMultiplier: incoming }).flatStrikeMultiplier,
        (incoming ?? 1) * expected
      );
    }
  }
});

test('Core and other elites receive Invocation without requiring Renegade state or profiles', () => {
  for (const specialization of ['Core', 'Herald', 'Vindicator', 'Conduit']) {
    const { resolve } = fixture({
      specialization,
      selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION],
      boons: { fury: true }
    });
    assert.equal(resolve(siphon).flatStrikeMultiplier, 1.1, specialization);
  }
});

test('life-siphon eligibility follows packet identity rather than names or actors', () => {
  const { resolve } = fixture(
    { selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION, TRAIT.LASTING_LEGACY], boons: { fury: true } },
    fiveStacks()
  );

  for (const fields of [
    { coefficient: 1, name: 'Life Siphon' },
    { flatDamage: 100, name: 'Life Siphon' },
    { damageKind: 'life-steal', coefficient: 1 },
    { damageKind: 'life-steal', flatDamage: NaN, flatStrikeBase: Infinity }
  ]) {
    assert.equal(resolve({ flatStrikeMultiplier: 2, ...fields }), undefined);
  }

  for (const field of ['flatDamage', 'flatStrikeBase', 'flatStrikePowerCoeff']) {
    for (const actorType of ['player', 'effect']) {
      assert.equal(
        resolve({ damageKind: 'life-steal', [field]: 0, name: 'Unrelated label', actorType }).flatStrikeMultiplier,
        1.25
      );
    }
  }
});

test('expired Fury and Fervor leave only the remaining live contribution', () => {
  const { context, resolve } = fixture(
    { selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION, TRAIT.LASTING_LEGACY] },
    fiveStacks()
  );
  context.liveEffects = createTestLiveEffects([
    ['fury', [{ at: 0, expiresAt: 1, stacks: 1, resolvedAudience: { includesSelf: true } }]]
  ]);
  for (const [time, expected] of [
    [0.5, 1.25],
    [1, 1.15],
    [2, 1]
  ]) {
    context.time = time;
    assert.equal(resolve(siphon).flatStrikeMultiplier, expected);
  }
});

test('life siphon reads the selected patched Fervor cap and rate', () => {
  const balanceProfiles = {
    [TRAIT.AMBUSH_COMMANDER]: { fields: { maximumStacks: 3, lifeSiphonDamagePerStack: 0.04 } },
    [TRAIT.LASTING_LEGACY]: { fields: { maximumStacks: 2, lifeSiphonDamagePerStack: 0.07 } },
    [TRAIT.FEROCIOUS_AGGRESSION]: { fields: { damageIncrease: 0.3 } }
  };
  for (const [traits, expected] of [
    [[TRAIT.AMBUSH_COMMANDER], 1.42],
    [[TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY], 1.44]
  ]) {
    const { resolve } = fixture(
      { selectedTraitIds: [...traits, TRAIT.FEROCIOUS_AGGRESSION], boons: { fury: true } },
      fiveStacks(),
      balanceProfiles
    );
    assert.ok(Math.abs(resolve(siphon).flatStrikeMultiplier - expected) < 1e-12);
  }
});
