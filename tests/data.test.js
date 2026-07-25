import assert from 'node:assert/strict';
import test from 'node:test';
import {
    SKILLS,
    SPECIALIZATIONS,
} from '../js/professions/mesmer/data/mesmer-catalog.js';
import {
    SKILLS as GUARDIAN_API_SKILLS,
} from '../js/professions/guardian/data/guardian-catalog.js';
import { RELIC_NAMES } from '../js/platform/gw2/gear-data.js';
import { TRAITS } from '../js/professions/mesmer/data/traits-data.js';
import {
    AMBUSH_ATTACKS,
    CLONE_ATTACKS,
    PHANTASM_ATTACK_TIMINGS,
    PHANTASM_NAME_BY_SKILL,
} from '../js/professions/mesmer/data/mesmer-illusion-data.js';
import {
    INSTRUMENTS,
    MECHANIC_SKILLS,
    SHATTERS,
    TRAIT_DAMAGE,
} from '../js/professions/mesmer/data/mesmer-profession-data.js';
import {
    AMBUSH_SKILLS,
    MESMER_SKILL_OVERRIDES,
    PSEUDO_SKILLS,
} from '../js/professions/mesmer/mechanics/skill-overrides.js';
import {
    MESMER_AUTOATTACK_CHAINS,
} from '../js/professions/mesmer/mechanics/autoattack-chains.js';
import {
    MESMER_SKILL_DEFAULTS,
} from '../js/professions/mesmer/mechanics/skill-defaults.js';
import {
    MESMER_SKILL_MECHANICS,
} from '../js/professions/mesmer/mechanics/skill-mechanics.js';
import { mesmerCatalog } from '../js/professions/mesmer/catalog.js';
import { MESMER_SKILL_IDS as ID } from '../js/professions/mesmer/data/ids.js';

const catalogSkill = name => mesmerCatalog.skillsByName.get(name);

