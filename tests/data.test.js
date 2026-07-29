import assert from 'node:assert/strict';
import test from 'node:test';
import {
    SKILLS,
    SPECIALIZATIONS,
} from "../js/professions/mesmer/data/mesmer-api-metadata.js";
import {
    SKILLS as GUARDIAN_API_SKILLS,
} from "../js/professions/guardian/data/guardian-api-metadata.js";
import { RELIC_NAMES } from '../js/platform/gw2/gear-data.js';
import { TRAITS } from '../js/professions/mesmer/data/traits-data.js';
import {
    AMBUSH_ATTACKS,
    AMBUSH_SKILLS,
    CLONE_ATTACKS,
    INSTRUMENTS,
    MECHANIC_SKILLS,
    PHANTASM_ATTACK_TIMINGS,
    PHANTASM_NAME_BY_SKILL,
    PSEUDO_SKILLS,
    MESMER_SKILL_MECHANICS,
    SHATTERS,
    TRAIT_DAMAGE,
} from "../js/professions/mesmer/mechanics/skill-mechanics.js";
import { mesmerCatalog } from '../js/professions/mesmer/catalog.js';
import { MESMER_SKILL_IDS as ID } from '../js/professions/mesmer/data/ids.js';

const catalogSkill = name => mesmerCatalog.skillsByName.get(name);
const strikeEffects = skill =>
    skill.effects.filter(effect => effect.type === 'strike');
const strikeCoefficient = effect =>
    effect.ticks
        ? effect.ticks.reduce((sum, tick) => sum + tick.coefficient, 0)
        : Number(effect.coefficient || 0);
const totalStrikeCoefficient = skill =>
    strikeEffects(skill).reduce(
        (sum, effect) => sum + strikeCoefficient(effect),
        0,
    );

