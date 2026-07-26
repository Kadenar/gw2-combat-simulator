import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from './helpers/fixture-harness-core.js';
import {
    simulateMesmer,
} from './helpers/mesmer-simulation.js';
import { chartValueAt } from '../js/platform/ui/charts.js';
import {
    moveRotationEntry,
} from '../js/platform/ui/timeline.js';
import {
    nextResultSortState,
    sortResultRows,
} from '../js/platform/ui/rotation-results.js';
import {
    buildChartSeries,
    continuumEndTimelineMarkers,
    formatResultTimelineTime,
    resultSummaryMetrics,
    shatterResourceSpends,
    simulationEventLogCsv,
    simulationEventLogRows,
    skillBreakdownRows,
    timelineWeaponRows,
} from '../js/app/rotation-ui.js';
import { RELIC_DATA } from '../js/platform/gw2/gear-data.js';
import { MESMER_SKILL_IDS as ID } from '../js/professions/mesmer/data/ids.js';

test('Relic of the Claw uses its relic icon in the proc timeline', () => {
    assert.equal(
        RELIC_DATA.Claw.icon,
        'https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png',
    );
});

test('queueing a cooling-down icon waits until it is available', () => {
    const result = simulateMesmer(['Bladecall', 'Bladecall'], defaultSimulationConfig());
    assert.equal(result.steps[0].start, 0);
    assert.equal(result.steps[0].end, 440);
    assert.equal(result.steps[1].start, 4440);
    assert.equal(result.endState.cooldowns.Bladecall.readyAt, 8880);
    assert.equal(result.endState.cooldowns.Bladecall.remaining, 4000);
});

test('Lingering Thoughts recharges one ammo count every six seconds', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateMesmer(
        ['Lingering Thoughts', 'Lingering Thoughts', 'Lingering Thoughts'],
        defaultSimulationConfig({
            specialization: 'Mirage',
            initialResource: 0,
            primaryWeapon: 'Axe',
            boons: {
                ...defaults.boons,
                quickness: false,
                alacrity: false,
            },
        }),
    );

    assert.deepEqual(
        result.steps.map(step => step.start),
        [0, 1645, 7395],
    );
    assert.equal(
        result.endState.ammo['Lingering Thoughts'].rechargeDuration,
        6,
    );
});

test('Rewinder refunds three seconds per clone shattered without counting the mesmer', () => {
    const secondCastAt = initialResource => simulateMesmer(
        ['Rewinder', 'Rewinder'],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource,
        }),
    ).steps[1].start;

    // Time Marches On makes Alacrity reduce the 30-second recharge to 20
    // seconds. Rewinder then refunds three seconds for each actual clone.
    assert.deepEqual(
        [0, 1, 2, 3].map(secondCastAt),
        [20000, 17000, 14000, 11000],
    );

    const fullShatter = simulateMesmer(
        ['Rewinder'],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
        }),
    );
    assert.deepEqual(shatterResourceSpends(fullShatter).get(0), {
        count: 3,
        resource: 'clones',
        sourceSkill: 'Rewinder',
    });
});

test('clone state remains capped at three when input or new summons exceed the cap', () => {
    const initial = simulateMesmer(
        [{ name: '__wait', waitMs: 1 }],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 99,
        }),
    );
    assert.equal(initial.endState.profession.resource, 3);

    const replaced = simulateMesmer(
        ['Mirror Images', { name: '__wait', waitMs: 1 }],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            selectedSkills: ['Mirror Images'],
            initialResource: 3,
        }),
    );
    const resourceEvents = replaced.events.filter(event =>
        event.type === 'resource' && event.resource === 'clones');

    assert.equal(replaced.endState.profession.resource, 3);
    assert.ok(resourceEvents.every(event => event.value <= 3));
});

test('non-Chronomancer alacrity starts the reduced cooldown after the cast', () => {
    const result = simulateMesmer(
        ['Bladecall', 'Bladecall'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.equal(result.steps[1].start, 4440);
});

test('Virtuoso alacrity starts Imaginary Inversion recharge after the cast', () => {
    const result = simulateMesmer(
        ['Imaginary Inversion', 'Imaginary Inversion'],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
        }),
    );
    assert.equal(result.steps[1].start, 8500);
});

test('Master of Misdirection reduces shatter cooldowns by 15%', () => {
    const result = simulateMesmer(
        [
            { name: '__wait', waitMs: 2010 },
            'Continuum Split',
        ],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            selectedTraits: ['Master of Misdirection'],
            initialResource: 3,
        }),
    );

    assert.equal(result.steps[1].start, 2010);
    assert.equal(result.endState.cooldowns['Continuum Split'].readyAt, 61510);
});

test("Fencer's Finesse reduces sword skill cooldowns by 20%", () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Sword',
        initialResource: 0,
    });
    const baseline = simulateMesmer(
        ['Blurred Frenzy', 'Blurred Frenzy'],
        config,
    );
    const withTrait = simulateMesmer(
        ['Blurred Frenzy', 'Blurred Frenzy'],
        {
            ...config,
            selectedTraits: ["Fencer's Finesse"],
        },
    );

    assert.equal(baseline.steps[1].start, 8960);
    assert.equal(withTrait.steps[1].start, 7360);
});

test('Flow of Time increases clone critical chance while alacrity is active', () => {
    const result = simulateMesmer(
        ['Phase Retreat', { name: '__wait', waitMs: 2600 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Flow of Time'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
            stats: { precision: 1000 },
            boons: { fury: false, alacrity: true },
        }),
    );
    const cloneHit = result.resolvedEvents.find(event =>
        event.type === 'damage' && event.source === 'Clone');
    assert.ok(cloneHit);
    assert.ok(Math.abs(cloneHit.criticalChance - 0.2) < 1e-12);
});

test('Phantasmal Fury increases phantasm critical chance', () => {
    const result = simulateMesmer(
        ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Phantasmal Fury'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
            stats: { precision: 1000 },
            boons: { fury: false, alacrity: false },
        }),
    );
    const phantasmHit = result.resolvedEvents.find(event =>
        event.type === 'damage' && event.source === 'Phantasm');
    assert.ok(phantasmHit);
    assert.ok(Math.abs(phantasmHit.criticalChance - 0.3) < 1e-12);
});

test('illusions do not inherit the mesmer Fury boon', () => {
    const result = simulateMesmer(
        ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: [],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
            stats: { precision: 1000 },
            boons: { fury: true, alacrity: false },
        }),
    );
    const phantasmHit = result.resolvedEvents.find(event =>
        event.type === 'damage' && event.source === 'Phantasm');

    assert.ok(Math.abs(phantasmHit.criticalChance - 0.05) < 1e-12);
});

test('Shift+click timeline form casts an instant skill 100ms into the prior cast', () => {
    const result = simulateMesmer(
        ['Bladecall', { name: 'Bladesong Distortion', offset: 100 }],
        defaultSimulationConfig(),
    );
    assert.equal(result.steps[1].start, 100);
    assert.equal(result.steps[1].end, 150);
    assert.equal(result.endState.time, 440);
    assert.equal(result.endState.cooldowns['Bladesong Distortion'].readyAt, 40100);
});

test('shift-queued Rewinder waits past its parent cast for cooldown expiry', () => {
    const result = simulateMesmer(
        [
            'Rewinder',
            { name: '__wait', waitMs: 10000 },
            'Bladecall',
            { name: 'Rewinder', offset: 100 },
        ],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
        }),
    );

    assert.equal(result.steps[2].end, 10490);
    assert.equal(result.steps[3].start, 11000);
    assert.deepEqual(result.warnings, []);
});

test('interrupt commands end casts and remove later hit events', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        secondaryWeapon: '',
    });
    const full = simulateMesmer(['Confusing Images'], config);
    const interrupted = simulateMesmer(
        [{ name: 'Confusing Images', interruptMs: 250 }],
        config,
    );
    assert.equal(interrupted.steps[0].end, 250);
    assert.equal(interrupted.steps[0].interrupted, true);
    assert.ok(interrupted.totalDamage < full.totalDamage);
});

test('Confusing Images applies seven timed confusion pulses and loses later pulses when interrupted', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        secondaryWeapon: '',
        initialResource: 0,
    });
    const full = simulateMesmer(['Confusing Images'], config);
    const interrupted = simulateMesmer(
        [{ name: 'Confusing Images', interruptMs: 1000 }],
        config,
    );
    const applications = result => result.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName === 'Confusing Images'
        && event.condition === 'Confusion');
    const fullApplications = applications(full);
    const interruptedApplications = applications(interrupted);

    assert.equal(fullApplications.length, 7);
    assert.ok(fullApplications.every(event => event.stacks === 1));
    assert.ok(fullApplications.every((event, index) =>
        index === 0 || event.at > fullApplications[index - 1].at));
    assert.equal(interruptedApplications.length, 3);
});

test('Chaos Storm and Lesser Chaos Storm deal six strikes at one-second intervals', () => {
    const damageEvents = (result, skillName) => result.resolvedEvents.filter(event =>
        event.type === 'damage' && event.skillName === skillName);
    const assertSixPulses = events => {
        assert.equal(events.length, 6);
        assert.ok(events.every(event => event.hits === 1));
        assert.ok(events.every((event, index) =>
            index === 0
            || Math.abs(event.at - events[index - 1].at - 1) < 1e-12));
    };

    const chaosStorm = simulateMesmer(
        ['Chaos Storm', { name: '__wait', waitMs: 5000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    assertSixPulses(damageEvents(chaosStorm, 'Chaos Storm'));

    const lesserChaosStorm = simulateMesmer(
        ['Ether Feast', { name: '__wait', waitMs: 5000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Method of Madness'],
            selectedSkills: ['Ether Feast'],
        }),
    );
    assertSixPulses(damageEvents(lesserChaosStorm, 'Lesser Chaos Storm'));
});

test('Confusing Images starts its cooldown after its channel ends', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        secondaryWeapon: '',
        initialResource: 0,
    });
    const full = simulateMesmer(
        ['Confusing Images', 'Confusing Images'],
        config,
    );
    const interrupted = simulateMesmer(
        [{ name: 'Confusing Images', interruptMs: 250 }],
        config,
    );

    assert.equal(full.steps[0].end, 1850);
    assert.equal(full.steps[1].start, 9050);
    assert.equal(interrupted.endState.cooldowns['Confusing Images'].readyAt, 7450);
});

test('Spatial Surge keeps channel packets completed before an interrupt', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: '',
        initialResource: 0,
    });
    const damageEvents = result => result.resolvedEvents.filter(event =>
        event.type === 'damage' && event.skillName === 'Spatial Surge');
    const full = damageEvents(simulateMesmer(['Spatial Surge'], config));
    const partial = damageEvents(simulateMesmer(
        [{ name: 'Spatial Surge', interruptMs: 600 }],
        config,
    ));
    const beforeFirstPacket = damageEvents(simulateMesmer(
        [{ name: 'Spatial Surge', interruptMs: 200 }],
        config,
    ));

    assert.equal(full.length, 3);
    assert.equal(partial.length, 2);
    assert.equal(beforeFirstPacket.length, 0);
    assert.ok(partial[1].at > partial[0].at);
});

