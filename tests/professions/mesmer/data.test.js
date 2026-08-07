import assert from 'node:assert/strict';
import test from 'node:test';
import {
    SKILLS,
    SPECIALIZATIONS,
} from "js/professions/mesmer/data/mesmer-api-metadata.js";
import {
    SKILLS as GUARDIAN_API_SKILLS,
} from "js/professions/guardian/data/guardian-api-metadata.js";
import { RELIC_NAMES } from 'js/platform/gw2/gear-data.js';
import { TRAITS } from 'js/professions/mesmer/data/traits-data.js';
import {
    AMBUSH_ATTACKS,
    AMBUSH_SKILLS,
    CLONE_ATTACKS,
    INSTRUMENTS,
    MECHANIC_SKILLS,
    PHANTASM_ATTACK_TIMINGS,
    PSEUDO_SKILLS,
    MESMER_SKILL_MECHANICS,
    MESMER_SUPPLEMENTAL_SKILL_MECHANICS,
    SHATTERS,
    TRAIT_DAMAGE,
} from "js/professions/mesmer/mechanics/skill-mechanics.js";
import { mesmerCatalog } from 'js/professions/mesmer/catalog.js';
import { mesmerProfession } from 'js/professions/mesmer/definition.js';
import { MESMER_SKILL_IDS as ID } from 'js/professions/mesmer/data/ids.js';
import {
    MESMER_SUPPLEMENTAL_SKILLS,
} from 'js/professions/mesmer/data/mesmer-supplemental-skills.js';
import {
    MESMER_TRAIT_COVERAGE,
} from 'js/professions/mesmer/data/trait-coverage.js';
import {
    defaultMesmerLegacySkillId,
    MESMER_DUPLICATE_SKILL_NAMES,
    resolveMesmerLegacySkillId,
} from 'js/professions/mesmer/data/legacy-skill-resolver.js';

const catalogSkill = name => mesmerCatalog.skillsByName.get(name);
const profileEffects = skill =>
    skill.effects.length > 0 ? skill.effects : skill.mesmerEffects || [];
const strikeEffects = skill =>
    profileEffects(skill).filter(effect => effect.type === 'strike');
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
        'Fire',
        'Nourys',
        'Mount Balrior',
        'Steamshrieker',
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

test('Mesmer skill bar labels shatters, bladesongs, and instruments', () => {
    const group = specialization =>
        mesmerProfession.ui.skillBarGroups({ specialization })[0];

    assert.equal(group('Core').label, 'Shatters');
    assert.deepEqual(group('Core').skillIds, MECHANIC_SKILLS.Core);
    assert.equal(group('Chronomancer').label, 'Shatters');
    assert.deepEqual(
        group('Chronomancer').skillIds,
        MECHANIC_SKILLS.Chronomancer,
    );
    assert.equal(group('Virtuoso').label, 'Bladesongs');
    assert.deepEqual(group('Virtuoso').skillIds, MECHANIC_SKILLS.Virtuoso);
    assert.equal(group('Troubadour').label, 'Instruments');
    assert.deepEqual(group('Troubadour').skillIds, MECHANIC_SKILLS.Troubadour);
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
        const timing = PHANTASM_ATTACK_TIMINGS[skill.id];
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
        [ID.ECHO_OF_MEMORY]: [1640, 1440, 2160, 2950, 3710],
        [ID.PHANTASMAL_BERSERKER]: [560, 1480, 2560, 4290, 5370],
        [ID.PHANTASMAL_DEFENDER]: [780, 3800, 4510, 8560, 9270],
        [ID.PHANTASMAL_DISENCHANTER]: [760, 1150, 1840, 3240, 3930],
        [ID.PHANTASMAL_DUELIST]: [560, 2400, 2880, 5530, 6010],
        [ID.PHANTASMAL_MAGE]: [800, 2270, 2520, 5040, 5290],
        [ID.PHANTASMAL_SWORDSMAN]: [
            880,
            2279,
            3600,
            6330,
            7450,
        ],
        [ID.PHANTASMAL_WARDEN]: [460, 5040, 7240, 12530, 14730],
        [ID.PHANTASMAL_WARLOCK]: [780, 2960, 4240, 7450, 8730],
    };
    const catalogCastTimeMs = {
        [ID.PHANTASMAL_DEFENDER]: 1155,
    };

    for (const [skillId, values] of Object.entries(expected)) {
        const timing = PHANTASM_ATTACK_TIMINGS[skillId];
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
        const skill = mesmerCatalog.skillsById.get(Number(skillId));
        assert.equal(
            skill.castTimeMs,
            catalogCastTimeMs[skillId] ?? values[0] * 1.5,
            `${skill.name} has the wrong catalog cast time`,
        );
    }
});