test('catalog contains every Mesmer specialization and trait', () => {
    assert.deepEqual(
        SPECIALIZATIONS.map(spec => spec.name),
        ['Domination', 'Dueling', 'Chaos', 'Inspiration', 'Illusions', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'],
    );
    assert.equal(TRAITS.length, 108);
    assert.equal(SKILLS.length, 123);
    assert.deepEqual(
        SKILLS.filter(skill =>
            ['Arcane Thievery', 'Veil'].includes(skill.name)),
        [],
    );
});

test('Mesmer and Guardian API catalogs use the same skill record shape', () => {
    const expectedKeys = Object.keys(GUARDIAN_API_SKILLS[0]).sort();
    for (const skill of SKILLS) {
        assert.deepEqual(Object.keys(skill).sort(), expectedKeys, skill.name);
    }
});

test('Mesmer mechanics and overrides are keyed by stable skill id', () => {
    assert.equal(
        Object.entries(MESMER_SKILL_OVERRIDES).every(([id, override]) =>
            Number.isInteger(Number(id)) && override.implemented === true),
        true,
    );
    for (const skill of SKILLS) {
        const defaults = MESMER_SKILL_DEFAULTS[skill.id];
        assert.ok(
            defaults,
            `${skill.name} is missing simulator-owned default mechanics`,
        );
        assert.equal(
            MESMER_SKILL_MECHANICS[skill.id]?.implemented,
            true,
            skill.name,
        );
        for (const key of Object.keys(MESMER_SKILL_OVERRIDES[skill.id] || {})) {
            if (key === 'implemented') continue;
            assert.equal(
                Object.hasOwn(defaults, key),
                false,
                `${skill.name}.${key} exists in both defaults and overrides`,
            );
        }
    }
    assert.equal(MESMER_SKILL_OVERRIDES[ID.WINDS_OF_CHAOS].activation, 1.14);
    assert.equal(MESMER_SKILL_OVERRIDES['Winds of Chaos'], undefined);
    assert.deepEqual(
        MESMER_SKILL_OVERRIDES[ID.TROUBADOUR_BLADECALL],
        MESMER_SKILL_OVERRIDES[ID.BLADECALL],
    );
});

test('every Mesmer catalog skill is explicitly implemented', () => {
    assert.equal(
        mesmerCatalog.skills.every(skill => skill.implemented === true),
        true,
    );
    assert.equal(
        mesmerCatalog.skills.every(skill => Array.isArray(skill.effects)),
        true,
    );
    assert.equal(
        mesmerCatalog.skillsByName.get('Bladecall').id,
        ID.BLADECALL,
    );
});

test('Mesmer relic options exclude profession-inapplicable relics', () => {
    const excluded = [
        'Brawler',
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
        .map(skill => mesmerCatalog.skillsById.get(skill.id))
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
                Math.abs(
                    mesmerCatalog.skillsById.get(catalogSkill.id).activation
                    / 1.5
                    - values[0],
                ) < 1e-12,
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
    const counter = catalogSkill('Illusionary Counter');
    assert.equal(counter.resource, null);
});

test('Signet of the Ether does not generate a clone on activation', () => {
    const signet = catalogSkill('Signet of the Ether');
    assert.equal(signet.resource, null);
});

test('Mesmer weapon autoattacks are cataloged as individual chain skills', () => {
    const expectedChains = [
        [ID.MIND_SLASH, ID.MIND_GASH, ID.MIND_SPIKE],
        [ID.ETHER_BOLT, ID.ETHER_BLAST, ID.ETHER_CLONE],
        [ID.LACERATING_CHOP, ID.ETHEREAL_CHOP, ID.MIRROR_STRIKES],
        [ID.PSYCUT, ID.PSYSTRIKE, ID.MIND_PIERCE],
    ];
    assert.deepEqual(MESMER_AUTOATTACK_CHAINS, expectedChains);
    for (const chain of expectedChains) {
        const [rootId, ...childIds] = chain;
        const rootSkill = mesmerCatalog.skillsById.get(rootId);
        assert.equal(rootSkill.damage[0].hits, 1);
        assert.notEqual(rootSkill.damage[0].label, 'Full autoattack chain');
        assert.equal(rootSkill.chainRoot, rootId);
        assert.equal(rootSkill.chainStep, 1);
        assert.equal(rootSkill.nextChainId, childIds[0]);
        chain.forEach((skillId, index) => {
            const nextChainId = chain[index + 1] ?? null;
            assert.equal(
                SKILLS.find(skill => skill.id === skillId).nextChainId,
                nextChainId,
            );
            assert.equal(
                mesmerCatalog.skillsById.get(skillId).nextChainId,
                nextChainId,
            );
        });
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

test('every terrestrial Mirage main-hand weapon has a selectable ambush skill', () => {
    assert.deepEqual(
        AMBUSH_SKILLS.map(skill => [skill.weapon, skill.name]),
        [
            ['Axe', 'Imaginary Axes'],
            ['Dagger', 'Phantom Razor'],
            ['Greatsword', 'Split Surge'],
            ['Rifle', 'Effervescence'],
            ['Scepter', 'Ether Barrage'],
            ['Spear', 'Fractured Glass'],
            ['Staff', 'Chaos Vortex'],
            ['Sword', 'Mirage Thrust'],
        ],
    );
    assert.ok(AMBUSH_SKILLS.every(skill =>
        skill.ambush
        && skill.specialization === 'Mirage'
        && skill.slot === 'Weapon_1'
        && skill.icon));
});

test('Mirage ambush data uses current player and clone variants', () => {
    assert.deepEqual(AMBUSH_ATTACKS.Axe.player, {
        coefficient: 1,
        hits: 2,
        conditions: [{ name: 'Torment', duration: 3.5, stacks: 3 }],
    });
    assert.equal(AMBUSH_ATTACKS.Dagger.name, 'Phantom Razor');
    assert.equal(AMBUSH_ATTACKS.Dagger.player.coefficient, 3);
    assert.equal(AMBUSH_ATTACKS.Spear.name, 'Fractured Glass');
    assert.equal(AMBUSH_ATTACKS.Spear.id, 73067);
    assert.deepEqual(AMBUSH_ATTACKS.Spear.player, {
        coefficient: 3.15,
        hits: 7,
    });
    assert.deepEqual(AMBUSH_ATTACKS.Spear.vulnerability, {
        duration: 6,
        stacks: 7,
    });
    assert.deepEqual(
        AMBUSH_ATTACKS.Staff.player.conditions.map(condition => condition.name),
        ['Bleeding', 'Torment', 'Confusion'],
    );
});

test('supplied player and clone coefficient table is preserved', () => {
    const normalized = catalogSkill;
    const totalCoefficient = skill =>
        skill.damage.reduce((sum, group) => sum + group.coefficient, 0);
    const playerSkills = [
        ['Lacerating Chop', 0.55, 0.43],
        ['Ethereal Chop', 0.55, 0.53],
        ['Mirror Strikes', 1.1, 0.72],
        ['Lingering Thoughts', 1.2, 0.93],
        ['Axes of Symmetry', 1.75, 1.02],
        ['Mind Stab', 1.8, 0.36],
        ['Phantasmal Berserker', 2.4, 0.56],
        ['Illusionary Wave', 0.3, 0.64],
        ['Unstable Bladestorm', 3, 0.44],
    ];

    for (const [name, coefficient, quicknessCast] of playerSkills) {
        const skill = normalized(name);
        assert.ok(Math.abs(totalCoefficient(skill) - coefficient) < 1e-12, name);
        assert.ok(Math.abs(skill.activation / 1.5 - quicknessCast) < 1e-12, name);
    }

    assert.equal(AMBUSH_ATTACKS.Axe.player.coefficient, 1);
    assert.equal(AMBUSH_ATTACKS.Axe.activation / 1.5, 0.52);
    assert.deepEqual(
        CLONE_ATTACKS.Axe.sequence.map(step => [
            step.name,
            step.coefficient,
            step.interval,
        ]),
        [
            ['Clone: Lacerating Chop', 0.55, 1.51],
            ['Clone: Ethereal Chop', 0.55, 1.61],
            ['Clone: Mirror Strikes', 1.1, 1.17],
        ],
    );
    assert.equal(CLONE_ATTACKS.Dagger.coefficient, 0.7);
    assert.deepEqual(
        [
            AMBUSH_ATTACKS.Axe.clone.coefficient,
            AMBUSH_ATTACKS.Axe.clone.activation,
        ],
        [3.7, 1.11],
    );
    assert.equal(AMBUSH_ATTACKS.Dagger.clone.coefficient, 3);
});

test('Lingering Thoughts variants use the six-second count recharge', () => {
    for (const id of [
        ID.LINGERING_THOUGHTS,
        ID.TROUBADOUR_LINGERING_THOUGHTS,
    ]) {
        const skill = mesmerCatalog.skillsById.get(id);
        assert.equal(skill.ammo, 2);
        assert.equal(skill.ammoRecharge, 6);
    }
});

test('supplied utility, spear, staff, and phantasm coefficients are preserved', () => {
    const normalized = catalogSkill;
    const effectiveCoefficient = skill => {
        const phantasmCount = Number(skill.resource?.count || 1);
        return skill.damage.reduce(
            (sum, group) =>
                sum + group.coefficient
                * (group.source === 'Phantasm' ? phantasmCount : 1),
            0,
        );
    };
    const expectedSkills = {
        'Thousand Cuts': 5,
        Jaunt: 1,
        'Crystal Sands': 2.4,
        'Power Spike': 1.33,
        'Mirage Advance': 1.5,
        'Phantasmal Disenchanter': 1,
        'Rain of Swords': 6,
        'Sword of Decimation': 1.5,
        'Tale of the Tortured Mastermind': 4,
        'Well of Action': 4.5,
        'Well of Calamity': 6,
        'Well of Senility': 4.5,
        Psycut: 1,
        Psystrike: 1,
        'Mind Pierce': 1.5,
        'Mind the Gap': 1.92,
        'Imaginary Inversion': 2.4,
        'Phantasmal Lancer': 2.23,
        'Mental Collapse': 3,
        'Phantasmal Warlock': 1.85,
        'Chaos Storm': 1.98,
        'Phantasmal Swordsman': 2.6,
        'The Prestige': 1,
        'Phantasmal Mage': 0.69,
    };

    for (const [name, coefficient] of Object.entries(expectedSkills)) {
        assert.ok(
            Math.abs(effectiveCoefficient(normalized(name)) - coefficient) < 1e-12,
            name,
        );
    }

    assert.deepEqual(
        CLONE_ATTACKS.Spear.sequence.map(step => [
            step.name,
            step.coefficient,
        ]),
        [
            ['Clone: Psycut', 1],
            ['Clone: Psystrike', 1],
            ['Clone: Mind Pierce', 1.5],
        ],
    );
    assert.equal(AMBUSH_ATTACKS.Spear.clone.coefficient, 3.15);
    assert.equal(CLONE_ATTACKS.Staff.coefficient, 0.49);
    assert.equal(AMBUSH_ATTACKS.Staff.clone.coefficient, 1.12);

    const lancer = normalized('Phantasmal Lancer');
    assert.equal(
        lancer.damage.find(group => group.source === 'Phantasm').coefficient,
        1.23,
    );
    const swordsman = normalized('Phantasmal Swordsman');
    assert.deepEqual(
        swordsman.damage.map(group => [group.label, group.coefficient]),
        [
            ['Mesmer strike', 0.5],
            ['Phantasm leap', 0.5],
            ['Phantasm Blurred Frenzy', 1.6],
        ],
    );
    const mage = normalized('Phantasmal Mage');
    assert.deepEqual(
        mage.damage.map(group => [group.source, group.coefficient]),
        [
            ['Player', 0.19],
            ['Phantasm', 0.5],
        ],
    );
});

test('latest supplied weapon, clone, ambush, and trait coefficients are preserved', () => {
    const normalized = catalogSkill;
    const totalCoefficient = name =>
        normalized(name).damage.reduce(
            (sum, group) => sum + group.coefficient,
            0,
        );
    const expectedSkills = {
        'Ether Bolt': 0.5,
        'Ether Blast': 0.5,
        'Ether Clone': 0.75,
        Counterspell: 0.1,
        'Confusing Images': 5.32,
        'Gravity Well': 5.4,
        'Mind Slash': 1,
        'Mind Gash': 1,
        'Blurred Frenzy': 3.6,
        'Blade Leap': 1.5,
        'Counter Blade': 0.1,
        Bladecall: 1.5,
        'Friendly Fire': 0.5,
        Journey: 1.5,
        Abstraction: 2.5,
        'Phantasmal Sharpshooter': 2.28,
        'Phantasmal Lancer': 2.23,
    };

    for (const [name, coefficient] of Object.entries(expectedSkills)) {
        assert.ok(
            Math.abs(totalCoefficient(name) - coefficient) < 1e-12,
            name,
        );
    }
    assert.equal(normalized('Mind Spike').boonlessCoefficient, 2);

    assert.equal(CLONE_ATTACKS.Scepter.coefficient, 0.3);
    assert.equal(AMBUSH_ATTACKS.Scepter.player.coefficient, 1.25);
    assert.equal(AMBUSH_ATTACKS.Scepter.clone.coefficient, 3.75);
    assert.deepEqual(
        CLONE_ATTACKS.Sword.sequence.map(step => [
            step.name,
            step.coefficient,
        ]),
        [
            ['Clone: Mind Slash', 0.75],
            ['Clone: Mind Gash', 0.75],
            ['Clone: Mind Stab', 0.12],
        ],
    );
    assert.equal(AMBUSH_ATTACKS.Sword.player.coefficient, 3);
    assert.equal(AMBUSH_ATTACKS.Sword.clone.coefficient, 3);
    assert.equal(AMBUSH_ATTACKS.Greatsword.player.coefficient, 3.19);
    assert.equal(AMBUSH_ATTACKS.Rifle.player.coefficient, 2.6);

    const flyingCutter = normalized('Flying Cutter');
    assert.equal(flyingCutter.damage[0].coefficient, 0.5);
    assert.deepEqual(flyingCutter.trackedHitDamage, {
        hitsRequired: 3,
        duration: 5,
        damage: {
            coefficient: 0.6,
            hits: 3,
            label: 'Cutter Burst',
            source: 'Player',
        },
    });
    assert.deepEqual(
        normalized('Bladecall').damage.map(group => [
            group.coefficient,
            group.hits,
        ]),
        [[0.75, 3], [0.75, 3]],
    );
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(TRAIT_DAMAGE).map(([name, data]) => [
                name,
                data.coefficient,
            ]),
        ),
        {
            'Lesser Chaos Storm': 1.98,
            'Phantasmal Blade': 0.7,
            Syncopate: 0.75,
            'Time Bomb': 3,
        },
    );
});

test('supplied shatter and instrument coefficient tables are preserved', () => {
    const expectedShatters = {
        'Mind Wrack': [0.81, 1.61, 2.42, 3.22],
        'Cry of Frustration': [0.42, 0.84, 1.25, 1.67],
        Diversion: [0, 0, 0, 0],
        Distortion: [0, 0, 0, 0],
        'Split Second': [1.534, 3.22, 3.86, 4.51],
        Rewinder: [0.42, 0.84, 1.25, 1.67],
        'Time Sink': [0, 0, 0, 0],
        'Bladesong Harmony': [0, 0.7, 1.4, 2.1, 2.8, 3.5],
        'Bladesong Sorrow': [0, 0.42, 0.84, 1.25, 1.67, 2.09],
        'Bladesong Dissonance': [0, 1, 1, 1, 1, 1],
        'Bladeturn Requiem': [0, 0.3, 0.6, 0.9, 1.2, 1.5],
        'Continuum Split': [0, 0, 0, 0],
    };
    for (const [name, coefficients] of Object.entries(expectedShatters)) {
        assert.deepEqual(SHATTERS[name].coefficients, coefficients, name);
    }

    assert.deepEqual(
        Object.fromEntries(Object.entries(INSTRUMENTS).map(([name, data]) => [
            name,
            data.coefficient,
        ])),
        {
            'Lively Lute': 3,
            'Flustering Flute': 1,
            'Deafening Drum': 2,
            'Harmonious Harp': 0,
        },
    );
});

test('dodge models two endurance charges with a ten-second base recharge', () => {
    const dodge = PSEUDO_SKILLS.find(skill => skill.name === 'Dodge / Mirage Cloak');
    assert.equal(dodge.cooldown, 10);
    assert.equal(dodge.ammo, 2);
    assert.equal(dodge.activation, 0);
});
