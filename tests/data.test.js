import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILLS, SPECIALIZATIONS } from '../js/data/mesmer-catalog.js';
import { RELIC_NAMES } from '../js/data/gear-data.js';
import { TRAITS } from '../js/data/traits-data.js';
import {
    PHANTASM_ATTACK_TIMINGS,
    PHANTASM_NAME_BY_SKILL,
} from '../js/sim/mechanics/mesmer-illusion-data.js';
import { MECHANIC_SKILLS } from '../js/sim/mechanics/mesmer-profession-data.js';
import {
    PSEUDO_SKILLS,
    normalizedSkill,
} from '../js/sim/mechanics/mesmer-skill-normalization.js';

test('catalog contains every Mesmer specialization and trait', () => {
    assert.deepEqual(
        SPECIALIZATIONS.map(spec => spec.name),
        ['Domination', 'Dueling', 'Chaos', 'Inspiration', 'Illusions', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'],
    );
    assert.equal(TRAITS.length, 108);
    assert.equal(SKILLS.length, 118);
});

test('Mesmer relic options exclude profession-inapplicable relics', () => {
    const excluded = [
        'Brawler',
        'Dragonhunter',
        'Krait',
        'Weaver',
        'Bloodstone',
        'Fire',
        'Nourys',
        'Mount Balrior',
        'Steamshrieker',
        'Blightbringer',
    ];
    assert.equal(RELIC_NAMES.includes('Claw'), true);
    assert.deepEqual(RELIC_NAMES.filter(name => excluded.includes(name)), []);
});

test('each profession variant has a complete mechanic bar', () => {
    assert.equal(MECHANIC_SKILLS.Core.length, 4);
    assert.equal(MECHANIC_SKILLS.Chronomancer.length, 5);
    assert.equal(MECHANIC_SKILLS.Mirage.length, 4);
    assert.equal(MECHANIC_SKILLS.Virtuoso.length, 5);
    assert.equal(MECHANIC_SKILLS.Troubadour.length, 5);
});

test('every cataloged phantasm has an attack timing before clone conversion', () => {
    const phantasms = SKILLS
        .map(normalizedSkill)
        .filter(skill => skill.resource?.mode === 'phantasm');

    assert.deepEqual(
        phantasms.map(skill => skill.name),
        [
            'Phantasmal Swordsman',
            'Phantasmal Duelist',
            'Phantasmal Mage',
            'Phantasmal Warlock',
            'Phantasmal Berserker',
            'Phantasmal Disenchanter',
            'Phantasmal Warden',
            'Phantasmal Defender',
            'Echo of Memory',
            'Phantasmal Sharpshooter',
            'Phantasmal Lancer',
        ],
    );
    for (const skill of phantasms) {
        const phantasmName = PHANTASM_NAME_BY_SKILL[skill.name] || skill.name;
        const timing = PHANTASM_ATTACK_TIMINGS[phantasmName];
        assert.ok(timing, `${skill.name} is missing a phantasm attack timing`);
        assert.ok(timing.castTime > 0, `${skill.name} has an invalid cast time`);
        assert.ok(timing.damage > 0, `${skill.name} has an invalid damage time`);
        assert.ok(timing.spawn >= timing.damage, `${skill.name} converts before damage ends`);
        assert.ok(
            timing.chronophantasmaDamage >= timing.damage,
            `${skill.name} has an invalid Chronophantasma damage time`,
        );
        assert.ok(
            timing.chronophantasmaSpawn >= timing.chronophantasmaDamage,
            `${skill.name} converts before its repeat ends`,
        );
    }
});

test('measured phantasm endpoints match the supplied cast, damage, and spawn table', () => {
    const expected = {
        'Phantasmal Avenger': [1.64, 1.44, 2.16, 4.2, 4.96],
        'Phantasmal Berserker': [0.56, 1.48, 2.56, 4.68, 5.92],
        'Phantasmal Defender': [0.77, 3.8, 4.51, 8.8, 9.52],
        'Phantasmal Disenchanter': [0.76, 1.15, 1.84, 4.04, 4.72],
        'Phantasmal Duelist': [0.54, 2.4, 2.88, 6.44, 7.04],
        'Phantasmal Mage': [0.8, 2.27, 2.52, 5.32, 5.56],
        'Phantasmal Rogue': [0.61, 1.2, 2, 4.04, 4.76],
        'Phantasmal Swordsman': [0.86, 2.48, 3.6, 7.12, 8.27],
        'Phantasmal Warden': [0.46, 5.04, 7.24, 13.2, 15.32],
        'Phantasmal Warlock': [0.78, 2.96, 4.24, 8.56, 9.84],
    };

    for (const [skillName, values] of Object.entries(expected)) {
        const timing = PHANTASM_ATTACK_TIMINGS[skillName];
        assert.deepEqual(
            [
                timing.castTime,
                timing.damage,
                timing.spawn,
                timing.chronophantasmaDamage,
                timing.chronophantasmaSpawn,
            ],
            values,
        );
        const catalogName = skillName === 'Phantasmal Avenger' ? 'Echo of Memory' : skillName;
        const catalogSkill = SKILLS.find(skill => skill.name === catalogName);
        if (catalogSkill) {
            assert.ok(
                Math.abs(normalizedSkill(catalogSkill).activation / 1.5 - values[0]) < 1e-12,
                `${skillName} has the wrong measured cast time`,
            );
        }
    }
});

test('Counterspell is cataloged as Illusionary Counter’s clone-generating flip skill', () => {
    const counterspell = PSEUDO_SKILLS.find(skill => skill.name === 'Counterspell');
    assert.equal(counterspell.id, 10314);
    assert.equal(counterspell.weapon, 'Scepter');
    assert.deepEqual(counterspell.resource, { mode: 'add', count: 1 });
});

test('Illusionary Counter does not grant its successful-block clones on activation', () => {
    const counter = normalizedSkill(SKILLS.find(skill => skill.name === 'Illusionary Counter'));
    assert.equal(counter.resource, null);
});

test('Signet of the Ether does not generate a clone on activation', () => {
    const signet = normalizedSkill(SKILLS.find(skill => skill.name === 'Signet of the Ether'));
    assert.equal(signet.resource, null);
});

test('Mesmer weapon autoattacks are cataloged as individual chain skills', () => {
    const expectedChains = {
        'Mind Slash': ['Mind Gash', 'Mind Spike'],
        'Ether Bolt': ['Ether Blast', 'Ether Clone'],
        'Lacerating Chop': ['Ethereal Chop', 'Mirror Strikes'],
        Psycut: ['Psystrike', 'Mind Pierce'],
    };
    for (const [root, names] of Object.entries(expectedChains)) {
        const rootSkill = normalizedSkill(SKILLS.find(skill => skill.name === root));
        assert.equal(rootSkill.damage[0].hits, 1);
        assert.notEqual(rootSkill.damage[0].label, 'Full autoattack chain');
        assert.equal(rootSkill.chainRoot, root);
        assert.equal(rootSkill.chainStep, 1);
        assert.deepEqual(
            PSEUDO_SKILLS
                .filter(skill => skill.chainRoot === root)
                .sort((a, b) => a.chainStep - b.chainStep)
                .map(skill => skill.name),
            names,
        );
    }
});

test('requested rifle, focus, and sword sequence flips are cataloged', () => {
    assert.deepEqual(
        PSEUDO_SKILLS
            .filter(skill => skill.flipParent)
            .map(skill => [skill.name, skill.flipParent]),
        [
            ['Counterspell', 'Illusionary Counter'],
            ['Power Spike', 'Mantra of Pain'],
            ['Dimensional Aperture', 'Singularity Shot'],
            ['Abstraction', 'Inspiring Imagery'],
            ['Into the Void', 'Temporal Curtain'],
            ['Counter Blade', 'Illusionary Riposte'],
            ['Swap', 'Illusionary Leap'],
        ],
    );
});

test('rotation actions use the requested icons without a duplicate fixed wait', () => {
    const dodge = PSEUDO_SKILLS.find(skill => skill.name === 'Dodge / Mirage Cloak');
    const shift = PSEUDO_SKILLS.find(skill => skill.name === 'Continuum Shift');
    assert.equal(dodge.icon, 'https://wiki.guildwars2.com/images/b/b2/Dodge.png');
    assert.equal(shift.icon, 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png');
    assert.equal(PSEUDO_SKILLS.some(skill => skill.name === 'Wait 1 second'), false);
});