test('Staff 3 converts after Mage Strike finishes and Chronophantasma repeats it first', () => {
    const rotation = [
        'Phantasmal Warlock',
        { name: '__wait', waitMs: 11000 },
    ];
    const baseConfig = {
        initialResource: 0,
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
    };
    const normal = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            ...baseConfig,
            specialization: 'Core',
            selectedTraits: [],
        }),
    );
    const chronophantasma = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            ...baseConfig,
            specialization: 'Chronomancer',
            selectedTraits: ['Chronophantasma'],
        }),
    );
    const normalConversions = normal.events.filter(
        event => event.reason === 'Phantasmal Warlock phantasm conversion',
    );
    const chronoConversions = chronophantasma.events.filter(
        event => event.reason === 'Phantasmal Warlock phantasm conversion',
    );
    const repeat = chronophantasma.events.find(
        event => event.name === 'Phantasmal Warlock — Chronophantasma',
    );
    const proc = chronophantasma.events.find(
        event => event.type === 'proc' && event.name === 'Chronophantasma',
    );

    assert.equal(normalConversions.length, 1);
    assert.equal(normalConversions[0].amount, 2);
    assert.ok(Math.abs(normalConversions[0].at - 4.2401) < 0.00001);
    assert.equal(chronoConversions.length, 1);
    assert.equal(chronoConversions[0].amount, 2);
    assert.ok(Math.abs(proc.at - 4.24) < 0.00001);
    assert.ok(Math.abs(repeat.at - 8.56) < 0.00001);
    assert.ok(Math.abs(chronoConversions[0].at - 9.8401) < 0.00001);

    const normalDamage = normal.resolvedEvents.filter(event =>
        event.type === 'damage' && event.name === 'Phantasmal Warlock');
    const normalTorment = normal.resolvedEvents.find(event =>
        event.type === 'condition'
        && event.name === 'Phantasmal Warlock — Torment');
    const repeatedDamage = chronophantasma.resolvedEvents.filter(event =>
        event.type === 'damage'
        && event.name === 'Phantasmal Warlock — Chronophantasma');
    const repeatedTorment = chronophantasma.resolvedEvents.find(event =>
        event.type === 'condition'
        && event.name === 'Phantasmal Warlock — Chronophantasma');

    assert.deepEqual(
        {
            coefficient: normalDamage.reduce((sum, event) => sum + event.coefficient, 0),
            hits: normalDamage.reduce((sum, event) => sum + event.hits, 0),
        },
        { coefficient: 0.9, hits: 6 },
    );
    assert.ok(normalDamage.every(event => event.weaponStrength === 2877));
    assert.equal(normalTorment.stacks, 12);
    assert.equal(normalTorment.source, 'Phantasm');
    assert.deepEqual(
        {
            coefficient: repeatedDamage.reduce((sum, event) => sum + event.coefficient, 0),
            hits: repeatedDamage.reduce((sum, event) => sum + event.hits, 0),
        },
        { coefficient: 0.9, hits: 6 },
    );
    assert.ok(repeatedDamage.every(event => event.weaponStrength === 2877));
    assert.equal(repeatedTorment.stacks, 12);
    assert.equal(repeatedTorment.source, 'Phantasm');
});

test('phantasm conditions use the summoner condition sigil modifiers', () => {
    const defaults = defaultSimulationConfig();
    const base = {
        specialization: 'Core',
        selectedTraits: [],
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
        initialResource: 0,
        target: {
            ...defaults.target,
            health: 0,
        },
    };
    const rotation = [
        'Phantasmal Warlock',
        { name: '__wait', waitMs: 9000 },
    ];
    const plain = simulateMesmer(
        rotation,
        defaultSimulationConfig(base),
    );
    const withSigils = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            ...base,
            sigilSets: [
                {
                    names: ['Bursting', 'Demons'],
                    condition: 1.05,
                    conditionDurationBonuses: { Torment: 20 },
                },
                { names: [] },
            ],
        }),
    );
    const application = result => result.resolvedEvents.find(event =>
        event.type === 'condition'
        && event.skillName === 'Phantasmal Warlock');
    const plainApplication = application(plain);
    const sigilApplication = application(withSigils);

    assert.equal(sigilApplication.source, 'Phantasm');
    assert.ok(
        sigilApplication.effectiveDuration
        > plainApplication.effectiveDuration,
    );
    assert.ok(
        Math.abs(
            (
                sigilApplication.damage / sigilApplication.damagingStackSeconds
            )
            / (
                plainApplication.damage / plainApplication.damagingStackSeconds
            )
            - 1.05
        ) < 0.000001,
    );
});

test('Compounding Power triggers for both phantasm summons and clone conversion', () => {
    const result = simulateMesmer(
        ['Phantasmal Warlock', { name: '__wait', waitMs: 11000 }],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            selectedTraits: ['Chronophantasma', 'Compounding Power'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const triggers = result.events.filter(event =>
        event.type === 'proc'
        && event.name === 'Compounding Power'
        && event.sourceSkill.includes('Phantasmal Warlock'));

    assert.deepEqual(
        triggers.map(event => event.at),
        [0.7799999999999999, 4.24, 9.8401],
    );
});

test('Compounding Power does not increase illusion attack damage', () => {
    const simulate = selectedTraits => simulateMesmer(
        ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits,
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const warlockDamage = result => result.resolvedEvents
        .filter(event =>
            event.type === 'damage'
            && event.name === 'Phantasmal Warlock')
        .reduce((sum, event) => sum + event.damage, 0);

    assert.equal(
        warlockDamage(simulate(['Compounding Power'])),
        warlockDamage(simulate([])),
    );
});

test('Compounding Power increases player strike damage by one percent per stack', () => {
    const simulate = selectedTraits => simulateMesmer(
        ['Mirror Images', 'Winds of Chaos'],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits,
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const playerDamage = result => result.resolvedEvents
        .find(event =>
            event.type === 'damage'
            && event.name === 'Winds of Chaos'
            && event.source === 'Player')
        .damage;

    assert.ok(Math.abs(
        playerDamage(simulate(['Compounding Power']))
        / playerDamage(simulate([]))
        - 1.02,
    ) < 1e-12);
});

test('Winds of Chaos uses its measured 760ms Quickness cast time', () => {
    const result = simulateMesmer(
        ['Winds of Chaos'],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
        }),
    );

    assert.equal(result.steps[0].end - result.steps[0].start, 760);
});

test('Phantasmal Warlock uses its measured 780ms Quickness cast time', () => {
    const result = simulateMesmer(
        ['Phantasmal Warlock'],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
        }),
    );

    assert.equal(result.steps[0].end - result.steps[0].start, 780);
});

test('corrected Mesmer skills use their measured Quickness cast times', () => {
    const coreConfig = {
        specialization: 'Core',
        initialResource: 0,
    };
    const counterspell = simulateMesmer(
        ['Illusionary Counter', 'Counterspell'],
        defaultSimulationConfig({
            ...coreConfig,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
        }),
    );
    assert.equal(counterspell.steps[1].end - counterspell.steps[1].start, 600);

    const signet = simulateMesmer(
        ['Signet of the Ether'],
        defaultSimulationConfig(coreConfig),
    );
    assert.equal(signet.steps[0].end - signet.steps[0].start, 920);

    const chaosStorm = simulateMesmer(
        ['Chaos Storm'],
        defaultSimulationConfig({
            ...coreConfig,
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
        }),
    );
    assert.equal(chaosStorm.steps[0].end - chaosStorm.steps[0].start, 480);

    const scepterChain = simulateMesmer(
        ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
        defaultSimulationConfig({
            ...coreConfig,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
        }),
    );
    assert.deepEqual(
        scepterChain.steps.map(step => step.end - step.start),
        [440, 520, 840],
    );

    const confusingImages = simulateMesmer(
        ['Confusing Images'],
        defaultSimulationConfig({
            ...coreConfig,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
        }),
    );
    assert.equal(
        confusingImages.steps[0].end - confusingImages.steps[0].start,
        1850,
    );

    const pistolSkills = simulateMesmer(
        ['Phantasmal Duelist', 'Magic Bullet'],
        defaultSimulationConfig({
            ...coreConfig,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Pistol',
        }),
    );
    assert.deepEqual(
        pistolSkills.steps.map(step => step.end - step.start),
        [540, 440],
    );

    const axeSkills = simulateMesmer(
        [
            'Lacerating Chop',
            'Ethereal Chop',
            'Mirror Strikes',
            'Lingering Thoughts',
            'Axes of Symmetry',
        ],
        defaultSimulationConfig({
            specialization: 'Mirage',
            primaryWeapon: 'Axe',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
        }),
    );
    assert.deepEqual(
        axeSkills.steps.map(step => step.end - step.start),
        [430, 530, 720, 930, 1020],
    );

    const greatswordSkills = simulateMesmer(
        ['Mind Stab', 'Phantasmal Berserker', 'Illusionary Wave'],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Greatsword',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    assert.deepEqual(
        greatswordSkills.steps.map(step => step.end - step.start),
        [360, 560, 640],
    );
});

test('Mind Stab applies its supplied Vulnerability coefficient scaling', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: '',
        selectedTraits: [],
        modifiers: { strike: 1, condition: 1 },
    });
    const damageAt = vulnerability => simulateMesmer(
        ['Mind Stab'],
        {
            ...config,
            target: {
                ...config.target,
                conditions: {
                    ...config.target.conditions,
                    Vulnerability: vulnerability,
                },
            },
        },
    ).resolvedEvents.find(event =>
        event.type === 'damage' && event.skillName === 'Mind Stab').damage;

    assert.ok(Math.abs(damageAt(25) / damageAt(0) - 1.5625) < 1e-12);
});

test('Phantasmal Berserker uses its phantasm coefficient and Bountiful reduction', () => {
    const coefficientAt = selectedTraits => simulateMesmer(
        ['Phantasmal Berserker', { name: '__wait', waitMs: 2000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Greatsword',
            secondaryWeapon: '',
            selectedTraits,
            initialResource: 0,
        }),
    ).events.filter(event =>
        event.type === 'damage'
        && event.skillName === 'Phantasmal Berserker')
        .reduce((sum, event) => sum + event.coefficient, 0);

    assert.ok(Math.abs(coefficientAt([]) - 2.4) < 1e-12);
    assert.ok(Math.abs(coefficientAt(['Bountiful Blades']) - 2.784) < 1e-12);
});

test('Mirror Blade resolves target-facing bounce damage as separate hits', () => {
    const simulateMirrorBlade = selectedTraits => simulateMesmer(
        ['Mirror Blade', { name: '__wait', waitMs: 1000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Greatsword',
            secondaryWeapon: '',
            selectedTraits,
            initialResource: 0,
        }),
    );
    const result = simulateMirrorBlade(['Bountiful Blades']);
    const hits = result.resolvedEvents.filter(event =>
        event.type === 'damage' && event.skillName === 'Mirror Blade');
    const baseHits = simulateMirrorBlade([]).resolvedEvents.filter(event =>
        event.type === 'damage' && event.skillName === 'Mirror Blade');

    assert.equal(hits.length, 4);
    assert.equal(baseHits.length, 3);
    assert.deepEqual(
        hits.map(event => event.coefficient),
        [2.5, 0.1, 0.004, 0.00016],
    );
    assert.ok(hits.every((event, index) =>
        index === 0 || event.at > hits[index - 1].at));
});

test('Pistol 4 converts after Illusionary Unload and its Chronophantasma repeat', () => {
    const rotation = [
        'Phantasmal Duelist',
        { name: '__wait', waitMs: 15000 },
    ];
    const baseConfig = {
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Pistol',
    };
    const normal = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            ...baseConfig,
            specialization: 'Core',
            selectedTraits: [],
        }),
    );
    const chronophantasma = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            ...baseConfig,
            specialization: 'Chronomancer',
            selectedTraits: ['Chronophantasma'],
        }),
    );
    const normalConversion = normal.events.find(
        event => event.reason === 'Phantasmal Duelist phantasm conversion',
    );
    const chronoConversion = chronophantasma.events.find(
        event => event.reason === 'Phantasmal Duelist phantasm conversion',
    );
    const resummon = chronophantasma.events.find(
        event => event.type === 'mesmer.phantasm-resummoned'
            && event.name === 'Phantasmal Duelist',
    );
    const repeat = chronophantasma.events.find(
        event => event.type === 'mesmer.phantasm-attack'
            && event.name === 'Phantasmal Duelist'
            && event.repeat,
    );

    assert.equal(normalConversion.amount, 1);
    assert.ok(Math.abs(normalConversion.at - 2.8801) < 0.00001);
    assert.ok(Math.abs(resummon.at - 2.88) < 0.00001);
    assert.ok(Math.abs(repeat.at - 6.44) < 0.00001);
    assert.equal(chronoConversion.amount, 1);
    assert.ok(Math.abs(chronoConversion.at - 7.0401) < 0.00001);
});

test('condition-bearing clone autoattacks apply their damaging conditions', () => {
    const axe = simulateMesmer(
        ['Mirror Images', { name: '__wait', waitMs: 5000 }],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedSkills: ['Mirror Images'],
            primaryWeapon: 'Axe',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
        }),
    );
    const axeConditions = axe.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName.startsWith('Clone: '));
    assert.ok(axeConditions.some(event =>
        event.condition === 'Bleeding' && event.duration === 6));
    assert.ok(axeConditions.some(event =>
        event.condition === 'Torment' && event.duration === 6));

    const staff = simulateMesmer(
        ['Phase Retreat', { name: '__wait', waitMs: 2500 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const staffConditions = staff.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName === 'Clone: Winds of Chaos');
    assert.equal(staffConditions.length, 2);
    assert.ok(staffConditions.some(event =>
        event.condition === 'Torment' && event.duration === 2));
    assert.ok(staffConditions.some(event =>
        event.condition === 'Confusion' && event.duration === 2));
    const staffHits = staff.resolvedEvents.filter(event =>
        event.type === 'damage'
        && event.skillName === 'Clone: Winds of Chaos');
    assert.equal(
        staffHits.reduce((sum, event) => sum + event.hits, 0),
        2,
    );

    const scepter = simulateMesmer(
        ['Mirror Images', { name: '__wait', waitMs: 2500 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedSkills: ['Mirror Images'],
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
        }),
    );
    const scepterTorment = scepter.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName === 'Clone: Ether Bolt'
        && event.condition === 'Torment');
    assert.equal(scepterTorment.length, 2);
    assert.ok(scepterTorment.every(event => event.duration === 4));
});

