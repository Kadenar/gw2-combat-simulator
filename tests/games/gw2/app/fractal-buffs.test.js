import assert from 'node:assert/strict';
import test from 'node:test';

import { createIsolatedPreview } from '#gw2/app/build/isolated-preview.js';
import { loadOptimizerContext } from '#gw2/app/optimizer/gear/context.js';
import {
  createOptimizerBuildContext,
  DEFAULT_FRACTAL_BUFFS,
  fractalAttributes,
  optimizerBuildContextFactory,
  validateFractalBuffs
} from '#gw2/app/optimizer/gear/fractal-buffs.js';
import { createGroupedOptimizer } from '#gw2/app/optimizer/gear/search-space.js';
import {
  applyOptimizerCandidate,
  captureGearOptimizerRequest,
  createOptimizerEvaluator,
  optimizerEquipment,
  optimizerScore,
  verifyOptimizerScore
} from '#gw2/app/optimizer/gear/search.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';

const enabled = { ...DEFAULT_FRACTAL_BUFFS, enabled: true };
const warrior = await loadOptimizerContext('warrior');
const buildContext = (adapter, build, fractal) =>
  createOptimizerBuildContext(adapter, { build, patch: adapter.profession.resolvePatch({ id: 'current' }) }, fractal);

// Maximum mastery and five potion stacks are fixed; AR already includes title bonuses.
test('fractal potion conversions use total AR with full potions', () => {
  assert.deepEqual(fractalAttributes(undefined), {});
  assert.deepEqual(fractalAttributes(DEFAULT_FRACTAL_BUFFS), {});
  for (const agonyResistance of [0, 150, 200]) {
    const bonus = agonyResistance * 1.5;
    assert.deepEqual(fractalAttributes({ ...enabled, agonyResistance, augmentation: 'god' }), {
      Vitality: bonus,
      Toughness: bonus,
      Concentration: bonus
    });
  }
});

// Invalid search environments fail before workers start; obsolete settings are not accepted.
test('fractal optimizer input rejects malformed fields', () => {
  const build = warrior.profession.createBuildDefaults();
  const app = {
    contentId: 'warrior',
    adapter: warrior,
    build,
    buildRevision: 1,
    patch: warrior.profession.resolvePatch({ id: 'current' })
  };
  for (const invalid of [
    null,
    [],
    {},
    { ...enabled, enabled: 1 },
    { ...enabled, agonyResistance: NaN },
    { ...enabled, agonyResistance: -1 },
    { ...enabled, agonyResistance: 1.5 },
    { ...enabled, mastery: 'mistlock-singularities' },
    { ...enabled, offensiveStacks: 5 },
    { ...enabled, augmentation: 'unknown' },
    { ...enabled, extra: true }
  ]) {
    assert.throws(() => validateFractalBuffs(invalid), /Invalid fractal/);
    assert.throws(() => captureGearOptimizerRequest(app, { fractal: invalid }), /Invalid fractal/);
  }
});

