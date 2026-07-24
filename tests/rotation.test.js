import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../js/fixtures/fixture-harness-core.js';
import { simulateSequence } from '../js/sim/sim-engine.js';
import {
    buildChartSeries,
    chartValueAt,
    moveRotationEntry,
    resultSummaryMetrics,
    simulationEventLogCsv,
    simulationEventLogRows,
    skillBreakdownRows,
    timelineWeaponRows,
} from '../js/app/app-rotation-ui.js';

test('queueing a cooling-down icon waits until it is available', () => {
    const result = simulateSequence(['Bladecall', 'Bladecall'], defaultSimulationConfig());
    assert.equal(result.steps[0].start, 0);
    assert.equal(result.steps[1].start, 4000);
    assert.equal(result.endState.cooldowns.Bladecall.readyAt, 8000);
    assert.equal(result.endState.cooldowns.Bladecall.remaining, 3559);
});

test('Time Marches On makes alacrity recharge Chronomancer skills 50% faster', () => {
    const result = simulateSequence(
        ['Rewinder', 'Rewinder'],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
        }),
    );

    // Rewinder has a 30-second base recharge. Chronomancer alacrity reduces
    // that to 20 seconds, then the mesmer and three clones refund 12 seconds.
    assert.equal(result.steps[1].start, 8000);
});

test('alacrity gives non-Chronomancers 25% recharge speed', () => {
    const result = simulateSequence(
        ['Bladecall', 'Bladecall'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.equal(result.steps[1].start, 4000);
});

test('Virtuoso alacrity recharges Imaginary Inversion in eight seconds', () => {
    const result = simulateSequence(
        ['Imaginary Inversion', 'Imaginary Inversion'],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
        }),
    );
    assert.equal(result.steps[1].start, 8000);
});

