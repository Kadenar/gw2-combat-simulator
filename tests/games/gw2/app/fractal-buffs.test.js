import assert from 'node:assert/strict';
import test from 'node:test';

import { createIsolatedPreview } from '#gw2/app/build/isolated-preview.js';
import { loadOptimizerContext } from '#gw2/app/optimizer/gear/context.js';
import { createGroupedOptimizer } from '#gw2/app/optimizer/gear/search-space.js';
import {
  applyOptimizerCandidate,
  captureGearOptimizerRequest,
  createOptimizerEvaluator,
  createOptimizerSpace,
  optimizerEquipment,
  optimizerScore,
  verifyOptimizerScore
} from '#gw2/app/optimizer/gear/search.js';
import {
  DEFAULT_FRACTAL_BUFFS,
  FRACTAL_AUGMENTATIONS,
  FRACTAL_POTION_DAMAGE_MULTIPLIER,
  fractalPotionBonus,
  validateFractalBuffs
} from '#gw2/platform/builds/fractal-buffs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';

const enabled = { ...DEFAULT_FRACTAL_BUFFS, enabled: true };
const potionBonus = fractalPotionBonus(enabled);
const boonDurationBonus = potionBonus / 15;
const damageFactor = (augmentation) =>
  FRACTAL_POTION_DAMAGE_MULTIPLIER * (1 + FRACTAL_AUGMENTATIONS[augmentation].damage);
const warrior = await loadOptimizerContext('warrior');
const buildContext = (adapter, build) =>
  adapter.createBuildContext({ build, patch: adapter.profession.resolvePatch({ id: 'current' }) });