for (const name of [
  'elementalist',
  'engineer',
  'guardian',
  'mesmer',
  'necromancer',
  'ranger',
  'revenant',
  'thief',
  'warrior'
]) {
  // Optimizer contexts and detached previews share bonuses while normal build contexts remain unaffected.
  test(`${name}: fractal attributes remain isolated from saved builds`, async () => {
    const adapter = await loadOptimizerContext(name);
    const original = adapter.profession.createBuildDefaults();
    const baseline = buildContext(adapter, original);
    // Round-trip the canonical build; optimizer-only potion settings must never be written into it.
    const saved = JSON.stringify(original);
    const loaded = adapter.profession.migrateBuild(JSON.parse(saved));
    assert.equal(loaded.assumptions.fractal, undefined);
    const context = buildContext(adapter, loaded, enabled);
    const config = context.simulationConfig();
    assert.equal(config.modifiers.playerStrike, 1.15);
    assert.equal(config.modifiers.playerCondition, 1.15);
    for (const set of [1, 2]) {
      const before = baseline.attributes(set).attributes;
      const after = context.attributes(set).attributes;
      for (const stat of ['Vitality', 'Toughness', 'Concentration']) {
        assert.equal(after[stat].final - before[stat].final, 225, stat);
        assert.equal(after[stat].fractalPotions, 225);
        assert.equal(
          config.attributeInputs.weaponSets[set - 1].conversionPool[stat],
          baseline.simulationConfig().attributeInputs.weaponSets[set - 1].conversionPool[stat]
        );
      }

      assert.equal(after['Boon Duration'].final - before['Boon Duration'].final, 15);
      assert.equal(after['Boon Duration'].fractalPotions, 15);
      const active = { ...config, startingWeaponSet: set };
      const query = createGw2CombatQuery({
        profession: adapter.profession.runtimeFor(active),
        config: active,
        skillOnCooldown: () => false
      });
      const live = query.statsAt(0);
      // Runtime-only profession state can differ from preview defaults; compare the isolated potion contribution.
      const unbuffed = { ...baseline.simulationConfig(), startingWeaponSet: set };
      const baseQuery = createGw2CombatQuery({
        profession: adapter.profession.runtimeFor(unbuffed),
        config: unbuffed,
        skillOnCooldown: () => false
      });
      const baseLive = baseQuery.statsAt(0);
      for (const stat of ['concentration', 'toughness', 'vitality']) assert.equal(live[stat] - baseLive[stat], 225);
    }

    const preview = createIsolatedPreview(
      {
        adapter: { ...adapter, createBuildContext: optimizerBuildContextFactory(adapter, enabled) },
        build: loaded,
        patch: adapter.profession.resolvePatch({ id: 'current' }),
        activeCatalog: adapter.profession.catalog
      },
      [],
      {},
      {},
      1
    );
    assert.equal(
      preview.preview.attributeData.attributes.Concentration.final,
      context.attributes(1).attributes.Concentration.final
    );
    const concentration = config.attributeInputs.weaponSets[0].commonTotals.concentration;
    config.attributeInputs.weaponSets[0].commonTotals.concentration = 999;
    assert.equal(context.simulationConfig().attributeInputs.weaponSets[0].commonTotals.concentration, concentration);
    assert.equal(enabled.agonyResistance, 150);
    assert.equal(JSON.stringify(original), saved);
    assert.equal(loaded.assumptions.fractal, undefined);
    assert.equal(buildContext(adapter, loaded).simulationConfig().fractal, undefined);
  });
}

// Both damage channels use multiplicative title/potion bonuses, with explicit actor exclusions before condition remapping.
test('fractal damage affects player strikes and conditions without affecting summons', () => {
  const build = warrior.profession.createBuildDefaults();
  const queryFor = (fractal) => {
    const current = buildContext(warrior, build, fractal).simulationConfig();
    return createGw2CombatQuery({
      profession: warrior.profession.runtimeFor(current),
      config: current,
      skillOnCooldown: () => false
    });
  };

  const baseline = queryFor(undefined);
  const player = { type: 'strike', actorType: ACTOR.PLAYER, skillId: 0 };
  for (const [augmentation, bonus] of [
    ['none', 0],
    ['savant', 0.01],
    ['prodigy', 0.02],
    ['champion', 0.04],
    ['god', 0.07]
  ]) {
    const query = queryFor({ ...enabled, augmentation });
    const factor = 1.15 * (1 + bonus);
    assert.ok(Math.abs(query.strikeMultiplier(player, 0) / baseline.strikeMultiplier(player, 0) - factor) < 1e-12);
    assert.ok(
      Math.abs(
        query.conditionMultiplier(CONDITION.BURNING, 0, player) /
          baseline.conditionMultiplier(CONDITION.BURNING, 0, player) -
          factor
      ) < 1e-12
    );
    for (const summonKind of ['pet', 'phantasm', 'clone', 'mech']) {
      const event = { ...player, actorType: ACTOR.SUMMON, ownerActorType: ACTOR.PLAYER, summonKind };
      assert.equal(query.strikeMultiplier(event, 0), baseline.strikeMultiplier(event, 0));
      assert.equal(
        query.conditionMultiplier(CONDITION.BURNING, 0, event),
        baseline.conditionMultiplier(CONDITION.BURNING, 0, event)
      );
    }
  }

  const disabled = queryFor({ ...enabled, enabled: false, augmentation: 'god' });
  assert.equal(disabled.strikeMultiplier(player, 0), baseline.strikeMultiplier(player, 0));
  assert.equal(
    disabled.conditionMultiplier(CONDITION.BURNING, 0, player),
    baseline.conditionMultiplier(CONDITION.BURNING, 0, player)
  );
});