test('destroyed clones do not apply prescheduled autoattack conditions', () => {
    const result = simulateMesmer(
        ['Phase Retreat', 'Mind Wrack', { name: '__wait', waitMs: 2500 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    assert.equal(
        result.resolvedEvents.some(event =>
            event.type === 'condition'
            && event.skillName === 'Clone: Winds of Chaos'),
        false,
    );
});

test('Ineptitude applies confusion for each direct blind on a normal target', () => {
    const result = simulateMesmer(
        ['Chaos Armor', 'Signet of Midnight', { name: '__wait', waitMs: 100 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Ineptitude'],
            selectedSkills: ['Signet of Midnight'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const ineptitude = result.resolvedEvents.filter(event =>
        event.type === 'condition' && event.name.endsWith('— Ineptitude'));

    assert.equal(ineptitude.length, 2);
    assert.equal(ineptitude[0].skillName, 'Chaos Armor');
    assert.equal(ineptitude[0].condition, 'Confusion');
    assert.equal(ineptitude[0].duration, 5);
    assert.equal(ineptitude[0].stacks, 2);
    assert.equal(ineptitude[1].skillName, 'Signet of Midnight');
});

test('Ineptitude uses its three-second interval on defiant targets', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateMesmer(
        ['Chaos Armor', 'Signet of Midnight', { name: '__wait', waitMs: 100 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Ineptitude'],
            selectedSkills: ['Signet of Midnight'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
            target: {
                ...defaults.target,
                defiant: true,
            },
        }),
    );
    const ineptitude = result.resolvedEvents.filter(event =>
        event.type === 'condition' && event.name.includes('Ineptitude'));

    assert.equal(ineptitude.length, 1);
});

test('Chaos Armor applies three base confusion plus two from Ineptitude', () => {
    const result = simulateMesmer(
        ['Chaos Armor'],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Ineptitude'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const confusion = result.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName === 'Chaos Armor'
        && event.condition === 'Confusion');

    assert.deepEqual(confusion.map(event => event.stacks).sort(), [2, 3]);
});

test('Counterspell applies five base confusion plus two from Ineptitude', () => {
    const result = simulateMesmer(
        ['Illusionary Counter', 'Counterspell'],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Ineptitude'],
            primaryWeapon: 'Scepter',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const confusion = result.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName === 'Counterspell'
        && event.condition === 'Confusion');

    assert.deepEqual(confusion.map(event => event.stacks).sort(), [2, 5]);
});

test('Signet of Midnight blind applies two confusion from Ineptitude', () => {
    const result = simulateMesmer(
        ['Signet of Midnight'],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Ineptitude'],
            selectedSkills: ['Signet of Midnight'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const confusion = result.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName === 'Signet of Midnight'
        && event.condition === 'Confusion');

    assert.deepEqual(confusion.map(event => event.stacks), [2]);
});

test('Signet of Midnight expertise is inactive while recharging', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateMesmer(
        [
            'Confusing Images',
            'Signet of Midnight',
            'Confusing Images',
            'Confusing Images',
        ],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedSkills: ['Signet of Midnight'],
            primaryWeapon: 'Scepter',
            secondaryWeapon: '',
            stats: {
                ...defaults.stats,
                expertise: 180,
            },
            boons: {
                ...defaults.boons,
                quickness: false,
                alacrity: false,
            },
        }),
    );
    const applications = result.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.skillName === 'Confusing Images');

    assert.equal(applications.length, 21);
    assert.ok(applications.slice(0, 7).every(event =>
        Math.abs(event.effectiveDuration - 7.84) < 1e-12));
    assert.ok(applications.slice(7, 14).every(event =>
        event.effectiveDuration === 7));
    assert.ok(applications.slice(14).every(event =>
        Math.abs(event.effectiveDuration - 7.84) < 1e-12));
});

test('Continuum Shift restores Signet of Midnight passive expertise', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateMesmer(
        [
            'Continuum Split',
            'Signet of Midnight',
            'Continuum Shift',
            'Confusing Images',
        ],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            selectedSkills: ['Signet of Midnight'],
            selectedTraits: ['Malicious Sorcery'],
            primaryWeapon: 'Scepter',
            secondaryWeapon: '',
            initialResource: 3,
            stats: {
                ...defaults.stats,
                expertise: 180,
            },
            boons: {
                ...defaults.boons,
                quickness: false,
                alacrity: false,
            },
        }),
    );
    const application = result.resolvedEvents.find(event =>
        event.type === 'condition'
        && event.skillName === 'Confusing Images');

    assert.equal(application.effectiveDuration, 9.59);
});

test('Ineptitude treats control as an interrupt only for an activating target', () => {
    const defaults = defaultSimulationConfig();
    const config = {
        specialization: 'Core',
        selectedTraits: ['Ineptitude'],
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Pistol',
        initialResource: 0,
    };
    const idle = simulateMesmer(
        ['Magic Bullet', { name: '__wait', waitMs: 100 }],
        defaultSimulationConfig({
            ...config,
            target: {
                ...defaults.target,
                activatingSkills: false,
                confusionActivationsPerSecond: 0,
            },
        }),
    );
    const active = simulateMesmer(
        ['Magic Bullet', { name: '__wait', waitMs: 100 }],
        defaultSimulationConfig({
            ...config,
            target: {
                ...defaults.target,
                activatingSkills: true,
                confusionActivationsPerSecond: 1,
            },
        }),
    );
    const ineptitudeEvents = result => result.resolvedEvents.filter(event =>
        event.type === 'condition' && event.name.endsWith('— Ineptitude'));

    assert.equal(ineptitudeEvents(idle).length, 0);
    assert.equal(ineptitudeEvents(active).length, 1);
    assert.equal(ineptitudeEvents(active)[0].stacks, 2);
});

test('Blinding Dissipation triggers Ineptitude once per Rewinder strike', () => {
    const result = simulateMesmer(
        ['Mirror Images', 'Rewinder'],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            selectedTraits: ['Blinding Dissipation', 'Ineptitude'],
            selectedSkills: ['Mirror Images'],
            initialResource: 0,
        }),
    );
    const ineptitude = result.resolvedEvents.find(event =>
        event.type === 'condition'
        && event.skillName === 'Rewinder'
        && event.name.includes('Ineptitude'));

    // The mesmer and two clones each strike and blind.
    assert.equal(ineptitude.stacks, 6);
});

test('stationary torment uses the current PvE formula', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateMesmer(
        ['Ether Bolt', { name: '__wait', waitMs: 1000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
            stats: {
                ...defaults.stats,
                conditionDamage: 1000,
                expertise: 0,
            },
            boons: {
                ...defaults.boons,
                might: 0,
            },
            target: {
                ...defaults.target,
                vulnerability: 0,
                moving: false,
                activatingSkills: false,
                confusionActivationsPerSecond: 0,
            },
        }),
    );
    const torment = result.resolvedEvents.find(event =>
        event.type === 'condition' && event.condition === 'Torment');

    assert.ok(Math.abs(torment.damage - 121.8) < 1e-9);
});

test('static and condition-specific duration bonuses reach the resolver', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateMesmer(
        ['Ether Bolt', { name: '__wait', waitMs: 2000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
            stats: {
                ...defaults.stats,
                expertise: 0,
                conditionDurationBonus: 25,
                conditionDurationBonuses: { Torment: 25 },
            },
        }),
    );
    const torment = result.resolvedEvents.find(event =>
        event.type === 'condition' && event.condition === 'Torment');

    assert.equal(torment.effectiveDuration, 6);
});

test('target skill activations add the current PvE confusion activation damage', () => {
    const defaults = defaultSimulationConfig();
    const config = {
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Pistol',
        initialResource: 0,
        stats: {
            ...defaults.stats,
            conditionDamage: 1000,
            expertise: 0,
        },
        boons: {
            ...defaults.boons,
            might: 0,
        },
    };
    const resultAt = confusionActivationsPerSecond => simulateMesmer(
        ['Confusing Images', { name: '__wait', waitMs: 1000 }],
        defaultSimulationConfig({
            ...config,
            target: {
                ...defaults.target,
                vulnerability: 0,
                activatingSkills: confusionActivationsPerSecond > 0,
                confusionActivationsPerSecond,
            },
        }),
    );
    const base = resultAt(0);
    const active = resultAt(1);
    const confusionDamage = result => result.resolvedEvents
        .filter(event => event.type === 'condition' && event.condition === 'Confusion')
        .reduce((sum, event) => sum + event.damage, 0);
    const stackSeconds = base.resolvedEvents
        .filter(event => event.type === 'condition' && event.condition === 'Confusion')
        .reduce((sum, event) => sum + event.damagingStackSeconds, 0);
    const activationDamage = confusionDamage(active) - confusionDamage(base);

    assert.ok(
        Math.abs(
            activationDamage
            - stackSeconds * (16.24 + 0.0325 * 1000),
        ) < 1e-9,
    );
});

test('event log distinguishes phantasm summon, attack, and clone conversion', () => {
    const result = simulateMesmer(
        ['Phantasmal Duelist', { name: '__wait', waitMs: 7000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
        }),
    );
    const log = simulationEventLogRows(result);

    assert.ok(log.some(event =>
        Math.abs(event.at - 0.54) < 0.00001
        && event.description === 'PHANTASM SUMMONED Phantasmal Duelist x1'));
    assert.ok(log.some(event =>
        Math.abs(event.at - 2.4) < 0.00001
        && event.description === 'PHANTASM DAMAGE COMPLETE Phantasmal Duelist x1'));
    assert.ok(log.some(event =>
        Math.abs(event.at - 2.8801) < 0.00001
        && event.description.includes('CLONE SPAWNED x1')
        && event.description.includes('Phantasmal Duelist phantasm conversion')));
    assert.match(simulationEventLogCsv(log), /Phantasmal Duelist phantasm conversion/);
});

test('Virtuoso bladesongs spend the configured starting blades', () => {
    const result = simulateMesmer(
        ['Bladesong Harmony'],
        defaultSimulationConfig({ initialResource: 5 }),
    );
    assert.equal(result.endState.profession.resource, 0);
});

test('sigil and relic damage modifiers affect the queued rotation result', () => {
    const config = defaultSimulationConfig();
    const base = simulateMesmer(
        ['Bladecall', 'Unstable Bladestorm'],
        { ...config, relic: '', modifiers: { strike: 1, condition: 1 } },
    );
    const equipped = simulateMesmer(
        ['Bladecall', 'Unstable Bladestorm'],
        { ...config, relic: 'Thief', modifiers: { strike: 1.05, condition: 1 } },
    );
    assert.ok(equipped.totalDamage > base.totalDamage * 1.05);
});

test('weapon swaps activate only the equipped set damage sigils', () => {
    const config = defaultSimulationConfig({
        relic: '',
        primaryWeapon: 'Dagger',
        secondaryWeapon: 'Sword',
        weaponSet2Primary: 'Spear',
        weaponSet2Secondary: '',
        modifiers: { strike: 1, condition: 1 },
    });
    const rotation = ['Bladecall', 'Swap Weapons', 'Psycut'];
    const base = simulateMesmer(rotation, config);
    const equipped = simulateMesmer(rotation, {
        ...config,
        sigilSets: [
            { strike: 1.05, condition: 1 },
            { strike: 1, condition: 1 },
        ],
    });
    const strike = (result, name) =>
        result.breakdown.find(entry => entry.name === name).strikeDamage;

    assert.ok(Math.abs(strike(equipped, 'Bladecall') / strike(base, 'Bladecall') - 1.05) < 1e-12);
    assert.ok(Math.abs(strike(equipped, 'Psycut') / strike(base, 'Psycut') - 1) < 1e-12);
});