test('catalog contains every terrestrial Mesmer skill and trait line', () => {
    assert.deepEqual(
        SPECIALIZATIONS.map(spec => spec.name),
        ['Domination', 'Dueling', 'Chaos', 'Inspiration', 'Illusions', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'],
    );
    assert.equal(TRAITS.length, 108);
    assert.equal(SKILLS.length, 119);
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

test("Mesmer mechanics are the sole simulation source and use stable skill ids", () => {
    assert.equal(
        Object.entries(MESMER_SKILL_MECHANICS).every(([id, mechanics]) =>
            Number.isInteger(Number(id)) && mechanics.implemented === true),
        true,
    );
    for (const skill of SKILLS) {
        assert.ok(
            MESMER_SKILL_MECHANICS[skill.id],
            `${skill.name} is missing authoritative simulation mechanics`,
        );
        assert.equal(
            MESMER_SKILL_MECHANICS[skill.id]?.implemented,
            true,
            skill.name,
        );
    }
    assert.equal(MESMER_SKILL_MECHANICS[ID.WINDS_OF_CHAOS].castTimeMs, 1140);
    assert.equal(MESMER_SKILL_MECHANICS["Winds of Chaos"], undefined);
    assert.deepEqual(
        MESMER_SKILL_MECHANICS[ID.TROUBADOUR_BLADECALL].effects,
        MESMER_SKILL_MECHANICS[ID.BLADECALL].effects,
    );
    assert.equal(
        MESMER_SKILL_MECHANICS[ID.TROUBADOUR_BLADECALL].castTimeMs,
        MESMER_SKILL_MECHANICS[ID.BLADECALL].castTimeMs,
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
        assert.ok(timing.castTimeMs > 0, `${skill.name} has an invalid cast time`);
        assert.ok(timing.damageAtMs > 0, `${skill.name} has an invalid damage time`);
        assert.ok(timing.spawnAtMs >= timing.damageAtMs, `${skill.name} converts before damage ends`);
        assert.ok(
            timing.chronophantasmaDamageAtMs >= timing.damageAtMs,
            `${skill.name} has an invalid Chronophantasma damage time`,
        );
        assert.ok(
            timing.chronophantasmaSpawnAtMs >= timing.chronophantasmaDamageAtMs,
            `${skill.name} converts before its repeat ends`,
        );
    }
});

test('measured phantasm endpoints match the supplied cast, damage, and spawn table', () => {
    const expected = {
        'Phantasmal Avenger': [1640, 1440, 2160, 4200, 4960],
        'Phantasmal Berserker': [560, 1480, 2560, 4680, 5920],
        'Phantasmal Defender': [770, 3800, 4510, 8800, 9520],
        'Phantasmal Disenchanter': [760, 1150, 1840, 4040, 4720],
        'Phantasmal Duelist': [560, 2751, 3334, 6440, 7040],
        'Phantasmal Mage': [800, 2270, 2520, 5320, 5560],
        'Phantasmal Rogue': [610, 1200, 2000, 4040, 4760],
        'Phantasmal Swordsman': [
            880,
            3159,
            4284,
            7120,
            8270,
        ],
        'Phantasmal Warden': [460, 5040, 7240, 13200, 15320],
        'Phantasmal Warlock': [780, 2960, 4240, 8560, 9840],
    };

    for (const [skillName, values] of Object.entries(expected)) {
        const timing = PHANTASM_ATTACK_TIMINGS[skillName];
        assert.deepEqual(
            [
                timing.castTimeMs,
                timing.damageAtMs,
                timing.spawnAtMs,
                timing.chronophantasmaDamageAtMs,
                timing.chronophantasmaSpawnAtMs,
            ],
            values,
        );
        const catalogName = skillName === 'Phantasmal Avenger' ? 'Echo of Memory' : skillName;
        const catalogSkill = SKILLS.find(skill => skill.name === catalogName);
        if (catalogSkill) {
            assert.ok(
                Math.abs(
                    mesmerCatalog.skillsById.get(catalogSkill.id).castTimeMs
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

test('Mesmer instant-cast skills have zero cast time', () => {
    const instantSkills = [
        'Cry of Frustration',
        'Mind Wrack',
        'Distortion',
        'Portal Entre',
        'Blink',
        'Decoy',
        'Mirror Images',
        'Signet of Midnight',
        'The Prestige',
        'Diversion',
        'Feedback',
        'Phase Retreat',
        'Chaos Armor',
        'Thousand Cuts',
        'Continuum Split',
        'Sand through Glass',
        'Illusionary Ambush',
        'Jaunt',
        'Time Sink',
        'Rewinder',
        'Split Second',
        'Bladeturn Requiem',
        'Bladesong Distortion',
        'Tale of the Honorable Rogue',
        'Tale of the Soulkeeper',
        'Tale of the Valiant Marshal',
        'Power Spike',
        'Dimensional Aperture',
        'Abstraction',
        'Into the Void',
        'Swap',
        'Dodge / Mirage Cloak',
        'Continuum Shift',
    ];

    for (const name of instantSkills) {
        const skill = catalogSkill(name);
        assert.equal(skill.castTimeMs, 0, name);
        assert.equal(skill.quicknessCastTimeMs ?? 0, 0, name);
    }
});

test('Mesmer shatters share only the shatter-family lockout', () => {
    for (const name of Object.keys(SHATTERS)) {
        assert.deepEqual(
            catalogSkill(name).lockouts,
            [{ group: 'mesmer.shatter', durationMs: 50 }],
            name,
        );
    }
    assert.deepEqual(catalogSkill('Power Spike').lockouts, []);
    assert.deepEqual(catalogSkill('Mirror Images').lockouts, []);
});

test('Mesmer weapon autoattacks are cataloged as individual chain skills', () => {
    const expectedChains = [
        [ID.MIND_SLASH, ID.MIND_GASH, ID.MIND_SPIKE],
        [ID.ETHER_BOLT, ID.ETHER_BLAST, ID.ETHER_CLONE],
        [ID.LACERATING_CHOP, ID.ETHEREAL_CHOP, ID.MIRROR_STRIKES],
        [ID.PSYCUT, ID.PSYSTRIKE, ID.MIND_PIERCE],
    ];
    assert.deepEqual(mesmerCatalog.autoattackChains, expectedChains);
    for (const chain of expectedChains) {
        const [rootId, ...childIds] = chain;
        const rootSkill = mesmerCatalog.skillsById.get(rootId);
        assert.equal(strikeEffects(rootSkill)[0].hits, 1);
        assert.notEqual(strikeEffects(rootSkill)[0].name, 'Full autoattack chain');
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
    const totalCoefficient = totalStrikeCoefficient;
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
        assert.ok(Math.abs(skill.castTimeMs / 1500 - quicknessCast) < 1e-12, name);
    }

    assert.equal(AMBUSH_ATTACKS.Axe.player.coefficient, 1);
    assert.equal(AMBUSH_ATTACKS.Axe.castTimeMs / 1500, 0.52);
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
            AMBUSH_ATTACKS.Axe.clone.castTimeMs / 1000,
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
        return strikeEffects(skill).reduce(
            (sum, effect) =>
                sum + strikeCoefficient(effect)
                * (effect.actorType === 'phantasm' ? phantasmCount : 1),
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
        'Phantasmal Warlock': 0.9,
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
        strikeEffects(lancer)
            .find(effect => effect.actorType === 'phantasm').coefficient,
        1.23,
    );
    const swordsman = normalized('Phantasmal Swordsman');
    assert.deepEqual(
        strikeEffects(swordsman)
            .map(effect => [effect.name, effect.coefficient]),
        [
            ['Mesmer strike', 0.5],
            ['Phantasm leap', 0.5],
            ['Phantasm Blurred Frenzy', 1.6],
        ],
    );
    const mage = normalized('Phantasmal Mage');
    assert.deepEqual(
        strikeEffects(mage)
            .map(effect => [effect.actorType, effect.coefficient]),
        [
            ['player', 0.19],
            ['phantasm', 0.5],
        ],
    );
});

test('latest supplied weapon, clone, ambush, and trait coefficients are preserved', () => {
    const normalized = catalogSkill;
    const totalCoefficient = name => totalStrikeCoefficient(normalized(name));
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
    assert.equal(strikeEffects(flyingCutter)[0].coefficient, 0.5);
    assert.equal(strikeEffects(flyingCutter)[0].castProgress, 0.72);
    assert.deepEqual(flyingCutter.trackedHitDamage, {
        hitsRequired: 3,
        duration: 5,
        skillId: ID.CUTTER_BURST,
        wikiUrl: 'https://wiki.guildwars2.com/wiki/Cutter_Burst',
        name: 'Cutter Burst',
        actorType: 'player',
        ticks: [
            { atMs: 217, coefficient: 0.2 },
            { atMs: 250, coefficient: 0.2 },
            { atMs: 384, coefficient: 0.2 },
        ],
    });
    assert.deepEqual(
        strikeEffects(normalized('Bladecall')).map(effect => [
            strikeCoefficient(effect),
            effect.ticks.length,
            effect.ticks.map(tick => tick.atMs),
        ]),
        [
            [0.75, 3, [199, 199, 199]],
            [0.75, 3, [2716, 2716, 2766]],
        ],
    );
    assert.equal(TRAIT_DAMAGE['Phantasmal Blade'].weaponStrength, 2553.5);
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
        'Bladeturn Requiem': [0, 0.5, 1, 1.5, 2, 2.5],
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
    assert.equal(dodge.castTimeMs, 0);
    assert.equal(dodge.rechargeAnchor, 'castStart');
});