test('Counterspell is cataloged as Illusionary Counter’s clone-generating flip skill', () => {
    const counterspell = mesmerCatalog.skillsById.get(ID.COUNTERSPELL);
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
    for (const id of Object.keys(SHATTERS).map(Number)) {
        const skill = mesmerCatalog.skillsById.get(id);
        assert.deepEqual(
            skill.lockouts,
            [{ group: 'mesmer.shatter', durationMs: 50 }],
            skill.name,
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
        MESMER_SUPPLEMENTAL_SKILLS
            .filter(skill => skill.flipParentId)
            .map(skill => [
                skill.name,
                mesmerCatalog.skillsById.get(skill.flipParentId).name,
            ]),
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
    assert.equal(CLONE_ATTACKS.Dagger.coefficient, 0.5);
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

    assert.equal(CLONE_ATTACKS.Scepter.coefficient, 0.5);
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
        [ID.MIND_WRACK]: [0.81, 1.61, 2.42, 3.22],
        [ID.CRY_OF_FRUSTRATION]: [0.42, 0.84, 1.25, 1.67],
        [ID.DIVERSION]: [0, 0, 0, 0],
        [ID.DISTORTION]: [0, 0, 0, 0],
        [ID.SPLIT_SECOND]: [1.53, 3.07, 3.68, 4.3],
        [ID.REWINDER]: [0.38, 0.76, 1.14, 1.52],
        [ID.TIME_SINK]: [0, 0, 0, 0],
        [ID.BLADESONG_HARMONY]: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
        [ID.BLADESONG_SORROW]: [0, 0.42, 0.84, 1.25, 1.67, 2.09],
        [ID.BLADESONG_DISSONANCE]: [0, 1, 1, 1, 1, 1],
        [ID.BLADETURN_REQUIEM]: [0, 0.5, 1, 1.5, 2, 2.5],
        [ID.CONTINUUM_SPLIT]: [0, 0, 0, 0],
    };
    for (const [id, coefficients] of Object.entries(expectedShatters)) {
        assert.deepEqual(
            SHATTERS[id].coefficients,
            coefficients,
            mesmerCatalog.skillsById.get(Number(id)).name,
        );
    }

    assert.deepEqual(
        Object.fromEntries([
            ID.LIVELY_LUTE,
            ID.FLUSTERING_FLUTE,
            ID.DEAFENING_DRUM,
            ID.HARMONIOUS_HARP,
        ].map(id => [
            mesmerCatalog.skillsById.get(id).name,
            INSTRUMENTS[id].coefficient,
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

test('Mesmer supplemental identities, handler profiles, and trait coverage are explicit', () => {
    assert.equal(MESMER_SUPPLEMENTAL_SKILLS.length, 15);
    assert.ok(MESMER_SUPPLEMENTAL_SKILLS.every(skill => skill.id > 0));
    assert.ok(PSEUDO_SKILLS.every(skill => skill.id < 0));
    const identityFields = [
        'name',
        'description',
        'icon',
        'type',
        'slot',
        'weapon',
        'specialization',
        'environment',
        'wikiUrl',
        'flipParent',
    ];
    assert.ok(
        Object.values(MESMER_SUPPLEMENTAL_SKILL_MECHANICS)
            .every(mechanics =>
                identityFields.every(field => !Object.hasOwn(mechanics, field))),
    );
    assert.equal(MESMER_TRAIT_COVERAGE.length, mesmerCatalog.traits.length);
    assert.ok(MESMER_TRAIT_COVERAGE.every(entry => entry.effects.length > 0));

    const shared = mesmerCatalog.skillsByName.get('Mind Stab');
    assert.equal(shared.handlerId, 'mesmer.declarative');
    assert.ok(shared.effects.length > 0);
    const replacing = mesmerCatalog.skillsByName.get('Phantasmal Swordsman');
    assert.equal(replacing.handlerId, 'mesmer.phantasm');
    assert.deepEqual(replacing.effects, []);
    assert.ok(replacing.mesmerEffects.length > 0);
});

test('legacy duplicate Mesmer names resolve explicitly by specialization', () => {
    assert.deepEqual(MESMER_DUPLICATE_SKILL_NAMES, [
        'Axes of Symmetry',
        'Lingering Thoughts',
        'Bladecall',
        'Lively Lute',
        'Harmonious Harp',
    ]);
    const specializationCases = [
        ['Axes of Symmetry', 'Mirage', ID.AXES_OF_SYMMETRY],
        [
            'Axes of Symmetry',
            'Troubadour',
            ID.TROUBADOUR_AXES_OF_SYMMETRY,
        ],
        ['Lingering Thoughts', 'Mirage', ID.LINGERING_THOUGHTS],
        [
            'Lingering Thoughts',
            'Troubadour',
            ID.TROUBADOUR_LINGERING_THOUGHTS,
        ],
        ['Bladecall', 'Virtuoso', ID.BLADECALL],
        ['Bladecall', 'Troubadour', ID.TROUBADOUR_BLADECALL],
        ['Lively Lute', 'Troubadour', ID.LIVELY_LUTE_ALTERNATE],
        ['Harmonious Harp', 'Troubadour', ID.HARMONIOUS_HARP_ALTERNATE],
    ];
    for (const [name, specialization, expectedId] of specializationCases) {
        assert.equal(
            resolveMesmerLegacySkillId(name, { specialization }),
            expectedId,
            `${specialization} ${name}`,
        );
    }
    for (const name of [
        'Axes of Symmetry',
        'Lingering Thoughts',
        'Lively Lute',
        'Harmonious Harp',
    ]) {
        assert.equal(resolveMesmerLegacySkillId(name), null, name);
        assert.equal(
            resolveMesmerLegacySkillId(name, {
                specialization: 'Chronomancer',
            }),
            null,
            name,
        );
    }
    assert.equal(resolveMesmerLegacySkillId('Bladecall'), ID.BLADECALL);
    assert.equal(
        resolveMesmerLegacySkillId('Mind Stab', {
            specialization: 'Mirage',
        }),
        undefined,
    );
    for (const name of MESMER_DUPLICATE_SKILL_NAMES) {
        assert.ok(Number.isInteger(defaultMesmerLegacySkillId(name)), name);
    }
});