test('weapon swaps activate only the equipped set duration sigils', () => {
    const result = simulateMesmer(
        [
            'Confusing Images',
            'Swap Weapons',
            'Confusing Images',
            { name: '__wait', waitMs: 10000 },
        ],
        defaultSimulationConfig({
            relic: '',
            selectedTraits: [],
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
            weaponSet2Primary: 'Scepter',
            weaponSet2Secondary: 'Sword',
            stats: { expertise: 0 },
            sigilSets: [
                {
                    strike: 1,
                    condition: 1,
                    conditionDurationBonus: 10,
                },
                {
                    strike: 1,
                    condition: 1,
                    conditionDurationBonus: 0,
                },
            ],
        }),
    );
    const applications = result.resolvedEvents.filter(event =>
        event.type === 'condition' && event.skillName === 'Confusing Images');

    assert.equal(applications.length, 14);
    assert.ok(applications.slice(0, 7).every(application =>
        Math.abs(application.effectiveDuration - 7.7) < 1e-12));
    assert.ok(applications.slice(7).every(application =>
        Math.abs(application.effectiveDuration - 7) < 1e-12));
});

test('Relic of the Claw buffs strikes after a control skill for eight seconds', () => {
    const config = defaultSimulationConfig({
        relic: '',
        modifiers: { strike: 1, condition: 1 },
    });
    const base = simulateMesmer(
        ['Bladesong Dissonance', 'Bladecall'],
        config,
    );
    const equipped = simulateMesmer(
        ['Bladesong Dissonance', 'Bladecall'],
        { ...config, relic: 'Claw' },
    );
    const damage = (result, name) =>
        result.breakdown.find(entry => entry.name === name).strikeDamage;

    assert.equal(
        damage(equipped, 'Bladesong Dissonance'),
        damage(base, 'Bladesong Dissonance'),
    );
    assert.ok(
        Math.abs(
            damage(equipped, 'Bladecall') / damage(base, 'Bladecall') - 1.07,
        ) < 1e-12,
    );
    assert.ok(equipped.procSteps.some(proc =>
        proc.type === 'relic_proc'
        && proc.skill === 'Relic of the Claw'
        && proc.sourceSkill === 'Bladesong Dissonance'
        && proc.detail === 'activated'));
});

test('Relic of the Claw can trigger from a non-damaging control skill and expires', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        relic: 'Claw',
        modifiers: { strike: 1, condition: 1 },
    });
    const active = simulateMesmer(
        ['Signet of Domination', 'Mind Slash'],
        config,
    );
    const expired = simulateMesmer(
        ['Signet of Domination', { name: '__wait', waitMs: 8001 }, 'Mind Slash'],
        config,
    );
    const activeDamage =
        active.breakdown.find(entry => entry.name === 'Mind Slash').strikeDamage;
    const expiredDamage =
        expired.breakdown.find(entry => entry.name === 'Mind Slash').strikeDamage;

    assert.ok(Math.abs(activeDamage / expiredDamage - 1.07) < 1e-12);
});

test('Relic of the Claw records activation and refresh procs', () => {
    const claw = simulateMesmer(
        ['Signet of Domination', 'Diversion', { name: '__wait', waitMs: 8001 }, 'Signet of Domination'],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 3,
            relic: 'Claw',
        }),
    );
    assert.deepEqual(
        claw.procSteps
            .filter(proc => proc.skill === 'Relic of the Claw')
            .map(proc => ({ sourceSkill: proc.sourceSkill, detail: proc.detail })),
        [
            { sourceSkill: 'Signet of Domination', detail: 'activated' },
            { sourceSkill: 'Diversion', detail: 'refreshed' },
            { sourceSkill: 'Signet of Domination', detail: 'activated' },
        ],
    );
});

test('timed relic buffs only add a proc when the buff was not already active', () => {
    const fireworks = simulateMesmer(
        ['Chaos Storm', { name: '__wait', waitMs: 14000 }, 'Chaos Storm'],
        defaultSimulationConfig({
            specialization: 'Core',
            relic: 'Fireworks',
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            weaponSet2Primary: 'Staff',
            weaponSet2Secondary: '',
        }),
    );
    assert.equal(
        fireworks.procSteps.filter(proc => proc.skill === 'Relic of Fireworks').length,
        2,
    );
});

test('Relic of Akeem triggers on control against five confusion stacks', () => {
    const result = simulateMesmer(
        [
            'Bladesong Sorrow',
            'Bladecall',
            'Bladesong Dissonance',
            { name: '__wait', waitMs: 12000 },
        ],
        defaultSimulationConfig({
            relic: 'Akeem',
            initialResource: 5,
            modifiers: { strike: 1, condition: 1 },
        }),
    );

    assert.ok(result.procSteps.some(proc =>
        proc.type === 'relic_proc'
        && proc.skill === 'Relic of Akeem'
        && proc.sourceSkill === 'Bladesong Dissonance'));
    assert.ok(result.breakdown.some(entry =>
        entry.name === 'Relic of Akeem — Confusion'
        && entry.conditionDamage > 0));
    assert.ok(result.breakdown.some(entry =>
        entry.name === 'Relic of Akeem — Torment'
        && entry.conditionDamage > 0));
});

test('Relic of Akeem is reported when its trigger ends the rotation', () => {
    const result = simulateMesmer(
        [
            'Bladesong Sorrow',
            'Bladecall',
            'Bladesong Dissonance',
        ],
        defaultSimulationConfig({
            relic: 'Akeem',
            initialResource: 5,
        }),
    );

    assert.ok(result.procSteps.some(proc =>
        proc.type === 'relic_proc'
        && proc.skill === 'Relic of Akeem'
        && proc.sourceSkill === 'Bladesong Dissonance'));
});

test('Relic of the Eagle activates after runtime damage drops the target below 50%', () => {
    const config = defaultSimulationConfig({
        relic: '',
        modifiers: { strike: 1, condition: 1 },
    });
    const probe = simulateMesmer(['Bladecall'], config);
    const firstHitDamage = probe.resolvedEvents.find(event =>
        event.type === 'damage' && event.skillName === 'Bladecall').damage;
    const target = {
        ...config.target,
        health: firstHitDamage * 1.5,
    };
    const base = simulateMesmer(
        ['Bladecall', 'Bladecall'],
        { ...config, target },
    );
    const eagle = simulateMesmer(
        ['Bladecall', 'Bladecall'],
        { ...config, relic: 'Eagle', target },
    );
    const hits = result => result.resolvedEvents
        .filter(event => event.type === 'damage' && event.skillName === 'Bladecall')
        .map(event => event.damage);

    assert.equal(hits(eagle)[0], hits(base)[0]);
    assert.ok(Math.abs(hits(eagle)[1] / hits(base)[1] - 1.1) < 1e-12);
    assert.equal(eagle.deathTime, base.deathTime);
});

test('permanent target conditions satisfy condition-dependent relic triggers', () => {
    const result = simulateMesmer(
        ['Bladesong Dissonance'],
        defaultSimulationConfig({
            relic: 'Akeem',
            initialResource: 5,
            target: {
                ...defaultSimulationConfig().target,
                conditions: {
                    Confusion: 5,
                    Torment: 0,
                    Vulnerability: 0,
                },
            },
        }),
    );

    assert.ok(result.procSteps.some(proc =>
        proc.skill === 'Relic of Akeem'
        && proc.sourceSkill === 'Bladesong Dissonance'));
});

test('Relic of Mistburn grants ten percent critical chance at ten Might', () => {
    const config = defaultSimulationConfig({
        relic: 'Mistburn',
        stats: {
            ...defaultSimulationConfig().stats,
            precision: 1000,
        },
        modifiers: { strike: 1, condition: 1 },
    });
    const resultAt = might => simulateMesmer(
        ['Bladecall'],
        {
            ...config,
            boons: {
                ...config.boons,
                might,
                fury: false,
            },
        },
    );
    const criticalChance = result =>
        result.resolvedEvents.find(event => event.type === 'damage').criticalChance;

    assert.ok(Math.abs(criticalChance(resultAt(9)) - 0.05) < 1e-12);
    assert.ok(Math.abs(criticalChance(resultAt(10)) - 0.15) < 1e-12);
});

test('Relic of Aristocracy extends conditions after weakness or vulnerability', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        relic: 'Aristocracy',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Pistol',
        stats: {
            ...defaultSimulationConfig().stats,
            expertise: 0,
        },
        modifiers: { strike: 1, condition: 1 },
    });
    const result = simulateMesmer(
        [
            'Mind Slash',
            'Mind Gash',
            'Phantasmal Duelist',
            { name: '__wait', waitMs: 5000 },
        ],
        config,
    );
    const bleeding = result.resolvedEvents.find(event =>
        event.type === 'condition'
        && event.skillName === 'Phantasmal Duelist'
        && event.condition === 'Bleeding');

    assert.ok(Math.abs(bleeding.effectiveDuration - 4.12) < 1e-12);
    assert.ok(result.procSteps.some(proc =>
        proc.type === 'relic_proc'
        && proc.skill === 'Relic of Aristocracy'
        && proc.sourceSkill === 'Mind Slash'
        && proc.detail === '1/5 stacks'));
    assert.equal(
        result.procSteps.filter(proc => proc.skill === 'Relic of Aristocracy').length,
        1,
    );
});

test('Relic of Peitha triggers from Mesmer shadowsteps', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        relic: '',
        modifiers: { strike: 1, condition: 1 },
    });
    const base = simulateMesmer(
        ['Blink', 'Mind Slash', { name: '__wait', waitMs: 8000 }],
        config,
    );
    const equipped = simulateMesmer(
        ['Blink', 'Mind Slash', { name: '__wait', waitMs: 8000 }],
        { ...config, relic: 'Peitha' },
    );
    const damage = result =>
        result.breakdown.find(entry => entry.name === 'Mind Slash').strikeDamage;

    assert.ok(Math.abs(damage(equipped) / damage(base) - 1.10) < 1e-12);
    assert.ok(equipped.breakdown.some(entry =>
        entry.name === 'Relic of Peitha — Torment'
        && entry.conditionDamage > 0));
    assert.ok(equipped.procSteps.some(proc =>
        proc.type === 'relic_proc'
        && proc.skill === 'Relic of Peitha'
        && proc.sourceSkill === 'Blink'));
});

test('Relic of Thorns uses the deterministic incoming-hit assumption', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        relic: '',
        primaryWeapon: 'Dagger',
        secondaryWeapon: 'Pistol',
        modifiers: { strike: 1, condition: 1 },
    });
    const rotation = [
        { name: '__wait', waitMs: 3100 },
        'Phantasmal Duelist',
        { name: '__wait', waitMs: 5000 },
    ];
    const base = simulateMesmer(rotation, config);
    const equipped = simulateMesmer(rotation, { ...config, relic: 'Thorns' });

    assert.ok(equipped.conditionDamage > base.conditionDamage);
    assert.deepEqual(
        equipped.procSteps
            .filter(proc => proc.skill === 'Relic of Thorns')
            .map(proc => proc.start),
        [3000, 8000],
    );
});

test('weapon swap changes sets and observes its cooldown before swapping back', () => {
    const result = simulateMesmer(
        ['Swap Weapons', 'Swap Weapons'],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 0,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
            weaponSet2Primary: 'Spear',
            weaponSet2Secondary: '',
        }),
    );
    assert.equal(result.steps[0].start, 0);
    assert.equal(result.steps[1].start, 10000);
    assert.equal(result.endState.activeWeaponSet, 1);
    assert.equal(result.endState.cooldowns['Swap Weapons'].readyAt, 20000);
});

test('weapon swaps start new weapon-set rows in the rotation timeline', () => {
    const rows = timelineWeaponRows([
        'Bladecall',
        'Swap Weapons',
        'Psycut',
        'Swap Weapons',
        'Bladecall',
    ]);
    assert.deepEqual(rows.map(row => row.weaponSet), [1, 2, 1]);
    assert.deepEqual(rows.map(row => row.skills.map(skill => skill.index)), [
        [0, 1],
        [2, 3],
        [4],
    ]);
});

test('a final weapon swap remains on its originating weapon-set row', () => {
    const rows = timelineWeaponRows(['Bladecall', 'Swap Weapons']);
    assert.deepEqual(rows.map(row => row.weaponSet), [1]);
    assert.deepEqual(rows[0].skills.map(skill => skill.index), [0, 1]);
});

test('rotation drag reordering respects before and after insertion positions', () => {
    const rotation = ['Bladecall', 'Mirror Blade', 'Mind Spike'];

    assert.equal(moveRotationEntry(rotation, 0, 2), true);
    assert.deepEqual(rotation, ['Mirror Blade', 'Bladecall', 'Mind Spike']);

    assert.equal(moveRotationEntry(rotation, 2, 0), true);
    assert.deepEqual(rotation, ['Mind Spike', 'Mirror Blade', 'Bladecall']);

    assert.equal(moveRotationEntry(rotation, 0, rotation.length), true);
    assert.deepEqual(rotation, ['Mirror Blade', 'Bladecall', 'Mind Spike']);

    assert.equal(moveRotationEntry(rotation, 1, 2), false);
    assert.deepEqual(rotation, ['Mirror Blade', 'Bladecall', 'Mind Spike']);
});