test('Master of Misdirection reduces shatter cooldowns by 15%', () => {
    const result = simulateSequence(
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

test('Flow of Time increases clone critical chance while alacrity is active', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
        ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: ['Phantasmal Fury'],
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
    const result = simulateSequence(
        ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            selectedTraits: [],
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
    const result = simulateSequence(
        ['Bladecall', { name: 'Bladesong Distortion', offset: 100 }],
        defaultSimulationConfig(),
    );
    assert.equal(result.steps[1].start, 100);
    assert.equal(result.steps[1].end, 150);
    assert.equal(result.endState.time, 440);
    assert.equal(result.endState.cooldowns['Bladesong Distortion'].readyAt, 33433);
});

test('interrupt commands end casts and remove later hit events', () => {
    const full = simulateSequence(['Confusing Images'], defaultSimulationConfig());
    const interrupted = simulateSequence(
        [{ name: 'Confusing Images', interruptMs: 250 }],
        defaultSimulationConfig(),
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
    const full = simulateSequence(['Confusing Images'], config);
    const interrupted = simulateSequence(
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

test('Confusing Images starts its cooldown after its channel ends', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        secondaryWeapon: '',
        initialResource: 0,
    });
    const full = simulateSequence(
        ['Confusing Images', 'Confusing Images'],
        config,
    );
    const interrupted = simulateSequence(
        [{ name: 'Confusing Images', interruptMs: 250 }],
        config,
    );

    assert.equal(full.steps[0].end, 1850);
    assert.equal(full.steps[1].start, 7850);
    assert.equal(interrupted.endState.cooldowns['Confusing Images'].readyAt, 6250);
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
    const normal = simulateSequence(
        rotation,
        defaultSimulationConfig({
            ...baseConfig,
            specialization: 'Core',
            selectedTraits: [],
        }),
    );
    const chronophantasma = simulateSequence(
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
    assert.equal(normalTorment.stacks, 12);
    assert.equal(normalTorment.source, 'Phantasm');
    assert.deepEqual(
        {
            coefficient: repeatedDamage.reduce((sum, event) => sum + event.coefficient, 0),
            hits: repeatedDamage.reduce((sum, event) => sum + event.hits, 0),
        },
        { coefficient: 0.9, hits: 6 },
    );
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
    const plain = simulateSequence(
        rotation,
        defaultSimulationConfig(base),
    );
    const withSigils = simulateSequence(
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
    const result = simulateSequence(
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

test('Winds of Chaos uses its measured 760ms Quickness cast time', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const counterspell = simulateSequence(
        ['Illusionary Counter', 'Counterspell'],
        defaultSimulationConfig({
            ...coreConfig,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
        }),
    );
    assert.equal(counterspell.steps[1].end - counterspell.steps[1].start, 600);

    const signet = simulateSequence(
        ['Signet of the Ether'],
        defaultSimulationConfig(coreConfig),
    );
    assert.equal(signet.steps[0].end - signet.steps[0].start, 920);

    const chaosStorm = simulateSequence(
        ['Chaos Storm'],
        defaultSimulationConfig({
            ...coreConfig,
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
        }),
    );
    assert.equal(chaosStorm.steps[0].end - chaosStorm.steps[0].start, 480);

    const scepterChain = simulateSequence(
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

    const confusingImages = simulateSequence(
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

    const pistolSkills = simulateSequence(
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
    const normal = simulateSequence(
        rotation,
        defaultSimulationConfig({
            ...baseConfig,
            specialization: 'Core',
            selectedTraits: [],
        }),
    );
    const chronophantasma = simulateSequence(
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
        event => event.type === 'phantasm_resummoned'
            && event.name === 'Phantasmal Duelist',
    );
    const repeat = chronophantasma.events.find(
        event => event.type === 'phantasm_attack'
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
    const axe = simulateSequence(
        ['Mirror Images', { name: '__wait', waitMs: 3000 }],
        defaultSimulationConfig({
            specialization: 'Mirage',
            selectedSkills: ['Mirror Images'],
            primaryWeapon: 'Axe',
            secondaryWeapon: 'Pistol',
            initialResource: 0,
        }),
    );
    const axeConditions = axe.resolvedEvents.filter(event =>
        event.type === 'condition' && event.skillName === 'Axe Clone');
    assert.ok(axeConditions.some(event =>
        event.condition === 'Bleeding' && event.duration === 6));
    assert.ok(axeConditions.some(event =>
        event.condition === 'Torment' && event.duration === 6));

    const staff = simulateSequence(
        ['Phase Retreat', { name: '__wait', waitMs: 2500 }],
        defaultSimulationConfig({
            specialization: 'Core',
            primaryWeapon: 'Staff',
            secondaryWeapon: '',
            initialResource: 0,
        }),
    );
    const staffConditions = staff.resolvedEvents.filter(event =>
        event.type === 'condition' && event.skillName === 'Staff Clone');
    assert.equal(staffConditions.length, 2);
    assert.ok(staffConditions.some(event =>
        event.condition === 'Torment' && event.duration === 2));
    assert.ok(staffConditions.some(event =>
        event.condition === 'Confusion' && event.duration === 2));
    const staffHits = staff.resolvedEvents.filter(event =>
        event.type === 'damage' && event.skillName === 'Staff Clone');
    assert.equal(
        staffHits.reduce((sum, event) => sum + event.hits, 0),
        2,
    );

    const scepter = simulateSequence(
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
        && event.skillName === 'Scepter Clone'
        && event.condition === 'Torment');
    assert.equal(scepterTorment.length, 2);
    assert.ok(scepterTorment.every(event => event.duration === 4));
});

test('destroyed clones do not apply prescheduled autoattack conditions', () => {
    const result = simulateSequence(
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
            event.type === 'condition' && event.skillName === 'Staff Clone'),
        false,
    );
});

test('Ineptitude applies confusion for each direct blind on a normal target', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const idle = simulateSequence(
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
    const active = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const resultAt = confusionActivationsPerSecond => simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
        ['Bladesong Harmony'],
        defaultSimulationConfig({ initialResource: 5 }),
    );
    assert.equal(result.endState.resource, 0);
});

test('sigil and relic damage modifiers affect the queued rotation result', () => {
    const config = defaultSimulationConfig();
    const base = simulateSequence(
        ['Bladecall', 'Unstable Bladestorm'],
        { ...config, relic: '', modifiers: { strike: 1, condition: 1 } },
    );
    const equipped = simulateSequence(
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
    const base = simulateSequence(rotation, config);
    const equipped = simulateSequence(rotation, {
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
    const result = simulateSequence(
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
    const base = simulateSequence(
        ['Bladesong Dissonance', 'Bladecall'],
        config,
    );
    const equipped = simulateSequence(
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
        && proc.sourceSkill === 'Bladesong Dissonance'));
});

test('Relic of the Claw can trigger from a non-damaging control skill and expires', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        relic: 'Claw',
        modifiers: { strike: 1, condition: 1 },
    });
    const active = simulateSequence(
        ['Signet of Domination', 'Mind Slash'],
        config,
    );
    const expired = simulateSequence(
        ['Signet of Domination', { name: '__wait', waitMs: 8001 }, 'Mind Slash'],
        config,
    );
    const activeDamage =
        active.breakdown.find(entry => entry.name === 'Mind Slash').strikeDamage;
    const expiredDamage =
        expired.breakdown.find(entry => entry.name === 'Mind Slash').strikeDamage;

    assert.ok(Math.abs(activeDamage / expiredDamage - 1.07) < 1e-12);
});

test('timed relic buffs only add a proc when the buff was not already active', () => {
    const claw = simulateSequence(
        ['Signet of Domination', 'Diversion', { name: '__wait', waitMs: 8001 }, 'Signet of Domination'],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 3,
            relic: 'Claw',
        }),
    );
    assert.equal(
        claw.procSteps.filter(proc => proc.skill === 'Relic of the Claw').length,
        2,
    );

    const fireworks = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const probe = simulateSequence(['Bladecall'], config);
    const firstHitDamage = probe.resolvedEvents.find(event =>
        event.type === 'damage' && event.skillName === 'Bladecall').damage;
    const target = {
        ...config.target,
        health: firstHitDamage * 1.5,
    };
    const base = simulateSequence(
        ['Bladecall', 'Bladecall'],
        { ...config, target },
    );
    const eagle = simulateSequence(
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
    const result = simulateSequence(
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
    const resultAt = might => simulateSequence(
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
        stats: {
            ...defaultSimulationConfig().stats,
            expertise: 0,
        },
        modifiers: { strike: 1, condition: 1 },
    });
    const result = simulateSequence(
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
    const base = simulateSequence(
        ['Blink', 'Mind Slash', { name: '__wait', waitMs: 8000 }],
        config,
    );
    const equipped = simulateSequence(
        ['Blink', 'Mind Slash', { name: '__wait', waitMs: 8000 }],
        { ...config, relic: 'Peitha' },
    );
    const damage = result =>
        result.breakdown.find(entry => entry.name === 'Mind Slash').strikeDamage;

    assert.ok(Math.abs(damage(equipped) / damage(base) - 1.1) < 1e-12);
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
        modifiers: { strike: 1, condition: 1 },
    });
    const rotation = [
        { name: '__wait', waitMs: 3100 },
        'Phantasmal Duelist',
        { name: '__wait', waitMs: 5000 },
    ];
    const base = simulateSequence(rotation, config);
    const equipped = simulateSequence(rotation, { ...config, relic: 'Thorns' });

    assert.ok(equipped.conditionDamage > base.conditionDamage);
    assert.deepEqual(
        equipped.procSteps
            .filter(proc => proc.skill === 'Relic of Thorns')
            .map(proc => proc.start),
        [3000, 8000],
    );
});

test('weapon swap changes sets and observes its cooldown before swapping back', () => {
    const result = simulateSequence(
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
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
    });
    const result = simulateSequence(
        ['Blink', { name: 'Mirror Images', offset: 100 }],
        config,
    );
    assert.equal(result.endState.time, 150);
    assert.equal(result.endState.resource, 2);
});

test('shift-queued Mirror Images after a resource-generating cast grants both clones', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
    });
    const result = simulateSequence(
        ['Bladecall', { name: 'Mirror Images', offset: 100 }],
        config,
    );
    const mirrorImagesResource = result.events.find(
        event => event.type === 'resource' && event.reason === 'Mirror Images',
    );

    assert.equal(mirrorImagesResource?.amount, 2);
    assert.equal(result.endState.resource, 3);
});

test('clones from shift-queued Mirror Images are available to the next shatter', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
    });
    const result = simulateSequence(
        ['Blink', { name: 'Mirror Images', offset: 100 }, 'Mind Wrack'],
        config,
    );
    assert.equal(result.steps.length, 3);
    assert.equal(result.steps[2].start, 150);
    assert.equal(result.endState.resource, 0);
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
    const first = simulateSequence(
        ['Phantasmal Duelist', { name: '__wait', waitMs: 1000 }],
        config,
    );
    const second = simulateSequence(
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
    const counter = simulateSequence(['Illusionary Counter'], config);
    assert.equal(counter.steps[0].end, 120);
    assert.equal(counter.steps[0].interrupted, true);
    assert.ok(counter.steps[0].fullCastMs > 120);
    assert.equal(
        counter.breakdown.some(entry => entry.name === 'Illusionary Counter'),
        false,
    );
    assert.equal(counter.endState.resource, 0);
    assert.equal(counter.endState.counterspellAvailable, true);
    assert.equal(
        counter.resolvedEvents.some(event =>
            event.type === 'condition'
            && event.skillName === 'Illusionary Counter'
            && event.condition === 'Torment'),
        false,
    );

    const unavailable = simulateSequence(['Counterspell'], config);
    assert.equal(unavailable.steps.length, 0);
    assert.match(unavailable.warnings[0], /Illusionary Counter is not active/);

    const flipped = simulateSequence(
        ['Illusionary Counter', 'Counterspell', 'Counterspell'],
        config,
    );
    assert.equal(flipped.steps.length, 2);
    assert.equal(flipped.steps[1].start, 120);
    assert.equal(flipped.endState.resource, 1);
    assert.equal(flipped.endState.counterspellAvailable, false);
    assert.ok(flipped.breakdown.some(entry => entry.name === 'Counterspell'));
});

test('Ether Bolt and Ether Blast do not generate clones', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const result = simulateSequence(['Ether Bolt', 'Ether Blast'], config);
    assert.deepEqual(result.steps.map(step => step.skill), ['Ether Bolt', 'Ether Blast']);
    assert.equal(result.endState.resource, 0);
});

test('Ether Clone creates a clone below cap and inflicts torment at cap', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const belowCap = simulateSequence(
        ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
        { ...config, initialResource: 2 },
    );
    assert.equal(belowCap.endState.resource, 3);
    assert.equal(
        belowCap.events.some(event =>
            event.type === 'condition'
            && event.skillName === 'Ether Clone'
            && event.condition === 'Torment'),
        false,
    );

    const atCap = simulateSequence(
        ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
        { ...config, initialResource: 3 },
    );
    assert.equal(atCap.endState.resource, 3);
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
    const locked = simulateSequence(['Ether Blast', 'Ether Clone'], config);
    assert.equal(locked.steps.length, 0);
    assert.match(locked.warnings[0], /cast Ether Bolt first/);

    const skippedStep = simulateSequence(
        ['Ether Bolt', 'Ether Clone'],
        config,
    );
    assert.deepEqual(skippedStep.steps.map(step => step.skill), ['Ether Bolt']);
    assert.equal(skippedStep.endState.autoattackChains['Ether Bolt'], 'Ether Blast');
    assert.match(skippedStep.warnings[0], /cast Ether Blast first/);

    const completed = simulateSequence(
        ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
        config,
    );
    assert.equal(completed.endState.autoattackChains['Ether Bolt'], 'Ether Bolt');
});

