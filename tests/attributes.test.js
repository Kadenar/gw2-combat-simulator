import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultBuild, replaceBuild } from '../js/app/app-state.js';
import {
    calculateModifierContributions,
    computeModifierContributions,
    modifierContributionRequest,
    runSimulation,
    simulationConfig,
} from '../js/app/app-runtime.js';
import { calcAttributes } from '../js/core/calc-attributes.js';
import { setWeaponSigil } from '../js/core/weapon-sigils.js';

test('attributes are derived from selected gear instead of user-entered stats', () => {
    const berserker = createDefaultBuild();
    const berserkerStats = calcAttributes(berserker, []).attributes;
    assert.equal(berserkerStats.Power.final, 2880);
    assert.equal(berserkerStats.Precision.final, 1961);

    const viper = structuredClone(berserker);
    for (const slot of Object.keys(viper.gear)) viper.gear[slot] = "Viper's";
    const viperStats = calcAttributes(viper, []).attributes;
    assert.ok(viperStats.Power.final < berserkerStats.Power.final);
    assert.ok(viperStats['Condition Damage'].final > berserkerStats['Condition Damage'].final);
    assert.ok(viperStats.Expertise.final > berserkerStats.Expertise.final);
});

test('two-handed weapons use one 2H item stat budget', () => {
    const oneHanded = createDefaultBuild();
    const twoHanded = structuredClone(oneHanded);
    twoHanded.weapons = ['Greatsword', ''];
    const one = calcAttributes(oneHanded, []).attributes;
    const two = calcAttributes(twoHanded, []).attributes;
    assert.equal(two.Power.final, one.Power.final + 1);
    assert.equal(two.Precision.final, one.Precision.final - 1);
});

test('the default build persists a complete alternate weapon set', () => {
    const build = createDefaultBuild();
    assert.deepEqual(build.weapons, ['Dagger', 'Sword']);
    assert.deepEqual(build.alternateWeapons, ['Spear', '']);
    assert.deepEqual(build.weaponSigils, [
        ['Force', 'Accuracy'],
        ['Force', 'Accuracy'],
    ]);
    assert.equal(Object.hasOwn(build, 'sigils'), false);
    assert.equal(build.assumptions.targetSkillActivationsPerSecond, 0);
});

test('legacy global sigils migrate onto both weapon sets', () => {
    const build = replaceBuild({ sigils: ['Bursting', 'Malice'] });
    assert.deepEqual(build.weaponSigils, [
        ['Bursting', 'Malice'],
        ['Bursting', 'Malice'],
    ]);
    assert.equal(Object.hasOwn(build, 'sigils'), false);
});

test('duplicate saved sigils are normalized independently in each weapon set', () => {
    const build = replaceBuild({
        weaponSigils: [
            ['Force', 'Force'],
            ['Bursting', 'Bursting'],
        ],
    });
    assert.equal(new Set(build.weaponSigils[0]).size, 2);
    assert.equal(new Set(build.weaponSigils[1]).size, 2);
    assert.equal(build.weaponSigils[0][0], 'Force');
    assert.equal(build.weaponSigils[1][0], 'Bursting');
});

test('choosing an equipped sigil swaps slots instead of creating a duplicate', () => {
    const build = createDefaultBuild();
    setWeaponSigil(build, 0, 1, 'Force');
    assert.deepEqual(build.weaponSigils[0], ['Accuracy', 'Force']);
});

test('attribute calculation shows sigil bonuses from the chosen weapon set', () => {
    const build = createDefaultBuild();
    build.weaponSigils = [
        ['Force', 'Malice'],
        ['Accuracy', 'Agony'],
    ];
    const firstSet = calcAttributes(build, [], 1).attributes;
    const secondSet = calcAttributes(build, [], 2).attributes;

    assert.equal(secondSet['Critical Chance'].final - firstSet['Critical Chance'].final, 7);
    assert.equal(firstSet['Condition Duration'].final - secondSet['Condition Duration'].final, 10);
});

test('a duplicate sigil contributes its stat bonus only once', () => {
    const duplicate = createDefaultBuild();
    duplicate.weaponSigils[0] = ['Accuracy', 'Accuracy'];
    const valid = createDefaultBuild();
    valid.weaponSigils[0] = ['Accuracy', 'Force'];

    assert.equal(
        calcAttributes(duplicate, [], 1).attributes['Critical Chance'].final,
        calcAttributes(valid, [], 1).attributes['Critical Chance'].final,
    );
});