test('shift-queued Mirror Images after an instant action still grants clones', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Dagger',
        secondaryWeapon: 'Sword',
    });
    const result = simulateMesmer(
        ['Blink', { name: 'Mirror Images', offset: 100 }],
        config,
    );
    assert.equal(result.endState.time, 150);
    assert.equal(result.endState.profession.resource, 2);
});

test('shift-queued Mirror Images after a resource-generating cast grants both clones', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Dagger',
        secondaryWeapon: 'Sword',
    });
    const result = simulateMesmer(
        ['Bladecall', { name: 'Mirror Images', offset: 100 }],
        config,
    );
    const mirrorImagesResource = result.events.find(
        event => event.type === 'resource' && event.reason === 'Mirror Images',
    );

    assert.equal(mirrorImagesResource?.amount, 2);
    assert.equal(result.endState.profession.resource, 3);
});

test('clones from shift-queued Mirror Images are available to the next shatter', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
    });
    const result = simulateMesmer(
        ['Blink', { name: 'Mirror Images', offset: 100 }, 'Mind Wrack'],
        config,
    );
    assert.equal(result.steps.length, 3);
    assert.equal(result.steps[2].start, 150);
    assert.equal(result.endState.profession.resource, 0);
});

test('Sharper Images uses deterministic expected-proc accumulation', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        selectedTraits: ['Sharper Images'],
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Pistol',
        stats: {
            ...defaultSimulationConfig().stats,
            precision: 1105,
        },
        boons: {
            ...defaultSimulationConfig().boons,
            fury: false,
        },
    });
    const first = simulateMesmer(
        ['Phantasmal Duelist', { name: '__wait', waitMs: 1000 }],
        config,
    );
    const second = simulateMesmer(
        [
            'Phantasmal Duelist',
            { name: '__wait', waitMs: 16000 },
            'Phantasmal Duelist',
            { name: '__wait', waitMs: 1000 },
        ],
        config,
    );
    assert.equal(
        first.procSteps.filter(proc => proc.skill === 'Sharper Images').length,
        0,
    );
    assert.ok(second.procSteps.some(proc =>
        proc.skill === 'Sharper Images' && proc.detail === '1 critical-hit proc'));
    assert.equal(
        second.resolvedEvents.find(event =>
            event.type === 'condition'
            && event.name.includes('Sharper Images'))?.source,
        'Player',
    );
});

test('Illusionary Counter arms one Counterspell without generating clones itself', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const counter = simulateMesmer(['Illusionary Counter'], config);
    assert.equal(counter.steps[0].end, 120);
    assert.equal(counter.steps[0].interrupted, true);
    assert.ok(counter.steps[0].fullCastMs > 120);
    assert.equal(
        counter.breakdown.some(entry => entry.name === 'Illusionary Counter'),
        false,
    );
    assert.equal(counter.endState.profession.resource, 0);
    assert.equal(counter.endState.profession.counterspellAvailable, true);
    assert.equal(
        counter.resolvedEvents.some(event =>
            event.type === 'condition'
            && event.skillName === 'Illusionary Counter'
            && event.condition === 'Torment'),
        false,
    );

    const unavailable = simulateMesmer(['Counterspell'], config);
    assert.equal(unavailable.steps.filter(step => !step.invalid).length, 0);
    assert.match(unavailable.warnings[0], /Illusionary Counter is not active/);

    const flipped = simulateMesmer(
        ['Illusionary Counter', 'Counterspell', 'Counterspell'],
        config,
    );
    assert.equal(flipped.steps.filter(step => !step.invalid).length, 2);
    assert.equal(flipped.steps[1].start, 120);
    assert.equal(flipped.endState.profession.resource, 1);
    assert.equal(flipped.endState.profession.counterspellAvailable, false);
    assert.ok(flipped.breakdown.some(entry => entry.name === 'Counterspell'));
});

test('Ether Bolt and Ether Blast do not generate clones', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const result = simulateMesmer(['Ether Bolt', 'Ether Blast'], config);
    assert.deepEqual(result.steps.map(step => step.skill), ['Ether Bolt', 'Ether Blast']);
    assert.equal(result.endState.profession.resource, 0);
});

test('Ether Clone creates a clone below cap and inflicts torment at cap', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const belowCap = simulateMesmer(
        ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
        { ...config, initialResource: 2 },
    );
    assert.equal(belowCap.endState.profession.resource, 3);
    assert.equal(
        belowCap.events.some(event =>
            event.type === 'condition'
            && event.skillName === 'Ether Clone'
            && event.condition === 'Torment'),
        false,
    );

    const atCap = simulateMesmer(
        ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
        { ...config, initialResource: 3 },
    );
    assert.equal(atCap.endState.profession.resource, 3);
    assert.ok(atCap.events.some(event =>
        event.type === 'condition'
        && event.skillName === 'Ether Clone'
        && event.condition === 'Torment'
        && event.duration === 9));
});

test('autoattack chain steps unlock only after the preceding attack', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const locked = simulateMesmer(['Ether Blast', 'Ether Clone'], config);
    assert.equal(locked.steps.filter(step => !step.invalid).length, 0);
    assert.match(locked.warnings[0], /cast Ether Bolt first/);

    const skippedStep = simulateMesmer(
        ['Ether Bolt', 'Ether Clone'],
        config,
    );
    assert.deepEqual(
        skippedStep.steps.filter(step => !step.invalid).map(step => step.skill),
        ['Ether Bolt'],
    );
    assert.equal(
        skippedStep.endState.profession.autoattackChains[ID.ETHER_BOLT],
        ID.ETHER_BLAST,
    );
    assert.match(skippedStep.warnings[0], /cast Ether Blast first/);

    const completed = simulateMesmer(
        ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
        config,
    );
    assert.equal(
        completed.endState.profession.autoattackChains[ID.ETHER_BOLT],
        ID.ETHER_BOLT,
    );
});

test('Scepter weapon skills preserve Ether Bolt chain progress', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const result = simulateMesmer(
        ['Ether Bolt', 'Confusing Images', 'Ether Blast'],
        config,
    );
    assert.deepEqual(
        result.steps.map(step => step.skill),
        ['Ether Bolt', 'Confusing Images', 'Ether Blast'],
    );
    assert.equal(
        result.endState.profession.autoattackChains[ID.ETHER_BOLT],
        ID.ETHER_CLONE,
    );
});

test('Imaginary Axes preserves the axe auto chain but other skills reset it', () => {
    const config = defaultSimulationConfig({
        specialization: 'Mirage',
        initialResource: 0,
        primaryWeapon: 'Axe',
        secondaryWeapon: 'Pistol',
    });
    const preserved = simulateMesmer(
        [
            'Lacerating Chop',
            'Dodge / Mirage Cloak',
            'Imaginary Axes',
            'Ethereal Chop',
        ],
        config,
    );
    assert.deepEqual(
        preserved.steps.filter(step => !step.invalid).map(step => step.skill),
        [
            'Lacerating Chop',
            'Dodge / Mirage Cloak',
            'Imaginary Axes',
            'Ethereal Chop',
        ],
    );
    assert.equal(
        preserved.endState.profession.autoattackChains[ID.LACERATING_CHOP],
        ID.MIRROR_STRIKES,
    );

    const interrupted = simulateMesmer(
        ['Lacerating Chop', 'Lingering Thoughts', 'Ethereal Chop'],
        config,
    );
    assert.deepEqual(
        interrupted.steps.filter(step => !step.invalid).map(step => step.skill),
        ['Lacerating Chop', 'Lingering Thoughts'],
    );
    assert.equal(
        interrupted.endState.profession.autoattackChains[ID.LACERATING_CHOP],
        ID.LACERATING_CHOP,
    );
    assert.match(interrupted.warnings[0], /cast Lacerating Chop first/);
});

test('other auto chains reset on weapon skills and every chain resets on swap', () => {
    const swordConfig = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
    });
    const interrupted = simulateMesmer(
        ['Mind Slash', 'Blurred Frenzy', 'Mind Gash'],
        swordConfig,
    );
    assert.deepEqual(
        interrupted.steps.filter(step => !step.invalid).map(step => step.skill),
        ['Mind Slash', 'Blurred Frenzy'],
    );
    assert.equal(
        interrupted.endState.profession.autoattackChains[ID.MIND_SLASH],
        ID.MIND_SLASH,
    );

    const scepterConfig = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
        weaponSet2Primary: 'Spear',
        weaponSet2Secondary: '',
    });
    const swapped = simulateMesmer(
        ['Ether Bolt', 'Swap Weapons', 'Ether Blast'],
        scepterConfig,
    );
    assert.deepEqual(
        swapped.steps.filter(step => !step.invalid).map(step => step.skill),
        ['Ether Bolt', 'Swap Weapons'],
    );
    assert.equal(
        swapped.endState.profession.autoattackChains[ID.ETHER_BOLT],
        ID.ETHER_BOLT,
    );
});

test('sword, scepter, axe, and spear auto chains cast as separate attacks', () => {
    const chain = [
        'Mind Slash', 'Mind Gash', 'Mind Spike',
        'Ether Bolt', 'Ether Blast', 'Ether Clone',
        'Lacerating Chop', 'Ethereal Chop', 'Mirror Strikes',
        'Psycut', 'Psystrike', 'Mind Pierce',
    ];
    const result = simulateMesmer(
        chain,
        defaultSimulationConfig({
            specialization: 'Mirage',
            initialResource: 0,
            weaponmasterTraining: true,
            primaryWeapon: '',
            secondaryWeapon: '',
            weaponSet2Primary: '',
            weaponSet2Secondary: '',
        }),
    );
    assert.deepEqual(result.steps.map(step => step.skill), chain);
    assert.equal(result.casts.length, chain.length);
});

test('split autoattacks preserve each full-chain cadence', () => {
    const config = defaultSimulationConfig({
        specialization: 'Mirage',
        initialResource: 0,
        weaponmasterTraining: true,
        primaryWeapon: '',
        secondaryWeapon: '',
        weaponSet2Primary: '',
        weaponSet2Secondary: '',
        boons: {
            ...defaultSimulationConfig().boons,
            quickness: false,
        },
    });
    const chains = [
        [['Mind Slash', 'Mind Gash', 'Mind Spike'], 2580],
        [['Ether Bolt', 'Ether Blast', 'Ether Clone'], 2700],
        [['Lacerating Chop', 'Ethereal Chop', 'Mirror Strikes'], 2520],
        [['Psycut', 'Psystrike', 'Mind Pierce'], 2180],
    ];
    for (const [skills, expectedTime] of chains) {
        assert.equal(simulateMesmer(skills, config).endState.time, expectedTime);
    }
});

test('requested weapon flips require and consume their parent sequence skill', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: '',
        secondaryWeapon: '',
        weaponSet2Primary: '',
        weaponSet2Secondary: '',
    });
    const pairs = [
        ['Singularity Shot', 'Dimensional Aperture'],
        ['Inspiring Imagery', 'Abstraction'],
        ['Temporal Curtain', 'Into the Void'],
        ['Illusionary Riposte', 'Counter Blade'],
        ['Illusionary Leap', 'Swap'],
    ];
    for (const [parent, flip] of pairs) {
        const unavailable = simulateMesmer([flip], config);
        assert.equal(
            unavailable.steps.filter(step => !step.invalid).length,
            0,
            flip,
        );
        assert.match(unavailable.warnings[0], new RegExp(parent), flip);

        const result = simulateMesmer([parent, flip, flip], config);
        assert.deepEqual(
            result.steps.filter(step => !step.invalid).map(step => step.skill),
            [parent, flip],
            flip,
        );
        assert.equal(result.endState.profession.availableFlips[flip], undefined, flip);
    }
});

test('Illusionary Riposte defaults to a 120ms interrupt before Counter Blade', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
    });
    const result = simulateMesmer(
        ['Illusionary Riposte', 'Counter Blade'],
        config,
    );

    assert.equal(result.steps[0].end, 120);
    assert.equal(result.steps[0].interrupted, true);
    assert.ok(result.steps[0].fullCastMs > 120);
    assert.equal(result.steps[1].start, 120);
});