test('Scepter weapon skills preserve Ether Bolt chain progress', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
    });
    const result = simulateSequence(
        ['Ether Bolt', 'Confusing Images', 'Ether Blast'],
        config,
    );
    assert.deepEqual(
        result.steps.map(step => step.skill),
        ['Ether Bolt', 'Confusing Images', 'Ether Blast'],
    );
    assert.equal(result.endState.autoattackChains['Ether Bolt'], 'Ether Clone');
});

test('other auto chains reset on weapon skills and every chain resets on swap', () => {
    const swordConfig = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
    });
    const interrupted = simulateSequence(
        ['Mind Slash', 'Blurred Frenzy', 'Mind Gash'],
        swordConfig,
    );
    assert.deepEqual(
        interrupted.steps.map(step => step.skill),
        ['Mind Slash', 'Blurred Frenzy'],
    );
    assert.equal(interrupted.endState.autoattackChains['Mind Slash'], 'Mind Slash');

    const scepterConfig = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Sword',
        weaponSet2Primary: 'Spear',
        weaponSet2Secondary: '',
    });
    const swapped = simulateSequence(
        ['Ether Bolt', 'Swap Weapons', 'Ether Blast'],
        scepterConfig,
    );
    assert.deepEqual(
        swapped.steps.map(step => step.skill),
        ['Ether Bolt', 'Swap Weapons'],
    );
    assert.equal(swapped.endState.autoattackChains['Ether Bolt'], 'Ether Bolt');
});

