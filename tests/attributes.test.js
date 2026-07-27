import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createDefaultBuild as createDefaultBuildFor,
    replaceBuild as replaceBuildFor,
} from '../js/app/app-state.js';
import {
    mesmerAppAdapter,
} from '../js/professions/mesmer/app/adapter.js';
import {
    calculateModifierContributions,
    computeModifierContributions,
    modifierContributionRequest,
    runSimulation,
    simulationConfig,
} from '../js/professions/mesmer/app/app-runtime.js';
import {
    calculateCommonAttributes,
    finalizeBuildAttributes,
} from '../js/platform/gw2/attributes.js';
import {
    calculateContributionComparisons,
} from '../js/app/app-runtime.js';
import {
    calculateAttributes as calculateMesmerAttributes,
} from '../js/professions/mesmer/core/calc-attributes.js';
import {
    aggregateSigilSet,
    setWeaponSigil,
} from '../js/platform/gw2/weapon-sigils.js';

const calcAttributes = calculateMesmerAttributes;
const createDefaultBuild = () => createDefaultBuildFor(mesmerAppAdapter);
const replaceBuild = saved => replaceBuildFor(saved, mesmerAppAdapter);

test('shared contribution comparisons accept a profession simulator', () => {
    const simulate = (_rotation, config) => ({ dps: config.dps });
    const contributions = calculateContributionComparisons({
        rotation: [],
        baseConfig: { dps: 100 },
        comparisons: [{
            modifier: { id: 'test', label: 'Test modifier' },
            config: { dps: 80 },
        }],
    }, simulate);

    assert.deepEqual(contributions, [{
        id: 'test',
        name: 'Test modifier',
        dpsIncrease: 20,
        pctIncrease: 25,
    }]);
});

test('core attribute calculation does not apply Mesmer build rules', () => {
    const build = createDefaultBuild();
    const common = calculateCommonAttributes(build);
    const mesmer = calculateMesmerAttributes(
        build,
        [{ id: 10232, name: 'Signet of Domination' }],
    );

    assert.equal(common.activeTraits, undefined);
    assert.equal(common.attributes['Condition Damage'].traits, 0);
    assert.equal(
        mesmer.attributes['Condition Damage'].final
            - common.attributes['Condition Damage'].final,
        180,
    );
});

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

test('alternate two-handed weapons use the 2H stat budget for set two', () => {
    const build = createDefaultBuild();
    build.alternateWeapons = ['Spear', ''];
    const first = calcAttributes(build, [], 1).attributes;
    const second = calcAttributes(build, [], 2).attributes;

    assert.equal(second.Power.final, first.Power.final + 1);
    assert.equal(second.Precision.final, first.Precision.final - 1);
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
    build.alternateWeapons = ['Dagger', 'Sword'];
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
    assert.equal(config.target.health, 3970000);
    assert.equal(config.target.conditions.Vulnerability, 25);
    assert.equal(config.target.conditions.Slow, true);
    assert.equal(config.target.conditions.Bleeding, 1);
    assert.equal(config.target.conditions.Torment, 1);
    assert.equal(config.target.conditions.Confusion, 1);
});

test('shared build finalization applies deltas and rebuilds derived stats', () => {
    const common = calculateCommonAttributes(createDefaultBuild());
    const original = structuredClone(common.attributes);
    const activeTraits = [{ id: 1, name: 'Test Trait' }];
    const result = finalizeBuildAttributes(common, {
        activeTraits,
        traitStats: {
            Power: 10,
            Precision: 21,
            Ferocity: 15,
            Concentration: 15,
            Expertise: 15,
        },
        traitDurations: {
            'Boon Duration': 2,
            'Condition Duration': 3,
            'Burning Duration': 4,
        },
        traitCriticalChance: 5,
    });

    assert.equal(result.commonContext, undefined);
    assert.equal(result.activeTraits, activeTraits);
    assert.deepEqual(common.attributes, original);
    assert.equal(result.attributes.Power.traits, 10);
    assert.equal(result.attributes.Power.final, original.Power.final + 10);
    assert.equal(
        result.attributes['Critical Chance'].final,
        original['Critical Chance'].final + 6,
    );
    assert.equal(
        result.attributes['Critical Damage'].final,
        original['Critical Damage'].final + 1,
    );
    assert.equal(
        result.attributes['Boon Duration'].final,
        original['Boon Duration'].final + 3,
    );
    assert.equal(
        result.attributes['Condition Duration'].final,
        original['Condition Duration'].final + 4,
    );
    assert.equal(result.attributes['Burning Duration'].traits, 4);
});

test('additive damage sigils sum into one modifier bucket', () => {
    const sigils = aggregateSigilSet(['Force', 'Impact']);

    assert.equal(sigils.strikeAdd, 0.08);
    assert.equal(sigils.strike, 1.08);
});

test('Mesmer browser simulations retain weaponmaster training', () => {
    const build = createDefaultBuild();
    build.specializations[2] = { name: 'Mirage', traits: '1-1-1' };
    build.weapons = ['Dagger', 'Sword'];
    build.alternateWeapons = ['Axe', 'Sword'];
    build.rotation = [
        'Flying Cutter',
        'Unstable Bladestorm',
        'Swap Weapons',
        'Lingering Thoughts',
        'Axes of Symmetry',
    ];
    const app = {
        build,
        attributeData: calcAttributes(build, []),
    };

    assert.equal(simulationConfig(app).weaponmasterTraining, true);
    assert.deepEqual(
        runSimulation(app).steps
            .filter(step => step.invalid)
            .map(step => step.skill),
        [],
    );
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

test('Mesmer runtime excludes Malicious Sorcery from static duration bonuses', () => {
    const build = createDefaultBuild();
    build.specializations.find(spec => spec.name === 'Illusions').traits = '1-2-3';
    const attributeData = calcAttributes(build, []);
    const config = simulationConfig({ build, attributeData });

    assert.equal(attributeData.attributes['Confusion Duration'].traits, 25);
    assert.equal(config.stats.conditionDurationBonuses.Confusion, undefined);
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

    assert.equal(migrated.targetHealth, 3970000);
    assert.equal(migrated.assumptions.targetConditions.Vulnerability, 12);
    assert.equal('targetHealthAbove50' in migrated.assumptions, false);
    assert.equal('vulnerability' in migrated.assumptions, false);
});