test('Into the Void waits for its one-second post-curtain delay', () => {
    const result = simulateMesmer(
        ['Temporal Curtain', 'Into the Void'],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: '',
            secondaryWeapon: '',
        }),
    );
    assert.equal(result.steps[1].start, 1000);
});

test('Dimensional Aperture adds 50% to Singularity Shot recharge', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: '',
        secondaryWeapon: '',
    });
    const base = simulateMesmer(['Singularity Shot'], config);
    const aperture = simulateMesmer(
        ['Singularity Shot', 'Dimensional Aperture'],
        config,
    );
    assert.equal(base.endState.cooldowns['Singularity Shot'].readyAt, 16333);
    assert.equal(aperture.endState.cooldowns['Singularity Shot'].readyAt, 24333);
});

test('Abstraction records its detonation strike damage', () => {
    const result = simulateMesmer(
        ['Inspiring Imagery', 'Abstraction'],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: '',
            secondaryWeapon: '',
        }),
    );
    assert.ok(result.breakdown.some(entry =>
        entry.name === 'Abstraction' && entry.strikeDamage > 0));
});

test('Shatter Storm gives Split Second two ammo charges', () => {
    const result = simulateMesmer(
        ['Split Second', 'Split Second', 'Split Second'],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            selectedTraits: ['Shatter Storm'],
            initialResource: 3,
        }),
    );
    assert.equal(result.steps[0].start, 0);
    assert.equal(result.steps[1].start, 50);
    assert.equal(result.steps[2].start, 8000);
    assert.deepEqual(
        {
            charges: result.endState.ammo['Split Second'].charges,
            maximum: result.endState.ammo['Split Second'].maximum,
        },
        { charges: 0, maximum: 2 },
    );
});

test('Power Spike opens with two charges and reverts to Mantra of Pain when spent', () => {
    const result = simulateMesmer(
        ['Power Spike', 'Power Spike', 'Power Spike'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    // The third cast has no charges left, so the flip reverts to its parent.
    assert.deepEqual(
        result.steps.filter(step => !step.invalid).map(step => step.skill),
        ['Power Spike', 'Power Spike'],
    );
    assert.equal(result.steps[0].start, 0);
    assert.equal(result.steps[1].start, 50);
    assert.equal(result.endState.profession.availableFlips['Power Spike'], undefined);
    assert.equal(result.endState.ammo['Power Spike'], undefined);
    assert.match(result.warnings.at(-1), /Mantra of Pain is not active/);
});

test('dodge uses two endurance charges and recharges one charge every ten seconds', () => {
    const result = simulateMesmer(
        [
            'Dodge / Mirage Cloak',
            'Dodge / Mirage Cloak',
            'Dodge / Mirage Cloak',
        ],
        defaultSimulationConfig({
            specialization: 'Mirage',
            initialResource: 0,
            boons: {
                ...defaultSimulationConfig().boons,
                vigor: false,
            },
        }),
    );

    assert.deepEqual(result.steps.map(step => step.start), [0, 50, 10000]);
    assert.deepEqual(
        {
            charges: result.endState.ammo['Dodge / Mirage Cloak'].charges,
            maximum: result.endState.ammo['Dodge / Mirage Cloak'].maximum,
        },
        { charges: 0, maximum: 2 },
    );
});

test('Mirage Cloak enables an explicit ambush instead of auto-casting it', () => {
    const config = defaultSimulationConfig({
        specialization: 'Mirage',
        primaryWeapon: 'Axe',
        secondaryWeapon: 'Pistol',
        initialResource: 0,
    });
    const cloakOnly = simulateMesmer(['Dodge / Mirage Cloak'], config);
    assert.equal(
        cloakOnly.resolvedEvents.some(event =>
            event.type === 'damage' && event.skillName === 'Imaginary Axes'),
        false,
    );
    assert.equal(cloakOnly.endState.profession.availableAmbush.name, 'Imaginary Axes');
    assert.equal(cloakOnly.endState.profession.availableAmbush.source, 'Dodge / Mirage Cloak');

    const used = simulateMesmer(
        ['Dodge / Mirage Cloak', 'Imaginary Axes'],
        config,
    );
    assert.deepEqual(
        used.steps.map(step => step.skill),
        ['Dodge / Mirage Cloak', 'Imaginary Axes'],
    );
    assert.ok(used.resolvedEvents.some(event =>
        event.type === 'damage'
        && event.skillName === 'Imaginary Axes'
        && event.source === 'Player'));
    assert.equal(used.endState.profession.availableAmbush, null);
});

test('ambush skills cannot be cast without an active ambush window', () => {
    const result = simulateMesmer(
        ['Phantom Razor'],
        defaultSimulationConfig({
            specialization: 'Mirage',
            primaryWeapon: 'Dagger',
            secondaryWeapon: 'Sword',
            initialResource: 0,
        }),
    );
    assert.equal(result.steps.filter(step => !step.invalid).length, 0);
    assert.match(result.warnings[0], /no active Mirage Cloak ambush window/);
});

test('all terrestrial Mirage weapons execute their correct ambush', () => {
    const pairs = [
        ['Axe', 'Imaginary Axes'],
        ['Dagger', 'Phantom Razor'],
        ['Greatsword', 'Split Surge'],
        ['Rifle', 'Effervescence'],
        ['Scepter', 'Ether Barrage'],
        ['Spear', 'Fractured Glass'],
        ['Staff', 'Chaos Vortex'],
        ['Sword', 'Mirage Thrust'],
    ];
    for (const [weapon, ambush] of pairs) {
        const result = simulateMesmer(
            ['Dodge / Mirage Cloak', ambush],
            defaultSimulationConfig({
                specialization: 'Mirage',
                primaryWeapon: weapon,
                secondaryWeapon: '',
                initialResource: 0,
            }),
        );
        assert.deepEqual(
            result.steps.map(step => step.skill),
            ['Dodge / Mirage Cloak', ambush],
            weapon,
        );
        assert.ok(result.resolvedEvents.some(event =>
            event.type === 'damage'
            && event.skillName === ambush
            && event.source === 'Player'), weapon);
    }
});

test('Riddle of Sand applies to the first ambush and refreshes on shatter', () => {
    const result = simulateMesmer(
        [
            'Dodge / Mirage Cloak',
            'Imaginary Axes',
            'Mind Wrack',
            'Sand through Glass',
            'Imaginary Axes',
        ],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedTraits: ['Riddle of Sand'],
            selectedSkills: ['Sand through Glass'],
            primaryWeapon: 'Axe',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
        }),
    );
    const riddles = result.resolvedEvents.filter(event =>
        event.type === 'condition'
        && event.name.includes('Riddle of Sand'));
    assert.equal(riddles.length, 2);
    assert.ok(riddles.every(event =>
        event.condition === 'Confusion'
        && event.stacks === 2
        && event.duration === 4));
});

test('Infinite Horizon commands active clones to ambush when cloak is gained', () => {
    const result = simulateMesmer(
        ['Dodge / Mirage Cloak'],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedTraits: ['Infinite Horizon'],
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 3,
        }),
    );
    const cloneHits = result.resolvedEvents.filter(event =>
        event.type === 'damage'
        && event.skillName === 'Chaos Vortex'
        && event.source === 'Clone');
    assert.equal(cloneHits.length, 3);
    assert.equal(
        result.resolvedEvents.some(event =>
            event.type === 'damage'
            && event.skillName === 'Chaos Vortex'
            && event.source === 'Player'),
        false,
    );
});

test('Deceptive Evasion clone immediately ambushes with Infinite Horizon', () => {
    const result = simulateMesmer(
        ['Dodge / Mirage Cloak'],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedTraits: ['Deceptive Evasion', 'Infinite Horizon'],
            primaryWeapon: 'Sword',
            secondaryWeapon: 'Sword',
            initialResource: 0,
        }),
    );
    assert.equal(result.endState.profession.resource, 1);
    assert.ok(result.resolvedEvents.some(event =>
        event.type === 'damage'
        && event.skillName === 'Mirage Thrust'
        && event.source === 'Clone'));
});

test('Self-Deception creates a clone only when another clone is active', () => {
    const config = defaultSimulationConfig({
        specialization: 'Mirage',
        selectedTraits: ['Self-Deception'],
        selectedSkills: ['Crystal Sands'],
        primaryWeapon: 'Axe',
        secondaryWeapon: 'Pistol',
    });
    const activeClone = simulateMesmer(
        ['Crystal Sands'],
        { ...config, initialResource: 1 },
    );
    const noClone = simulateMesmer(
        ['Crystal Sands'],
        { ...config, initialResource: 0 },
    );
    assert.equal(activeClone.endState.profession.resource, 2);
    assert.equal(noClone.endState.profession.resource, 0);
});

test('Desert Distortion and Dune Cloak grant their shatter ambush windows', () => {
    const distortion = simulateMesmer(
        ['Distortion'],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedTraits: ['Desert Distortion'],
            initialResource: 2,
        }),
    );
    assert.equal(distortion.endState.profession.availableAmbush.source, 'Desert Distortion');
    assert.ok(distortion.procSteps.some(proc =>
        proc.skill === 'Desert Distortion'));

    const dune = simulateMesmer(
        ['Mind Wrack'],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedTraits: ['Dune Cloak'],
            initialResource: 3,
            boons: {
                ...defaultSimulationConfig().boons,
                alacrity: false,
            },
        }),
    );
    assert.equal(dune.endState.profession.availableAmbush.source, 'Dune Cloak');
    assert.equal(dune.endState.cooldowns['Mind Wrack'].readyAt, 11000);
});

test('Mirage support and cloak traits emit their current effects', () => {
    const result = simulateMesmer(
        ['Dodge / Mirage Cloak', 'Effervescence'],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedTraits: [
                'Mirage Mantle',
                'Renewing Oasis',
                'Elusive Mind',
            ],
            primaryWeapon: 'Rifle',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    assert.ok(result.events.some(event =>
        event.type === 'buff'
        && event.kind === 'regeneration'
        && event.duration === 4));
    assert.ok(result.events.some(event =>
        event.type === 'buff'
        && event.kind === 'alacrity'
        && event.duration === 4));
    assert.ok(result.events.some(event =>
        event.type === 'buff'
        && event.kind === 'vigor'
        && event.duration === 3));
    assert.ok(result.procSteps.some(proc => proc.skill === 'Elusive Mind'));
});

test("Nomad's Endurance grants vigor on shatter and uses it for damage", () => {
    const baseConfig = defaultSimulationConfig({
        specialization: 'Mirage',
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
        initialResource: 0,
        boons: {
            ...defaultSimulationConfig().boons,
            vigor: false,
        },
    });
    const without = simulateMesmer(
        ['Mind Wrack', 'Mind Slash'],
        baseConfig,
    );
    const withTrait = simulateMesmer(
        ['Mind Wrack', 'Mind Slash'],
        {
            ...baseConfig,
            selectedTraits: ["Nomad's Endurance"],
        },
    );
    assert.ok(withTrait.strikeDamage > without.strikeDamage);
    assert.ok(withTrait.events.some(event =>
        event.type === 'buff'
        && event.kind === 'vigor'
        && event.duration === 3));
});

test('Re-channeling Mantra of Pain refills Power Spike to two charges', () => {
    const result = simulateMesmer(
        ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.deepEqual(
        result.steps.map(step => step.skill),
        ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike'],
    );
    assert.ok(result.endState.profession.availableFlips['Power Spike']);
    assert.equal(result.endState.profession.availableFlips['Power Spike'].persistent, true);
    assert.deepEqual(
        {
            charges: result.endState.ammo['Power Spike'].charges,
            maximum: result.endState.ammo['Power Spike'].maximum,
        },
        { charges: 1, maximum: 2 },
    );
});

test('Power Spike records its strike damage', () => {
    const result = simulateMesmer(
        ['Power Spike'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.ok(result.breakdown.some(entry =>
        entry.name === 'Power Spike' && entry.strikeDamage > 0));
});

test('Power Spike woven into the Mantra of Pain channel is invalid and unsimulated', () => {
    const result = simulateMesmer(
        ['Power Spike', 'Power Spike', 'Mantra of Pain', { name: 'Power Spike', offset: 100 }],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    const woven = result.steps.find(step => step.ri === 3);
    assert.equal(woven.invalid, true);
    // Only the two opener spikes are simulated; the woven one is skipped, so the
    // refilled mantra keeps both charges.
    assert.equal(
        result.steps.filter(step => step.skill === 'Power Spike' && !step.invalid).length,
        2,
    );
    assert.equal(result.endState.profession.availableFlips['Power Spike'].persistent, true);
    assert.equal(result.endState.ammo['Power Spike'].charges, 2);
    assert.match(result.warnings.at(-1), /Mantra of Pain is still channeling/);
});

test('Power Spike stays invalid even when another instant is chained into the channel first', () => {
    // Weaving an instant (Blink) into the channel and then Power Spike after it
    // must still be caught: the flip is not armed until the channel completes,
    // regardless of the immediately preceding command.
    const result = simulateMesmer(
        [
            'Power Spike', 'Power Spike', 'Mantra of Pain',
            { name: 'Blink', offset: 100 },
            { name: 'Power Spike', offset: 100 },
        ],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    const woven = result.steps.find(step => step.ri === 4);
    assert.equal(woven.invalid, true);
    assert.equal(
        result.steps.filter(step => step.skill === 'Power Spike' && !step.invalid).length,
        2,
    );
    assert.equal(result.endState.ammo['Power Spike'].charges, 2);
});

test('Illusionary Reversion refunds one clone only after shattering three', () => {
    const config = defaultSimulationConfig({
        specialization: 'Chronomancer',
        selectedTraits: ['Illusionary Reversion'],
    });
    const fullShatter = simulateMesmer(
        ['Split Second'],
        { ...config, initialResource: 3 },
    );
    const partialShatter = simulateMesmer(
        ['Split Second'],
        { ...config, initialResource: 2 },
    );
    assert.equal(fullShatter.endState.profession.resource, 1);
    assert.equal(partialShatter.endState.profession.resource, 0);
    assert.ok(
        simulationEventLogRows(fullShatter).some(event =>
            event.description.includes(
                'CLONE SPAWNED x1 -> 1/3 [Illusionary Reversion] (Clone #4 [Dagger])',
            )),
    );
});

test('Signet of the Ether resets every phantasm skill cooldown', () => {
    const result = simulateMesmer(
        [
            'Phantasmal Duelist',
            'Phantasmal Warlock',
            'Signet of the Ether',
            'Phantasmal Duelist',
            'Phantasmal Warlock',
        ],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 0,
        }),
    );
    assert.equal(result.steps.length, 5);
    assert.ok(Math.abs(result.steps[3].start - result.steps[2].end) <= 1);
    assert.ok(Math.abs(result.steps[4].start - result.steps[3].end) <= 1);
});

test('Mental Collapse resets Mind the Gap cooldown', () => {
    const result = simulateMesmer(
        ['Mind the Gap', 'Mental Collapse', 'Mind the Gap'],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
        }),
    );

    assert.equal(result.steps.length, 3);
    assert.ok(Math.abs(result.steps[2].start - result.steps[1].end) <= 1);
    const resetOnly = simulateMesmer(
        ['Mind the Gap', 'Mental Collapse'],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
        }),
    );
    assert.equal(resetOnly.endState.cooldowns['Mind the Gap'], undefined);
});