test('sword, scepter, axe, and spear auto chains cast as separate attacks', () => {
    const chain = [
        'Mind Slash', 'Mind Gash', 'Mind Spike',
        'Ether Bolt', 'Ether Blast', 'Ether Clone',
        'Lacerating Chop', 'Ethereal Chop', 'Mirror Strikes',
        'Psycut', 'Psystrike', 'Mind Pierce',
    ];
    const result = simulateSequence(
        chain,
        defaultSimulationConfig({
            specialization: 'Mirage',
            initialResource: 0,
            weaponmasterTraining: true,
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
        assert.equal(simulateSequence(skills, config).endState.time, expectedTime);
    }
});

test('requested weapon flips require and consume their parent sequence skill', () => {
    const config = defaultSimulationConfig({
        specialization: 'Core',
        initialResource: 0,
    });
    const pairs = [
        ['Singularity Shot', 'Dimensional Aperture'],
        ['Inspiring Imagery', 'Abstraction'],
        ['Temporal Curtain', 'Into the Void'],
        ['Illusionary Riposte', 'Counter Blade'],
        ['Illusionary Leap', 'Swap'],
    ];
    for (const [parent, flip] of pairs) {
        const unavailable = simulateSequence([flip], config);
        assert.equal(unavailable.steps.length, 0, flip);
        assert.match(unavailable.warnings[0], new RegExp(parent), flip);

        const result = simulateSequence([parent, flip, flip], config);
        assert.deepEqual(
            result.steps.map(step => step.skill),
            [parent, flip],
            flip,
        );
        assert.equal(result.endState.availableFlips[flip], undefined, flip);
    }
});

test('Into the Void waits for its one-second post-curtain delay', () => {
    const result = simulateSequence(
        ['Temporal Curtain', 'Into the Void'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.equal(result.steps[1].start, 1000);
});

test('Dimensional Aperture adds 50% to Singularity Shot recharge', () => {
    const config = defaultSimulationConfig({ specialization: 'Core' });
    const base = simulateSequence(['Singularity Shot'], config);
    const aperture = simulateSequence(
        ['Singularity Shot', 'Dimensional Aperture'],
        config,
    );
    assert.equal(base.endState.cooldowns['Singularity Shot'].readyAt, 13333);
    assert.equal(aperture.endState.cooldowns['Singularity Shot'].readyAt, 20000);
});

test('Abstraction records its detonation strike damage', () => {
    const result = simulateSequence(
        ['Inspiring Imagery', 'Abstraction'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.ok(result.breakdown.some(entry =>
        entry.name === 'Abstraction' && entry.strikeDamage > 0));
});

test('Shatter Storm gives Split Second two ammo charges', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
        ['Power Spike', 'Power Spike', 'Power Spike'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    // The third cast has no charges left, so the flip reverts to its parent.
    assert.deepEqual(result.steps.map(step => step.skill), ['Power Spike', 'Power Spike']);
    assert.equal(result.steps[0].start, 0);
    assert.equal(result.steps[1].start, 50);
    assert.equal(result.endState.availableFlips['Power Spike'], undefined);
    assert.equal(result.endState.ammo['Power Spike'], undefined);
    assert.match(result.warnings.at(-1), /Mantra of Pain is not active/);
});

test('Re-channeling Mantra of Pain refills Power Spike to two charges', () => {
    const result = simulateSequence(
        ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.deepEqual(
        result.steps.map(step => step.skill),
        ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike'],
    );
    assert.ok(result.endState.availableFlips['Power Spike']);
    assert.equal(result.endState.availableFlips['Power Spike'].persistent, true);
    assert.deepEqual(
        {
            charges: result.endState.ammo['Power Spike'].charges,
            maximum: result.endState.ammo['Power Spike'].maximum,
        },
        { charges: 1, maximum: 2 },
    );
});

test('Power Spike records its strike damage', () => {
    const result = simulateSequence(
        ['Power Spike'],
        defaultSimulationConfig({ specialization: 'Core' }),
    );
    assert.ok(result.breakdown.some(entry =>
        entry.name === 'Power Spike' && entry.strikeDamage > 0));
});

test('Power Spike woven into the Mantra of Pain channel is invalid and unsimulated', () => {
    const result = simulateSequence(
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
    assert.equal(result.endState.availableFlips['Power Spike'].persistent, true);
    assert.equal(result.endState.ammo['Power Spike'].charges, 2);
    assert.match(result.warnings.at(-1), /Mantra of Pain is still channeling/);
});

test('Power Spike stays invalid even when another instant is chained into the channel first', () => {
    // Weaving an instant (Blink) into the channel and then Power Spike after it
    // must still be caught: the flip is not armed until the channel completes,
    // regardless of the immediately preceding command.
    const result = simulateSequence(
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
    const fullShatter = simulateSequence(
        ['Split Second'],
        { ...config, initialResource: 3 },
    );
    const partialShatter = simulateSequence(
        ['Split Second'],
        { ...config, initialResource: 2 },
    );
    assert.equal(fullShatter.endState.resource, 1);
    assert.equal(partialShatter.endState.resource, 0);
    assert.ok(
        simulationEventLogRows(fullShatter).some(event =>
            event.description.includes(
                'CLONE SPAWNED x1 -> 1/3 [Illusionary Reversion] (Clone #4 [Dagger])',
            )),
    );
});

test('Signet of the Ether resets every phantasm skill cooldown', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
        ['Mind the Gap', 'Mental Collapse', 'Mind the Gap'],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
        }),
    );

    assert.equal(result.steps.length, 3);
    assert.ok(Math.abs(result.steps[2].start - result.steps[1].end) <= 1);
    const resetOnly = simulateSequence(
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
    const result = simulateSequence(
        ['Mind the Gap'],
        defaultSimulationConfig({
            specialization: 'Virtuoso',
            primaryWeapon: 'Spear',
            secondaryWeapon: '',
        }),
    );

    assert.equal(result.endState.clarityRemaining, 15000);
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
        const result = simulateSequence(
            ['Mind the Gap', consumer],
            defaultSimulationConfig({
                specialization: 'Virtuoso',
                primaryWeapon: 'Spear',
                secondaryWeapon: '',
            }),
        );
        assert.equal(result.endState.clarityRemaining, 0, consumer);
    }
});

test('Clarity makes Phantasmal Lancer summon and attack with a second phantasm', () => {
    const config = defaultSimulationConfig({
        specialization: 'Virtuoso',
        primaryWeapon: 'Spear',
        secondaryWeapon: '',
        initialResource: 0,
    });
    const normal = simulateSequence(
        ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
        config,
    );
    const empowered = simulateSequence(
        ['Mind the Gap', 'Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
        config,
    );

    assert.equal(
        normal.events.find(event =>
            event.type === 'phantasm_summoned'
            && event.name === 'Phantasmal Lancer'
        )?.count,
        1,
    );
    assert.equal(
        empowered.events.find(event =>
            event.type === 'phantasm_summoned'
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
});

test('Bountiful Blades stocks each Berserker blade independently', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
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

    assert.equal(result.warnings.length, 0);
    assert.equal(harmony.detail, '5 blades spent');
    assert.equal(sorrow.detail, '5 blades spent');
    assert.equal(harmonySpend.amount, -5);
});

test('Clarity makes only an empowered Mental Collapse a control skill', () => {
    const config = defaultSimulationConfig({
        specialization: 'Virtuoso',
        primaryWeapon: 'Spear',
        secondaryWeapon: '',
    });
    const normal = simulateSequence(['Mental Collapse'], config);
    const empowered = simulateSequence(['Mind the Gap', 'Mental Collapse'], config);
    const activeNearExpiry = simulateSequence(
        ['Mind the Gap', { name: '__wait', waitMs: 14999 }, 'Mental Collapse'],
        config,
    );
    const expired = simulateSequence(
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
    const result = simulateSequence(
        ['Signet of the Ether'],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 0,
        }),
    );

    assert.equal(result.endState.resource, 0);
    assert.equal(
        result.events.some(
            event => event.type === 'resource' && event.reason === 'Signet of the Ether',
        ),
        false,
    );
});

test('concurrent Continuum Split excludes the still-casting skill from its snapshot', () => {
    const result = simulateSequence(
        [
            'Phantasmal Warlock',
            { name: 'Continuum Split', offset: 100 },
            'Continuum Shift',
            'Phantasmal Warlock',
        ],
        defaultSimulationConfig({
            specialization: 'Chronomancer',
            initialResource: 3,
        }),
    );
    assert.equal(result.steps[0].end, 780);
    assert.equal(result.steps[1].start, 100);
    assert.equal(result.steps[3].start, result.steps[2].end);
});

test('mid-rotation concurrent Continuum Split does not restore expired cooldowns', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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

test('result summary includes kill time when target health is exhausted', () => {
    const defaults = defaultSimulationConfig();
    const result = simulateSequence(
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

test('skill breakdown combines strike and condition damage by source skill', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const split = simulateSequence(['Continuum Split'], config);
    assert.equal(split.endState.continuumActive, true);
    assert.ok(split.endState.continuumRemaining > 0);

    const shifted = simulateSequence(['Continuum Split', 'Continuum Shift'], config);
    assert.equal(shifted.endState.continuumActive, false);
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
    const result = simulateSequence(
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
    const result = simulateSequence(
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
    const onSetTwo = simulateSequence(
        [{ name: '__wait', waitMs: 1000 }],
        { ...base, startingWeaponSet: 2 },
    );
    assert.equal(onSetTwo.endState.activeWeaponSet, 2);

    // Swapping from a set-two opener lands on set one, proving t=0 was set two.
    const swappedFromTwo = simulateSequence(
        ['Swap Weapons'],
        { ...base, startingWeaponSet: 2 },
    );
    assert.equal(swappedFromTwo.endState.activeWeaponSet, 1);

    const onSetOne = simulateSequence(
        [{ name: '__wait', waitMs: 1000 }],
        { ...base, startingWeaponSet: 1 },
    );
    assert.equal(onSetOne.endState.activeWeaponSet, 1);
});

test('starting on weapon set two is ignored without a second weapon set', () => {
    const result = simulateSequence(
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
    const result = simulateSequence(
        [{ name: '__wait', waitMs: 1000 }],
        defaultSimulationConfig({
            specialization: 'Core',
            initialResource: 0,
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Sword',
        }),
    );
    assert.equal(result.endState.resource, 0);
});