// Requirement filtering, worker snapshots, and detailed verification must use the same immutable fractal scenario.
test('optimizer checks potion attributes and verifies scores under the captured scenario', () => {
  const build = warrior.profession.createBuildDefaults();
  build.weapons = ['Axe', 'Axe'];
  build.alternateWeapons = ['', ''];
  build.rotation = [
    { type: 'cast', skillId: warrior.profession.catalog.skills.find((skill) => skill.name === 'Chop').id }
  ];
  const app = {
    contentId: 'warrior',
    adapter: warrior,
    profession: warrior.profession,
    build,
    buildRevision: 1,
    patch: warrior.profession.resolvePatch({ id: 'current' }),
    changed() {
      this.buildRevision++;
    }
  };
  const before = buildContext(warrior, build).attributes(1).attributes;
  const limits = {
    minToughness: before.Toughness.final + 225,
    minVitality: before.Vitality.final + 225,
    minBoonDuration: before['Boon Duration'].final + 15
  };
  const unbuffed = captureGearOptimizerRequest(app, limits);
  assert.equal(createOptimizerEvaluator(unbuffed, warrior).score(optimizerEquipment(build)), null);
  const savedBuild = structuredClone(build);
  const selections = { ...limits, fractal: { ...enabled, augmentation: 'god' } };
  const request = captureGearOptimizerRequest(app, selections);
  selections.fractal.agonyResistance = 0;
  assert.equal(request.selections.fractal.agonyResistance, 150);
  assert.deepEqual(request.build, savedBuild);
  assert.deepEqual(build, savedBuild);
  const evaluator = createOptimizerEvaluator(request, warrior);
  const equipment = optimizerEquipment(request.build);
  const score = evaluator.score(equipment);
  assert.ok(score && score.dps > 0);
  const unbuffedDamage = createOptimizerEvaluator(unbuffed, warrior).evaluate(equipment).totalDamage;
  // The two runs independently round damage to whole points after applying the multiplier.
  assert.ok(Math.abs(score.totalDamage - unbuffedDamage * 1.15 * 1.07) < 2);
  verifyOptimizerScore(optimizerScore(score), optimizerScore(evaluator.evaluate(equipment)));
  const tooMuchToughness = {
    ...request,
    selections: { fractal: request.selections.fractal, maxToughness: before.Toughness.final }
  };
  assert.equal(createOptimizerEvaluator(tooMuchToughness, warrior).score(equipment), null);
  const job = createGroupedOptimizer(request, warrior);
  const result = job.evaluateRange(0n, job.space.count);
  assert.equal(result.winners.length, 1);
  verifyOptimizerScore(result.winners[0].score, score);
  applyOptimizerCandidate(app, request, result.winners[0]);
  assert.deepEqual(build.assumptions, savedBuild.assumptions);
  assert.equal(buildContext(warrior, build).simulationConfig().fractal, undefined);
  assert.equal(buildContext(warrior, build).attributes(1).attributes.Concentration.final, before.Concentration.final);
});