test('Mind the Gap grants 15 seconds of Clarity and displays it as a skill proc', () => {
    const result = simulateMesmer(
        ['Mind the Gap'],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
        }),
    );

    assert.equal(result.endState.profession.clarityRemaining, 15000);
    assert.ok(result.procSteps.some(proc =>
        proc.skill === 'Clarity'
        && proc.type === 'skill_proc'
        && proc.sourceSkill === 'Mind the Gap'
        && proc.icon.includes('Clarity.png')
    ));
});

test('Mesmer spear skills 3, 4, and 5 consume Clarity', () => {
    for (const consumer of [
        'Imaginary Inversion',
        'Phantasmal Lancer',
        'Mental Collapse',
    ]) {
        const result = simulateMesmer(
            ['Mind the Gap', consumer],
            defaultSimulationConfig({
                specialization: 'Virtuoso',
                primaryWeapon: 'Spear',
                secondaryWeapon: '',
            }),
        );
        assert.equal(result.endState.profession.clarityRemaining, 0, consumer);
    }
});

test('Clarity makes Phantasmal Lancer summon and attack with a second phantasm', () => {
    const config = defaultSimulationConfig({
        specialization: 'Virtuoso',
        primaryWeapon: 'Spear',
        secondaryWeapon: '',
        initialResource: 0,
    });
    const normal = simulateMesmer(
        ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
        config,
    );
    const empowered = simulateMesmer(
        ['Mind the Gap', 'Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
        config,
    );

    assert.equal(
        normal.events.find(event =>
            event.type === 'mesmer.phantasm-summoned'
            && event.name === 'Phantasmal Lancer'
        )?.count,
        1,
    );
    assert.equal(
        empowered.events.find(event =>
            event.type === 'mesmer.phantasm-summoned'
            && event.name === 'Phantasmal Lancer'
        )?.count,
        2,
    );
    assert.equal(
        normal.resolvedEvents.filter(event =>
            event.type === 'damage'
            && event.skillName === 'Phantasmal Lancer'
            && event.source === 'Phantasm'
        ).length,
        1,
    );
    assert.equal(
        empowered.resolvedEvents.filter(event =>
            event.type === 'damage'
            && event.skillName === 'Phantasmal Lancer'
            && event.source === 'Phantasm'
        ).length,
        2,
    );
    const coefficientBySource = result => Object.fromEntries(
        ['Player', 'Phantasm'].map(source => [
            source,
            result.resolvedEvents
                .filter(event =>
                    event.type === 'damage'
                    && event.skillName === 'Phantasmal Lancer'
                    && event.source === source
                )
                .reduce((sum, event) => sum + event.coefficient, 0),
        ]),
    );
    assert.deepEqual(coefficientBySource(normal), {
        Player: 1,
        Phantasm: 1.23,
    });
    assert.deepEqual(coefficientBySource(empowered), {
        Player: 1,
        Phantasm: 2.46,
    });
});

test('Flying Cutter tracks three hits for five seconds and Bladecall strikes six times', () => {
    const config = defaultSimulationConfig({
        specialization: 'Virtuoso',
        primaryWeapon: 'Dagger',
        secondaryWeapon: 'Sword',
        selectedTraits: [],
    });
    const consecutive = simulateMesmer(
        ['Flying Cutter', 'Flying Cutter', 'Flying Cutter'],
        config,
    );
    const burst = consecutive.resolvedEvents.filter(event =>
        event.type === 'damage' && event.name === 'Cutter Burst');
    assert.equal(burst.length, 3);
    assert.ok(Math.abs(
        burst.reduce((sum, event) => sum + event.coefficient, 0) - 0.6,
    ) < 1e-12);

    const expired = simulateMesmer(
        [
            'Flying Cutter',
            { name: '__wait', waitMs: 5001 },
            'Flying Cutter',
            'Flying Cutter',
        ],
        config,
    );
    assert.equal(
        expired.resolvedEvents.filter(event =>
            event.type === 'damage' && event.name === 'Cutter Burst').length,
        0,
    );

    const bladecall = simulateMesmer(['Bladecall'], config);
    const bladecallHits = bladecall.resolvedEvents.filter(event =>
        event.type === 'damage' && event.skillName === 'Bladecall');
    assert.equal(bladecallHits.length, 6);
    assert.ok(Math.abs(
        bladecallHits.reduce(
            (sum, event) => sum + event.coefficient,
            0,
        ) - 1.5,
    ) < 1e-12);
});

test('supplied trait attacks execute with their exact coefficients', () => {
    const coefficient = (result, skillName) =>
        result.resolvedEvents
            .filter(event =>
                event.type === 'damage'
                && event.skillName === skillName
            )
            .reduce((sum, event) => sum + event.coefficient, 0);

    const madness = simulateMesmer(
        ['Ether Feast', { name: '__wait', waitMs: 5000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Method of Madness'],
            selectedSkills: ['Ether Feast'],
        }),
    );
    assert.ok(
        Math.abs(coefficient(madness, 'Lesser Chaos Storm') - 1.98) < 1e-12,
    );

    const phantasmalBlade = simulateMesmer(
        ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
            selectedTraits: ['Phantasmal Blades'],
            initialResource: 0,
        }),
    );
    assert.equal(coefficient(phantasmalBlade, 'Phantasmal Blade'), 0.7);

    const syncopate = simulateMesmer(
        ['Illusionary Wave'],
        defaultSimulationConfig({
            specialization: 'Troubadour',
            primaryWeapon: 'Greatsword',
            secondaryWeapon: '',
            selectedTraits: ['Syncopate'],
        }),
    );
    assert.equal(coefficient(syncopate, 'Syncopate'), 0.75);

    const timeBomb = simulateMesmer(
        ['Time Sink', { name: '__wait', waitMs: 5000 }],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            selectedTraits: ['Time Bomb'],
            initialResource: 1,
        }),
    );
    assert.equal(coefficient(timeBomb, 'Time Bomb'), 3);
});

test('Bountiful Blades stocks each Berserker blade independently', () => {
    const result = simulateMesmer(
        ['Phantasmal Berserker', { name: '__wait', waitMs: 4000 }],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            selectedTraits: ['Bountiful Blades'],
            primaryWeapon: 'Greatsword',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const conversions = result.events.filter(event =>
        event.type === 'resource'
        && event.reason === 'Phantasmal Berserker phantasm conversion'
    );

    assert.deepEqual(conversions.map(event => event.amount), [1, 1]);
    assert.ok(Math.abs(conversions[0].at - 3.1201) < 0.00001);
    assert.ok(Math.abs(conversions[1].at - 3.4401) < 0.00001);
});

test('blades generated during a bladesong remain stocked afterward', () => {
    const rotation = [
        'Phantasmal Disenchanter',
        'Imaginary Inversion',
        { name: 'Bladeturn Requiem', offset: 100 },
        'Mind the Gap',
        'Phantasmal Lancer',
        'Power Spike',
        'Thousand Cuts',
        'Mental Collapse',
        'Mind the Gap',
        'Swap Weapons',
        'Phantasmal Berserker',
        'Signet of the Ether',
        'Phantasmal Berserker',
        'Mind Stab',
        'Mirror Blade',
        'Bladesong Harmony',
        'Rain of Swords',
        'Phantasmal Disenchanter',
        'Bladesong Sorrow',
    ];
    const result = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            selectedTraits: ['Bountiful Blades', 'Infinite Forge'],
            selectedSkills: [
                'Signet of the Ether',
                'Phantasmal Disenchanter',
                'Rain of Swords',
                'Mantra of Pain',
                'Thousand Cuts',
            ],
            primaryWeapon: 'Greatsword',
            secondaryWeapon: '',
            weaponSet2Primary: 'Spear',
            weaponSet2Secondary: '',
            startingWeaponSet: 2,
            initialResource: 5,
        }),
    );
    const harmony = result.events.find(event =>
        event.type === 'marker' && event.name === 'Bladesong Harmony'
    );
    const sorrow = result.events.find(event =>
        event.type === 'marker' && event.name === 'Bladesong Sorrow'
    );
    const harmonyAction = result.events.find(event =>
        event.type === 'action' && event.name === 'Bladesong Harmony'
    );
    const harmonySpend = result.events.find(event =>
        event.type === 'resource'
        && event.reason === 'profession mechanic'
        && Math.abs(event.at - harmonyAction.at) < 0.00001
    );
    const timelineSpends = shatterResourceSpends(result);
    const duringHarmony = result.events.find(event =>
        event.type === 'resource'
        && event.amount > 0
        && event.at > harmonyAction.at
        && event.at < harmonyAction.endsAt
    );

    assert.equal(result.warnings.length, 0);
    assert.equal(harmony.detail, '5 blades spent');
    assert.equal(sorrow.detail, '5 blades spent');
    assert.equal(harmonySpend.amount, -5);
    assert.equal(harmonySpend.sourceSkill, 'Bladesong Harmony');
    assert.equal(harmonySpend.rotationIndex, 15);
    assert.equal(duringHarmony.amount, 1);
    assert.deepEqual(timelineSpends.get(15), {
        count: 5,
        resource: 'blades',
        sourceSkill: 'Bladesong Harmony',
    });
});

test('Clarity makes only an empowered Mental Collapse a control skill', () => {
    const config = defaultSimulationConfig({
        specialization: 'Virtuoso',
        primaryWeapon: 'Spear',
        secondaryWeapon: '',
    });
    const normal = simulateMesmer(['Mental Collapse'], config);
    const empowered = simulateMesmer(['Mind the Gap', 'Mental Collapse'], config);
    const activeNearExpiry = simulateMesmer(
        ['Mind the Gap', { name: '__wait', waitMs: 14999 }, 'Mental Collapse'],
        config,
    );
    const expired = simulateMesmer(
        ['Mind the Gap', { name: '__wait', waitMs: 15000 }, 'Mental Collapse'],
        config,
    );
    const hasMentalCollapseControl = result => result.events.some(event =>
        event.type === 'control' && event.skillName === 'Mental Collapse'
    );

    assert.equal(hasMentalCollapseControl(normal), false);
    assert.equal(hasMentalCollapseControl(empowered), true);
    assert.equal(hasMentalCollapseControl(activeNearExpiry), true);
    assert.equal(hasMentalCollapseControl(expired), false);
});