test('simulation config aggregates each weapon set sigils independently', () => {
    const build = createDefaultBuild();
    build.weaponSigils = [
        ['Force', 'Accuracy'],
        ['Bursting', 'Malice'],
    ];
    const config = simulationConfig({
        build,
        attributeData: calcAttributes(build, []),
    });

    assert.equal(config.sigilSets[0].strike, 1.05);
    assert.equal(config.sigilSets[0].criticalChanceBonus, 7);
    assert.equal(config.sigilSets[1].condition, 1.05);
    assert.equal(config.sigilSets[1].conditionDurationBonus, 10);
    assert.equal(config.target.activatingSkills, false);
    assert.equal(config.target.confusionActivationsPerSecond, 0);
    assert.equal(config.target.health, 4000000);
    assert.equal(config.target.conditions.Vulnerability, 25);
    assert.equal(config.target.conditions.Slow, true);
    assert.equal(config.target.conditions.Bleeding, 1);
    assert.equal(config.target.conditions.Torment, 1);
    assert.equal(config.target.conditions.Confusion, 1);
});

test('simulation config preserves non-sigil condition duration bonuses', () => {
    const build = createDefaultBuild();
    build.rune = 'Trapper';
    build.weaponSigils = [
        ['Bursting', 'Demons'],
        ['Bursting', 'Demons'],
    ];
    const config = simulationConfig({
        build,
        attributeData: calcAttributes(build, []),
    });

    assert.equal(config.stats.conditionDurationBonus, 15);
    assert.deepEqual(config.stats.conditionDurationBonuses, {});
    assert.equal(config.sigilSets[0].conditionDurationBonuses.Torment, 20);
});

test('simulation config exposes the selected target skill activation rate', () => {
    const build = createDefaultBuild();
    build.assumptions.targetSkillActivationsPerSecond = 1.25;
    const config = simulationConfig({
        build,
        attributeData: calcAttributes(build, []),
    });

    assert.equal(config.target.activatingSkills, true);
    assert.equal(config.target.confusionActivationsPerSecond, 1.25);
});

test('simulation config does not multiply duplicate sigil effects', () => {
    const build = createDefaultBuild();
    build.weaponSigils[0] = ['Force', 'Force'];
    const config = simulationConfig({
        build,
        attributeData: calcAttributes(build, []),
    });

    assert.equal(config.sigilSets[0].strike, 1.05);
});

test('modifier contributions compare the active build against each modifier removed', () => {
    const build = createDefaultBuild();
    build.rotation = ['Bladecall'];
    build.relic = '';
    build.selectedSkills = {};
    const app = {
        build,
        attributeData: calcAttributes(build, []),
        attributeWeaponSet: 1,
        skillByName: new Map(),
    };
    const contributions = computeModifierContributions(app);
    const names = new Set(contributions.map(entry => entry.name));

    assert.equal(names.has('Might'), true);
    assert.equal(names.has('Vulnerability'), true);
    assert.equal(names.has('Sigil of Force'), true);
    assert.ok(contributions.every(entry =>
        Number.isFinite(entry.dpsIncrease)
        && Number.isFinite(entry.pctIncrease)));
});

test('interactive simulation leaves contribution passes to the background worker', () => {
    const build = createDefaultBuild();
    build.rotation = ['Bladecall'];
    build.relic = '';
    build.selectedSkills = {};
    const app = {
        build,
        attributeData: calcAttributes(build, []),
        attributeWeaponSet: 1,
        skillByName: new Map(),
    };

    const result = runSimulation(app);
    assert.equal(result.contributions, undefined);

    const request = structuredClone(modifierContributionRequest(app));
    assert.deepEqual(
        calculateModifierContributions(request),
        computeModifierContributions(app),
    );
});

test('saved builds fall back when their relic is no longer available', () => {
    assert.equal(replaceBuild({ relic: 'Brawler' }).relic, 'Thief');
    assert.equal(replaceBuild({ relic: 'Claw' }).relic, 'Claw');
});

test('legacy target assumptions migrate to target health and conditions', () => {
    const migrated = replaceBuild({
        assumptions: {
            vulnerability: 12,
            targetHealthAbove50: false,
        },
    });

    assert.equal(migrated.targetHealth, 4000000);
    assert.equal(migrated.assumptions.targetConditions.Vulnerability, 12);
    assert.equal('targetHealthAbove50' in migrated.assumptions, false);
    assert.equal('vulnerability' in migrated.assumptions, false);
});