// Invalid saved assumptions fail loading, validation, and optimizer capture before workers start.
test('saved fractal assumptions reject malformed fields', () => {
  const build = warrior.profession.createBuildDefaults();
  const app = {
    contentId: 'warrior',
    adapter: warrior,
    build,
    analysis: {
      state: {
        results: null,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null,
        buildRevision: 1
      }
    },
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
    build.assumptions.fractal = invalid;
    assert.equal(warrior.profession.validateBuild(build).valid, false);
    assert.throws(() => warrior.profession.migrateBuild(build), /Invalid fractal/);
    assert.throws(() => buildContext(warrior, build), /Invalid fractal/);
    assert.throws(() => captureGearOptimizerRequest(app, {}), /Invalid fractal/);
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
  // Saved settings survive loading and feed both ordinary contexts and detached previews.
  test(`${name}: saved fractal buffs reach previews and runtime stats`, async () => {
    const adapter = await loadOptimizerContext(name);
    const original = adapter.profession.createBuildDefaults();
    const baseline = buildContext(adapter, original);
    const originalJson = JSON.stringify(original);
    const saved = JSON.stringify({ ...original, assumptions: { ...original.assumptions, fractal: enabled } });
    const loaded = adapter.profession.migrateBuild(JSON.parse(saved));
    assert.deepEqual(loaded.assumptions.fractal, enabled);
    const context = buildContext(adapter, loaded);
    const config = context.simulationConfig();
    assert.equal(config.modifiers.playerStrike, damageFactor(enabled.augmentation));
    assert.equal(config.modifiers.playerCondition, damageFactor(enabled.augmentation));
    for (const set of [1, 2]) {
      const before = baseline.attributes(set).attributes;
      const after = context.attributes(set).attributes;
      for (const stat of ['Vitality', 'Toughness', 'Concentration']) {
        assert.equal(after[stat].final - before[stat].final, potionBonus, stat);
        assert.equal(after[stat].fractalPotions, potionBonus);
        assert.equal(
          config.attributeInputs.weaponSets[set - 1].conversionPool[stat],
          baseline.simulationConfig().attributeInputs.weaponSets[set - 1].conversionPool[stat]
        );
      }

      assert.equal(after['Boon Duration'].final - before['Boon Duration'].final, boonDurationBonus);
      assert.equal(after['Boon Duration'].fractalPotions, boonDurationBonus);
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
      for (const stat of ['concentration', 'toughness', 'vitality'])
        assert.equal(live[stat] - baseLive[stat], potionBonus);
    }

    const preview = createIsolatedPreview(
      {
        adapter,
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
    assert.equal(JSON.stringify(original), originalJson);
    assert.deepEqual(loaded.assumptions.fractal, enabled);
    const secondLoad = adapter.profession.migrateBuild(loaded);
    secondLoad.assumptions.fractal.agonyResistance = 0;
    assert.equal(loaded.assumptions.fractal.agonyResistance, 150);
    const withoutSettings = JSON.parse(originalJson);
    delete withoutSettings.assumptions.fractal;
    assert.deepEqual(adapter.profession.migrateBuild(withoutSettings).assumptions.fractal, DEFAULT_FRACTAL_BUFFS);
  });
}

// Both damage channels use multiplicative title/potion bonuses, with explicit actor exclusions before condition remapping.
test('fractal damage affects player strikes and conditions without affecting summons', () => {
  const build = warrior.profession.createBuildDefaults();
  const queryFor = (fractal) => {
    const current = buildContext(warrior, {
      ...build,
      assumptions: { ...build.assumptions, fractal }
    }).simulationConfig();
    return createGw2CombatQuery({
      profession: warrior.profession.runtimeFor(current),
      config: current,
      skillOnCooldown: () => false
    });
  };

  const baseline = queryFor(undefined);
  const player = { type: 'strike', actorType: ACTOR.PLAYER, skillId: 0 };
  for (const augmentation of Object.keys(FRACTAL_AUGMENTATIONS)) {
    const query = queryFor({ ...enabled, augmentation });
    const factor = damageFactor(augmentation);
    // Diagnostic factors name the same buffs applied to both damage channels.
    const strikeContributors = [];
    const conditionContributors = [];
    query.strikeMultiplier(player, 0, null, strikeContributors);
    query.conditionMultiplier(CONDITION.BURNING, 0, player, null, undefined, conditionContributors);
    for (const contributors of [strikeContributors, conditionContributors]) {
      assert.ok(contributors.some((entry) => entry.label === 'Fractal buffs'));
    }

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
    analysis: {
      state: {
        results: null,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null,
        buildRevision: 1
      }
    },
    patch: warrior.profession.resolvePatch({ id: 'current' }),
    changed() {
      this.analysis.state.buildRevision++;
    }
  };
  const before = buildContext(warrior, build).attributes(1).attributes;
  const limits = {
    minToughness: before.Toughness.final + potionBonus,
    minVitality: before.Vitality.final + potionBonus,
    minBoonDurationPercent: before['Boon Duration'].final + boonDurationBonus
  };
  const unbuffed = captureGearOptimizerRequest(app, limits);
  assert.equal(
    createOptimizerEvaluator(createOptimizerSpace(unbuffed, warrior), warrior).score(optimizerEquipment(build)),
    null
  );
  build.assumptions.fractal = { ...enabled, augmentation: 'god' };
  const savedBuild = structuredClone(build);
  const request = captureGearOptimizerRequest(app, limits);
  assert.deepEqual(build, savedBuild);
  build.assumptions.fractal.agonyResistance = 0;
  assert.equal(request.build.assumptions.fractal.agonyResistance, 150);
  assert.deepEqual(request.build, savedBuild);
  build.assumptions.fractal.agonyResistance = 150;
  const evaluator = createOptimizerEvaluator(createOptimizerSpace(request, warrior), warrior);
  const equipment = optimizerEquipment(request.build);
  const score = evaluator.score(equipment);
  assert.ok(score && score.dps > 0);
  const unbuffedDamage = createOptimizerEvaluator(createOptimizerSpace(unbuffed, warrior), warrior).evaluate(
    equipment
  ).totalDamage;
  // The two runs independently round damage to whole points after applying the multiplier.
  assert.ok(Math.abs(score.totalDamage - unbuffedDamage * damageFactor('god')) < 2);
  verifyOptimizerScore(optimizerScore(score), optimizerScore(evaluator.evaluate(equipment)));
  const tooMuchToughness = {
    ...request,
    selections: { maxToughness: before.Toughness.final }
  };
  assert.equal(
    createOptimizerEvaluator(createOptimizerSpace(tooMuchToughness, warrior), warrior).score(equipment),
    null
  );
  const job = createGroupedOptimizer(request, warrior);
  const result = job.evaluateRange(0n, job.space.count);
  assert.equal(result.winners.length, 1);
  verifyOptimizerScore(result.winners[0].score, optimizerScore(score));
  applyOptimizerCandidate(app, request, result.winners[0]);
  assert.deepEqual(build.assumptions, savedBuild.assumptions);
  assert.equal(buildContext(warrior, build).simulationConfig().modifiers.playerStrike, damageFactor('god'));
  assert.equal(
    buildContext(warrior, build).attributes(1).attributes.Concentration.final,
    before.Concentration.final + potionBonus
  );
});

// The mech keeps its equipment inheritance while player-only potion stats remain on the player.
test('fractal potion stats do not enter mech inheritance on either weapon set', async () => {
  const adapter = await loadOptimizerContext('engineer');
  const build = adapter.profession.createBuildDefaults();
  build.specializations = [{ name: 'Mechanist', traits: '1-2-1' }];
  const mech = { type: 'strike', actorType: ACTOR.SUMMON, summonKind: 'mech', metadata: { engineerMech: true } };
  const queryFor = (buffs) => {
    const config = buildContext(adapter, {
      ...build,
      assumptions: { ...build.assumptions, fractal: buffs }
    }).simulationConfig();
    return createGw2CombatQuery({
      config,
      profession: adapter.profession.runtimeFor(config),
      skillOnCooldown: () => false
    });
  };

  const before = queryFor(undefined);
  const after = queryFor(enabled);
  for (const activeWeaponSet of [1, 2]) {
    const runtime = { activeWeaponSet };
    const baseMech = before.statsAt(0, mech, runtime);
    const buffedMech = after.statsAt(0, mech, runtime);
    const basePlayer = before.statsAt(0, null, runtime);
    const buffedPlayer = after.statsAt(0, null, runtime);
    for (const stat of ['toughness', 'vitality', 'concentration']) {
      assert.equal(buffedMech[stat], baseMech[stat], stat);
      assert.equal(buffedPlayer[stat] - basePlayer[stat], potionBonus, stat);
    }

    assert.deepEqual(after.statsAt(0, mech, runtime), buffedMech);
  }
});