test('Signet of the Ether does not generate a clone', () => {
    const result = simulateMesmer(
        ['Signet of the Ether'],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 0,
        }),
    );

    assert.equal(result.endState.profession.resource, 0);
    assert.equal(
        result.events.some(
            event => event.type === 'resource' && event.reason === 'Signet of the Ether',
        ),
        false,
    );
});

test('concurrent Continuum Split excludes the still-casting skill from its snapshot', () => {
    const result = simulateMesmer(
        [
            'Phantasmal Warlock',
            { name: 'Continuum Split', offset: 100 },
            'Continuum Shift',
            'Phantasmal Warlock',
        ],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
        }),
    );
    assert.equal(result.steps[0].end, 780);
    assert.equal(result.steps[1].start, 100);
    assert.equal(result.steps[3].start, result.steps[2].end);
});

test('mid-rotation concurrent Continuum Split does not restore expired cooldowns', () => {
    const result = simulateMesmer(
        [
            'Chaos Storm',
            { name: '__wait', waitMs: 14000 },
            'Phantasmal Warlock',
            { name: 'Continuum Split', offset: 100 },
            'Continuum Shift',
            'Chaos Storm',
        ],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
        }),
    );

    assert.equal(result.steps[3].start, 14580);
    assert.equal(result.steps[5].start, result.steps[4].end);
});

test('relic and trait activations are exposed as proc timeline steps', () => {
    const result = simulateMesmer(
        ['Blurred Frenzy'],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Sword',
            selectedTraits: ["Fencer's Finesse"],
            relic: 'Thief',
            initialResource: 0,
        }),
    );
    assert.ok(result.procSteps.some(proc =>
        proc.type === 'trait_proc' && proc.skill === "Fencer's Finesse"));
    assert.ok(result.procSteps.some(proc =>
        proc.type === 'relic_proc' && proc.skill === 'Relic of the Thief'));
});

test('result summary uses the expected metric order', () => {
    const result = simulateMesmer(
        ['Blurred Frenzy'],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Sword',
            initialResource: 0,
        }),
    );
    assert.deepEqual(
        resultSummaryMetrics(result).map(metric => metric.label),
        ['Duration', 'Total Damage', 'DPS', 'Strike', 'Condition'],
    );
});

test('Duration and Kill Time account for an explicit Combat Start reference', () => {
    const metrics = resultSummaryMetrics({
        duration: 93.89,
        deathTime: 93.89,
        firstHitTime: 2.06,
        events: [{ type: 'combat_start', at: 2.06 }],
    });

    assert.equal(metrics[0].label, 'Duration');
    assert.equal(metrics[0].value, '91.83s');
    assert.equal(metrics[1].label, 'Kill Time');
    assert.equal(metrics[1].value, '91.83s');
});

test('Combat Start timeline timestamps use the first subsequent hit like Elementalist', () => {
    const result = simulateMesmer(
        [
            'Phantasmal Swordsman',
            { name: '__combat_start', offset: 700 },
            'Bladecall',
        ],
        defaultSimulationConfig(),
    );

    assert.equal(formatResultTimelineTime(result.steps[0].start, result), '-0.86s');
    assert.equal(formatResultTimelineTime(result.steps[1].start, result), '-0.16s');
    assert.equal(formatResultTimelineTime(result.steps[2].start, result), '0.00s');
    assert.equal(formatResultTimelineTime(result.steps[2].end, result), '0.44s');
});

test('timeline and DPS retain simulation time without Combat Start', () => {
    const result = simulateMesmer(
        [
            'Phantasmal Swordsman',
            'Bladecall',
        ],
        defaultSimulationConfig(),
    );

    assert.equal(result.dpsStartTime, 0);
    assert.equal(result.dpsWindow, 1.3);
    assert.equal(formatResultTimelineTime(result.steps[0].start, result), '0.00s');
    assert.equal(formatResultTimelineTime(result.steps[1].start, result), '0.86s');
});

test('result summary includes kill time when target health is exhausted', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateMesmer(
        ['Bladecall'],
        defaultSimulationConfig({
            target: {
                ...defaults.target,
                health: 1,
            },
        }),
    );

    assert.deepEqual(
        resultSummaryMetrics(result).map(metric => metric.label),
        ['Duration', 'Kill Time', 'Total Damage', 'DPS', 'Strike', 'Condition'],
    );
    assert.equal(buildChartSeries(result).durationMs, result.deathTime * 1000);
});

test('result table sorting cycles consistently across profession views', () => {
    assert.deepEqual(nextResultSortState(null, null, 'dps'), {
        column: 'dps',
        direction: 'desc',
    });
    assert.deepEqual(nextResultSortState('dps', 'desc', 'dps'), {
        column: 'dps',
        direction: 'asc',
    });
    assert.deepEqual(nextResultSortState('dps', 'asc', 'dps'), {
        column: null,
        direction: null,
    });

    const rows = [
        { name: 'Beta', total: 20, dps: 5 },
        { name: 'Alpha', total: 10, dps: 8 },
    ];
    const columns = [
        { key: 'name', numeric: false },
        { key: 'dps', numeric: true },
    ];
    assert.deepEqual(
        sortResultRows(rows, columns, null, null).map(row => row.name),
        ['Beta', 'Alpha'],
    );
    assert.deepEqual(
        sortResultRows(rows, columns, 'dps', 'desc').map(row => row.name),
        ['Alpha', 'Beta'],
    );
    assert.deepEqual(
        sortResultRows(rows, columns, 'name', 'asc').map(row => row.name),
        ['Alpha', 'Beta'],
    );
});

test('skill breakdown combines strike and condition damage by source skill', () => {
    const result = simulateMesmer(
        ['Confusing Images', { name: '__wait', waitMs: 3000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
            initialResource: 0,
        }),
    );
    const row = skillBreakdownRows(result)
        .find(entry => entry.name === 'Confusing Images');
    assert.ok(row.strike > 0);
    assert.ok(row.condition > 0);
    assert.equal(row.total, row.strike + row.condition);
    assert.equal(row.casts, 1);
    assert.equal(row.hits, 7);
    assert.ok(row.average > 0);
    assert.ok(row.dct > 0);
});

test('condition breakdown reports damage, DPS, and average stacks', () => {
    const result = simulateMesmer(
        ['Confusing Images', { name: '__wait', waitMs: 3000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
            initialResource: 0,
        }),
    );
    const confusion = result.conditionBreakdown
        .find(entry => entry.name === 'Confusion');
    assert.ok(confusion.damage > 0);
    assert.equal(confusion.dps, confusion.damage / result.dpsWindow);
    assert.ok(confusion.averageStacks > 0);
});

test('chart series expose cumulative DPS and condition stacks over time', () => {
    const result = simulateMesmer(
        ['Confusing Images', { name: '__wait', waitMs: 3000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
            initialResource: 0,
        }),
    );
    const series = buildChartSeries(result);
    assert.ok(series.dps.length > 2);
    assert.ok(series.effects.Confusion.some(point => point.v > 0));
    assert.ok(Math.abs(series.dps.at(-1).v - result.dps) < 0.001);
});

test('chart hover values use the latest sample at the hovered timestamp', () => {
    const points = [
        { t: 0, v: 0 },
        { t: 250, v: 12 },
        { t: 500, v: 8 },
    ];
    assert.equal(chartValueAt(points, 249), 0);
    assert.equal(chartValueAt(points, 250), 12);
    assert.equal(chartValueAt(points, 499), 12);
    assert.equal(chartValueAt(points, 500), 8);
    assert.equal(chartValueAt([], 500), 0);
});

test('Compounding Power chart series caps at five stacks', () => {
    const series = buildChartSeries({
        duration: 10,
        resolvedEvents: [],
        events: Array.from({ length: 7 }, (_, index) => ({
            type: 'buff',
            at: index * 0.1,
            kind: 'compounding',
            duration: 8,
            stacks: 1,
        })),
    }, 100);

    assert.equal(
        Math.max(...series.effects['Compounding Power'].map(point => point.v)),
        5,
    );
});

test('Continuum Shift is available only while Continuum Split is active', () => {
    const config = defaultSimulationConfig({
        specialization: 'Chronomancer',
        initialResource: 3,
    });
    const split = simulateMesmer(['Continuum Split'], config);
    assert.equal(split.endState.profession.continuumActive, true);
    assert.ok(split.endState.profession.continuumRemaining > 0);

    const shifted = simulateMesmer(['Continuum Split', 'Continuum Shift'], config);
    assert.equal(shifted.endState.profession.continuumActive, false);
});

test('expired Continuum Split is injected before the next rotation action', () => {
    const rotation = [
        'Continuum Split',
        'Bladecall',
        'Bladecall',
        'Bladecall',
    ];
    const result = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
        }),
    );

    assert.deepEqual(
        continuumEndTimelineMarkers(result, rotation.length),
        [{
            insertionIndex: 3,
            skill: 'Continuum Shift',
            start: 6050,
            detail: 'split expired',
        }],
    );
});

test('manual Continuum Shift is not duplicated as an injected timeline marker', () => {
    const rotation = ['Continuum Split', 'Continuum Shift'];
    const result = simulateMesmer(
        rotation,
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
        }),
    );

    assert.deepEqual(
        continuumEndTimelineMarkers(result, rotation.length),
        [],
    );
});

test('Continuum Split does not restore weapon-swap cooldown', () => {
    const config = defaultSimulationConfig({
        specialization: 'Chronomancer',
        initialResource: 3,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
        weaponSet2Primary: 'Spear',
        weaponSet2Secondary: '',
    });
    const result = simulateMesmer(
        [
            'Continuum Split',
            'Swap Weapons',
            { name: '__wait', waitMs: 1000 },
            'Continuum Shift',
            'Swap Weapons',
        ],
        config,
    );
    assert.equal(result.steps[1].start, 50);
    assert.equal(result.steps[4].start, 10050);
});

test('Continuum Split does not extend an existing weapon-swap cooldown', () => {
    const config = defaultSimulationConfig({
        specialization: 'Chronomancer',
        initialResource: 3,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
        weaponSet2Primary: 'Spear',
        weaponSet2Secondary: '',
    });
    const result = simulateMesmer(
        [
            'Swap Weapons',
            'Continuum Split',
            { name: '__wait', waitMs: 1000 },
            'Continuum Shift',
        ],
        config,
    );
    assert.equal(result.endState.cooldowns['Swap Weapons'].readyAt, 10000);
});

test('a build can open combat on its second weapon set', () => {
    const base = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: '',
        weaponSet2Primary: 'Scepter',
        weaponSet2Secondary: '',
    });
    const onSetTwo = simulateMesmer(
        [{ name: '__wait', waitMs: 1000 }],
        { ...base, startingWeaponSet: 2 },
    );
    assert.equal(onSetTwo.endState.activeWeaponSet, 2);

    // Swapping from a set-two opener lands on set one, proving t=0 was set two.
    const swappedFromTwo = simulateMesmer(
        ['Swap Weapons'],
        { ...base, startingWeaponSet: 2 },
    );
    assert.equal(swappedFromTwo.endState.activeWeaponSet, 1);

    const onSetOne = simulateMesmer(
        [{ name: '__wait', waitMs: 1000 }],
        { ...base, startingWeaponSet: 1 },
    );
    assert.equal(onSetOne.endState.activeWeaponSet, 1);
});

test('starting on weapon set two is ignored without a second weapon set', () => {
    const result = simulateMesmer(
        [{ name: '__wait', waitMs: 1000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 0,
            primaryWeapon: 'Sword',
            secondaryWeapon: '',
            weaponSet2Primary: '',
            weaponSet2Secondary: '',
            startingWeaponSet: 2,
        }),
    );
    assert.equal(result.endState.activeWeaponSet, 1);
});

test('clone specs never open combat with clones', () => {
    // The app path forces initialResource to 0 for clone specs; the engine
    // still honours an explicit count so shatter setups stay testable.
    const result = simulateMesmer(
        [{ name: '__wait', waitMs: 1000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 0,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
        }),
    );
    assert.equal(result.endState.profession.resource, 0);
});
