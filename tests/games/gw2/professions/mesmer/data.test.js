import { MESMER_CORE_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/core/skills/index.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSkillMechanics } from '#tests/helpers/skill-mechanics.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { SKILLS } from '#gw2/professions/mesmer/data/mesmer-api-metadata.js';
import { SKILLS as GUARDIAN_API_SKILLS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';

import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild
} from '#gw2/professions/mesmer/build/build.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/mesmer/data/mesmer-supplemental-skills.js';
import {
  MESMER_CORE_BALANCE_PROFILE_IDS,
  MESMER_CORE_SHATTER_PROFILE_IDS,
  mesmerProfiledShatters
} from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_CORE_CLONE_ATTACKS as CLONE_ATTACKS } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_CORE_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/index.js';
import { MESMER_CORE_EXTRA_SKILLS } from '#gw2/professions/mesmer/core/skills/actions.js';
import { MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/supplemental-skills.js';
import { CHRONOMANCER_BALANCE_PROFILE_IDS } from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';
import { MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import {
  MESMER_CHRONOMANCER_EXTRA_SKILLS,
  MESMER_CHRONOMANCER_SKILL_MECHANICS,
  MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import {
  MIRAGE_AMBUSH_PROFILE_IDS,
  MIRAGE_BALANCE_PROFILE_IDS,
  mesmerProfiledAmbush
} from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS,
  MESMER_MIRAGE_AMBUSH_SKILLS as AMBUSH_ATTACKS
} from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { VIRTUOSO_BALANCE_PROFILE_IDS } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';
import { MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import {
  TROUBADOUR_BALANCE_PROFILE_IDS,
  TROUBADOUR_INSTRUMENT_PROFILE_IDS,
  mesmerProfiledInstrument
} from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import { MESMER_TROUBADOUR_INSTRUMENTS as INSTRUMENTS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import {
  defaultMesmerSkillIdForDuplicateName,
  MESMER_DUPLICATE_SKILL_NAMES,
  resolveMesmerSkillIdFromDuplicateName
} from '#gw2/professions/mesmer/data/duplicate-skill-names.js';

const MECHANIC_SKILLS = Object.freeze({
  Core: Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]),
  Chronomancer: Object.freeze([ID.SPLIT_SECOND, ID.REWINDER, ID.TIME_SINK, ID.DISTORTION, ID.CONTINUUM_SPLIT]),
  Mirage: Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]),
  Virtuoso: Object.freeze([
    ID.BLADESONG_HARMONY,
    ID.BLADESONG_SORROW,
    ID.BLADESONG_DISSONANCE,
    ID.BLADESONG_DISTORTION,
    ID.BLADETURN_REQUIEM
  ]),
  Troubadour: Object.freeze([
    ID.LIVELY_LUTE,
    ID.FLUSTERING_FLUTE,
    ID.DEAFENING_DRUM,
    ID.HARMONIOUS_HARP_ALTERNATE,
    ID.CRESCENDO
  ])
});

const SHATTERS = Object.freeze({
  ...MESMER_CORE_SHATTERS,
  ...MESMER_CHRONOMANCER_SHATTERS,
  ...MESMER_VIRTUOSO_SHATTERS
});

const MESMER_SKILL_MECHANICS = composeSkillMechanics('Mesmer', [
  MESMER_CORE_SKILL_MECHANICS,
  MESMER_CHRONOMANCER_SKILL_MECHANICS,
  MESMER_MIRAGE_SKILL_MECHANICS,
  MESMER_VIRTUOSO_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SKILL_MECHANICS
]);

const MESMER_SUPPLEMENTAL_SKILL_MECHANICS = composeSkillMechanics('Mesmer supplemental', [
  MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS,
  MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
]);

const PSEUDO_SKILLS = Object.freeze([
  ...MESMER_CORE_EXTRA_SKILLS,
  ...MESMER_CHRONOMANCER_EXTRA_SKILLS,
  ...MESMER_MIRAGE_EXTRA_SKILLS.filter((skill) => skill.id < 0),
  ...MESMER_TROUBADOUR_EXTRA_SKILLS
]);

const AMBUSH_SKILLS = Object.freeze(Object.values(AMBUSH_ATTACKS));

const phantasmTimingIds = new Set([
  ...Object.keys(MESMER_CORE_PHANTASM_ATTACK_TIMINGS),
  ...Object.keys(MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS),
  ...Object.keys(MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS)
]);
const PHANTASM_ATTACK_TIMINGS = Object.freeze(
  Object.fromEntries(
    [...phantasmTimingIds].map((id) => [
      Number(id),
      {
        ...MESMER_CORE_PHANTASM_ATTACK_TIMINGS[Number(id)],
        ...MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS[Number(id)],
        ...MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS[Number(id)]
      }
    ])
  )
);

const catalogSkill = (name) => mesmerCatalog.skillsByName.get(name);
const strikeEffects = (skill) => skill.effects.filter((effect) => effect.type === 'strike');

const applyMesmerPatch = (patch) => applyBalanceProfilePatch(applySkillPatch(mesmerCatalog, patch), patch);

// Keeps the public Core index contract while the named files own supplemental fragments and actions.
const authoringMesmerProfession = withActivePatchPreview(mesmerProfession);

// Follow-up tooltips expose the same window and recharge units used by the runtime.
test('Mesmer follow-up facts show canonical windows and a percentage of parent base recharge', () => {
  const factsFor = (id) => mesmerAppAdapter.skillTooltip(mesmerCatalog.skillsById.get(id)).facts;
  for (const [id, duration] of [
    [ID.SINGULARITY_SHOT, '3s'],
    [ID.INSPIRING_IMAGERY, '2s']
  ]) {
    assert.equal(factsFor(id).find((fact) => fact.name === 'Follow-up window')?.detail, duration);
  }

  assert.equal(
    factsFor(ID.DIMENSIONAL_APERTURE).find((fact) => fact.name === 'Additional parent recharge')?.detail,
    '+50% of parent base recharge'
  );
  assert.equal(
    factsFor(ID.MIND_SLASH).some((fact) => ['Follow-up window', 'Additional parent recharge'].includes(fact.name)),
    false
  );
});

// Include generated packets, clone gains, and phantasm overrides in the authored timing contract.
test('Mesmer authored damage and resource offsets use ordered action ticks', () => {
  const check = (value, path = 'Mesmer', key = '') => {
    if (value == null) return;
    if (typeof value === 'number') {
      if (
        ![
          'atMs',
          'intervalMs',
          'startMs',
          'damageAtMs',
          'repeatDamageAtMs',
          'damageAtMsByEntity',
          'repeatDamageAtMsByEntity'
        ].includes(key)
      )
        return;
      assert.ok(Number.isFinite(value), `${path}: invalid offset ${value}`);
      assert.ok(Math.abs(value - Math.round(value / 40) * 40) <= 1e-6, `${path}: off-grid offset ${value}`);
    } else if (Array.isArray(value)) {
      if (value.every((tick) => tick?.atMs != null && tick.type == null)) {
        assert.ok(
          value.every((tick, index) => tick.atMs >= 0 && (index === 0 || tick.atMs >= value[index - 1].atMs)),
          `${path}: unordered packets`
        );
      }

      value.forEach((item, index) => check(item, `${path}[${index}]`, key));
    } else if (typeof value === 'object') {
      for (const [name, item] of Object.entries(value)) check(item, `${path}.${name}`, name);
    }
  };

  check({
    skills: mesmerCatalog.skills.map(({ id, effects, resource, trackedHitDamage, comboFields, damageAtMs }) => ({
      id,
      effects,
      resource,
      trackedHitDamage,
      comboFields,
      damageAtMs
    })),
    balanceProfiles: mesmerCatalog.balanceProfiles,
    clones: CLONE_ATTACKS,
    phantasms: MESMER_CORE_PHANTASM_ATTACK_TIMINGS,
    repeatPhantasms: MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
    instruments: INSTRUMENTS
  });
});

test('Mesmer modules expose isolated balance-profile authoring', () => {
  const modules = new Map(authoringMesmerProfession.patchAuthoring.modules.map((module) => [module.id, module]));

  assert.deepEqual([...modules.keys()], ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']);
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true
  );

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === 'function' || typeof rule.factor === 'function') &&
        Object.keys(rule.parameters).length === 0
    )
  );

  assert.deepEqual(opaqueModifierRules, []);

  // Keep the live catalog isolated while exercising skill, profile, and runtime projection patch consumers.
  const originalCooldown = mesmerCatalog.skillsById.get(ID.MIND_WRACK).cooldown;
  const originalAttribute = mesmerCatalog.balanceProfilesById.get(
    MESMER_CORE_BALANCE_PROFILE_IDS.fencersFinesse
  ).attributePerStack;
  const preview = applyMesmerPatch({
    skills: {
      [ID.MIND_WRACK]: {
        fields: { cooldown: 10 }
      }
    },
    balanceProfiles: {
      [MESMER_CORE_BALANCE_PROFILE_IDS.mindWrack]: {
        effects: [{ effectIndex: 1, coefficient: 1.75 }]
      },
      [MESMER_CORE_BALANCE_PROFILE_IDS.cryOfFrustration]: {
        effects: [{ effectIndex: 4, duration: 4 }]
      },
      [MESMER_CORE_BALANCE_PROFILE_IDS.fencersFinesse]: {
        fields: { attributePerStack: 20 }
      },
      [CHRONOMANCER_BALANCE_PROFILE_IDS.dangerTime]: {
        fields: { durationMultiplier: 12 }
      },
      [CHRONOMANCER_BALANCE_PROFILE_IDS.seizeTheMoment]: {
        fields: { durationPerTier: 2 },
        effects: [
          {
            effectIndex: 0,
            duration: 4,
            audience: { maximumRecipients: 10 }
          }
        ]
      },
      [MIRAGE_BALANCE_PROFILE_IDS.imaginaryAxes]: {
        effects: [{ effectIndex: 0, coefficient: 1.1 }]
      },
      [VIRTUOSO_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: 6 }
      },
      [TROUBADOUR_BALANCE_PROFILE_IDS.livelyLute]: {
        effects: [{ effectIndex: 0, tickIndex: 0, coefficient: 1.2 }]
      },
      [TROUBADOUR_BALANCE_PROFILE_IDS.crescendo]: {
        fields: { damageIncreasePerStack: 0.3 },
        effects: [{ effectIndex: 0, coefficient: 2.5 }]
      }
    }
  });

  assert.equal(preview.skillsById.get(ID.MIND_WRACK).cooldown, 10);
  assert.equal(
    preview.balanceProfilesById.get(MESMER_CORE_BALANCE_PROFILE_IDS.cryOfFrustration).effects[4].duration,
    4
  );
  assert.equal(preview.balanceProfilesById.get(MESMER_CORE_BALANCE_PROFILE_IDS.fencersFinesse).attributePerStack, 20);
  assert.equal(preview.balanceProfilesById.get(CHRONOMANCER_BALANCE_PROFILE_IDS.dangerTime).durationMultiplier, 12);
  assert.equal(preview.balanceProfilesById.get(CHRONOMANCER_BALANCE_PROFILE_IDS.seizeTheMoment).durationPerTier, 2);
  const originalBoon = mesmerCatalog.balanceProfilesById.get(CHRONOMANCER_BALANCE_PROFILE_IDS.seizeTheMoment)
    .effects[0];
  assert.deepEqual(preview.balanceProfilesById.get(CHRONOMANCER_BALANCE_PROFILE_IDS.seizeTheMoment).effects[0], {
    ...originalBoon,
    duration: 4,
    audience: { ...originalBoon.audience, maximumRecipients: 10 }
  });
  assert.equal(preview.balanceProfilesById.get(VIRTUOSO_BALANCE_PROFILE_IDS.resources).maximumStacks, 6);
  assert.equal(preview.balanceProfilesById.get(TROUBADOUR_BALANCE_PROFILE_IDS.crescendo).effects[0].coefficient, 2.5);
  assert.equal(preview.balanceProfilesById.get(TROUBADOUR_BALANCE_PROFILE_IDS.crescendo).damageIncreasePerStack, 0.3);

  const profiledShatter = mesmerProfiledShatters(
    { catalog: preview },
    { [ID.MIND_WRACK]: SHATTERS[ID.MIND_WRACK] },
    MESMER_CORE_SHATTER_PROFILE_IDS
  )[ID.MIND_WRACK];

  const originalShatter = mesmerProfiledShatters(
    { catalog: mesmerCatalog },
    { [ID.MIND_WRACK]: SHATTERS[ID.MIND_WRACK] },
    MESMER_CORE_SHATTER_PROFILE_IDS
  )[ID.MIND_WRACK];
  assert.deepEqual(
    profiledShatter.strikes,
    originalShatter.strikes.map((strike, index) => (index === 1 ? { ...strike, coefficient: 1.75 } : strike))
  );
  assert.equal(
    mesmerProfiledAmbush({ catalog: preview }, AMBUSH_ATTACKS.Axe, MIRAGE_AMBUSH_PROFILE_IDS.Axe).player.coefficient,
    1.1
  );
  assert.deepEqual(
    mesmerProfiledInstrument(
      { catalog: preview },
      INSTRUMENTS[ID.LIVELY_LUTE],
      TROUBADOUR_INSTRUMENT_PROFILE_IDS[ID.LIVELY_LUTE]
    ).ticks,
    mesmerCatalog.balanceProfilesById
      .get(TROUBADOUR_BALANCE_PROFILE_IDS.livelyLute)
      .effects[0].ticks.map((tick, index) => (index === 0 ? { ...tick, coefficient: 1.2 } : tick))
  );

  assert.equal(mesmerCatalog.skillsById.get(ID.MIND_WRACK).cooldown, originalCooldown);
  assert.equal(
    mesmerCatalog.balanceProfilesById.get(MESMER_CORE_BALANCE_PROFILE_IDS.fencersFinesse).attributePerStack,
    originalAttribute
  );
});

test('Mesmer and Guardian API catalogs share common fields and explicit ammo lockouts', () => {
  const expectedKeys = Object.keys(GUARDIAN_API_SKILLS[0])
    .filter((key) => key !== 'ammoCastLockout')
    .sort();

  for (const skill of [...SKILLS, ...GUARDIAN_API_SKILLS]) {
    assert.deepEqual(
      Object.keys(skill)
        .filter((key) => key !== 'ammoCastLockout')
        .sort(),
      expectedKeys,
      skill.name
    );
    assert.equal(Object.hasOwn(skill, 'ammoCastLockout'), skill.ammo > 0, skill.name);
  }
});

test('Mesmer mechanics are the sole simulation source and use stable skill ids', () => {
  assert.equal(
    Object.keys(MESMER_SKILL_MECHANICS).every((id) => Number.isInteger(Number(id))),
    true
  );
  for (const skill of SKILLS) {
    assert.ok(MESMER_SKILL_MECHANICS[skill.id], `${skill.name} is missing authoritative simulation mechanics`);
  }

  assert.equal(MESMER_SKILL_MECHANICS['Winds of Chaos'], undefined);
  // Bladecall variants share strike definitions; interruption persistence belongs to each specialization's cast.
  const bladecallEffects = (id) =>
    MESMER_SKILL_MECHANICS[id].effects.map((effect) => ({ ...effect, persistsAfterInterrupt: undefined }));
  assert.deepEqual(bladecallEffects(ID.TROUBADOUR_BLADECALL), bladecallEffects(ID.BLADECALL));
  assert.equal(
    MESMER_SKILL_MECHANICS[ID.TROUBADOUR_BLADECALL].castTimeMs,
    MESMER_SKILL_MECHANICS[ID.BLADECALL].castTimeMs
  );
  assert.equal(
    Object.values(MESMER_SKILL_MECHANICS).some((mechanics) => mechanics.blade === false),
    false
  );
  // Generated metadata owns identity and ordinary recharge; fragments retain only deliberate runtime overrides.
  assert.ok(
    Object.values(MESMER_SKILL_MECHANICS).every(
      (mechanics) => !Object.hasOwn(mechanics, 'type') && !Object.hasOwn(mechanics, 'weapon')
    )
  );
  assert.deepEqual(
    Object.entries(MESMER_SKILL_MECHANICS)
      .filter(([, mechanics]) => Object.hasOwn(mechanics, 'specialization'))
      .map(([id]) => Number(id))
      .sort((left, right) => left - right),
    [ID.FLYING_CUTTER, ID.UNSTABLE_BLADESTORM].sort((left, right) => left - right)
  );
  assert.deepEqual(
    Object.entries(MESMER_SKILL_MECHANICS)
      .filter(([, mechanics]) => Object.hasOwn(mechanics, 'cooldown'))
      .map(([id]) => Number(id))
      .sort((left, right) => left - right),
    [ID.LINGERING_THOUGHTS, ID.JAUNT, ID.VIRTUOSO_TROUBADOUR_LINGERING_THOUGHTS, ID.TALE_OF_THE_HONORABLE_ROGUE].sort(
      (left, right) => left - right
    )
  );
  assert.equal(MESMER_SKILL_MECHANICS[ID.FLYING_CUTTER].specialization, '');
  assert.equal(MESMER_SKILL_MECHANICS[ID.UNSTABLE_BLADESTORM].specialization, '');
  assert.equal(SHATTERS[ID.MIND_WRACK].resolver, 'mesmer.core.clone-shatter');
  assert.equal(SHATTERS[ID.BLADESONG_HARMONY].resolver, 'mesmer.virtuoso.bladesong');
  assert.equal(SHATTERS[ID.BLADESONG_HARMONY].minimumResource, 1);
});

test('every Mesmer catalog skill exposes normalized effects', () => {
  assert.equal(
    mesmerCatalog.skills.every((skill) => Array.isArray(skill.effects)),
    true
  );
  assert.equal(mesmerCatalog.skillsByName.get('Bladecall').id, ID.BLADECALL);
});

test('Mesmer relic options exclude profession-inapplicable relics', () => {
  const excluded = ['Krait', 'Weaver', 'Fire'];

  assert.equal(mesmerAppAdapter.relicNames.includes('Claw'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Director'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Mount Balrior'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Nourys'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Steamshrieker'), true);
  assert.deepEqual(
    mesmerAppAdapter.relicNames.filter((name) => excluded.includes(name)),
    []
  );
});

test('each profession variant has a complete mechanic bar', () => {
  assert.equal(MECHANIC_SKILLS.Core.length, 4);
  assert.equal(MECHANIC_SKILLS.Chronomancer.length, 5);
  assert.equal(MECHANIC_SKILLS.Mirage.length, 4);
  assert.equal(MECHANIC_SKILLS.Virtuoso.length, 5);
  assert.equal(MECHANIC_SKILLS.Troubadour.length, 5);
});

test('Chronomancer owns its Continuum Shift palette projection', () => {
  const group = mesmerProfession.ui.paletteGroups({
    specialization: 'Chronomancer',
    catalog: mesmerCatalog
  })[0];

  assert.deepEqual(group.skillIds, [...MECHANIC_SKILLS.Chronomancer, ID.CONTINUUM_SHIFT]);
  assert.equal(group.includeActionSkills, true);
});

test('every cataloged phantasm has an attack timing before clone conversion', () => {
  const phantasms = SKILLS.map((skill) => mesmerCatalog.skillsById.get(skill.id)).filter(
    (skill) => skill.resource?.mode === 'phantasm'
  );

  assert.deepEqual(
    phantasms.map((skill) => skill.name),
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
      'Phantasmal Lancer'
    ]
  );
  for (const skill of phantasms) {
    const timing = PHANTASM_ATTACK_TIMINGS[skill.id];

    assert.ok(timing, `${skill.name} is missing a phantasm attack timing`);
    assert.ok(timing.damageAtMs > 0, `${skill.name} has an invalid damage time`);
    assert.ok(timing.spawnAtMs >= timing.damageAtMs, `${skill.name} converts before damage ends`);
    assert.ok(timing.repeatDamageAtMs >= timing.damageAtMs, `${skill.name} has an invalid Chronophantasma damage time`);
    assert.ok(timing.repeatSpawnAtMs >= timing.repeatDamageAtMs, `${skill.name} converts before its repeat ends`);
    for (const [index, damageAtMs] of timing.damageAtMsByEntity?.entries() ?? []) {
      assert.ok(
        (timing.spawnAtMsByEntity?.[index] ?? timing.spawnAtMs) >= damageAtMs,
        `${skill.name} entity ${index} converts before damage ends`
      );
    }

    for (const [index, damageAtMs] of timing.repeatDamageAtMsByEntity?.entries() ?? []) {
      assert.ok(
        (timing.repeatSpawnAtMsByEntity?.[index] ?? timing.repeatSpawnAtMs) >= damageAtMs,
        `${skill.name} repeat entity ${index} converts before damage ends`
      );
    }
  }
});

test("Counterspell is cataloged as Illusionary Counter's clone-generating flip skill", () => {
  const counterspell = mesmerCatalog.skillsById.get(ID.COUNTERSPELL);

  assert.equal(counterspell.id, 10314);
  assert.equal(counterspell.weapon, 'Scepter');
  assert.deepEqual(counterspell.resource, { mode: 'add', count: 1, timingAnchor: 'castStart', atMs: 360 });
  assert.equal(counterspell.retainsCastLockoutAfterInterrupt, true);
});

test('Mesmer instant-cast skills have zero cast time', () => {
  const instantSkills = [
    'Cry of Frustration',
    'Mind Wrack',
    'Distortion',
    'Mirror Images',
    'Signet of Midnight',
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
    'Continuum Shift'
  ];

  for (const name of instantSkills) {
    const skill = catalogSkill(name);

    assert.equal(skill.castTimeMs, 0, name);
  }

  const prestige = catalogSkill('The Prestige');

  assert.equal(prestige.castTimeMs, 40);
});

test('Mesmer shatters share only the shatter-family lockout', () => {
  for (const id of Object.keys(SHATTERS).map(Number)) {
    const skill = mesmerCatalog.skillsById.get(id);

    assert.deepEqual(skill.lockouts, [{ group: 'mesmer.shatter', durationMs: 50 }], skill.name);
  }

  assert.deepEqual(catalogSkill('Power Spike').lockouts, []);
  assert.deepEqual(catalogSkill('Mirror Images').lockouts, []);
});

test('Mesmer weapon autoattacks are cataloged as individual chain skills', () => {
  const expectedChains = [
    [ID.MIND_SLASH, ID.MIND_GASH, ID.MIND_SPIKE],
    [ID.ETHER_BOLT, ID.ETHER_BLAST, ID.ETHER_CLONE],
    [ID.LACERATING_CHOP, ID.ETHEREAL_CHOP, ID.MIRROR_STRIKES],
    [ID.PSYCUT, ID.PSYSTRIKE, ID.MIND_PIERCE]
  ];

  assert.deepEqual(mesmerCatalog.autoattackChains, expectedChains);
  for (const chain of expectedChains) {
    const [rootId, ...childIds] = chain;
    const rootSkill = mesmerCatalog.skillsById.get(rootId);

    assert.equal(strikeEffects(rootSkill)[0].ticks?.length ?? strikeEffects(rootSkill)[0].hits, 1);
    assert.notEqual(strikeEffects(rootSkill)[0].name, 'Full autoattack chain');
    assert.equal(rootSkill.chainRoot, rootId);
    assert.equal(rootSkill.chainStep, 1);
    assert.equal(rootSkill.nextChainId, childIds[0]);
    chain.forEach((skillId, index) => {
      const nextChainId = chain[index + 1] ?? null;

      assert.equal(SKILLS.find((skill) => skill.id === skillId).nextChainId, nextChainId);
      assert.equal(mesmerCatalog.skillsById.get(skillId).nextChainId, nextChainId);
    });
  }
});

test('requested rifle, focus, and sword sequence flips are cataloged', () => {
  for (const skill of MESMER_SUPPLEMENTAL_SKILLS.filter((candidate) => candidate.flipParentId)) {
    assert.equal(mesmerCatalog.skillsById.get(skill.id).flipParentId, skill.flipParentId);
  }

  assert.deepEqual(
    MESMER_SUPPLEMENTAL_SKILLS.filter((skill) => skill.flipParentId).map((skill) => [
      skill.name,
      mesmerCatalog.skillsById.get(skill.flipParentId).name
    ]),
    [
      ['Counterspell', 'Illusionary Counter'],
      ['Power Spike', 'Mantra of Pain'],
      ['Dimensional Aperture', 'Singularity Shot'],
      ['Abstraction', 'Inspiring Imagery'],
      ['Into the Void', 'Temporal Curtain'],
      ['Counter Blade', 'Illusionary Riposte'],
      ['Swap', 'Illusionary Leap']
    ]
  );
});

test('every terrestrial Mirage main-hand weapon has a selectable ambush skill', () => {
  assert.deepEqual(
    AMBUSH_SKILLS.map((skill) => [skill.weapon, skill.name]),
    [
      ['Axe', 'Imaginary Axes'],
      ['Dagger', 'Phantom Razor'],
      ['Greatsword', 'Split Surge'],
      ['Rifle', 'Effervescence'],
      ['Scepter', 'Ether Barrage'],
      ['Spear', 'Fractured Glass'],
      ['Staff', 'Chaos Vortex'],
      ['Sword', 'Mirage Thrust']
    ]
  );
  assert.ok(
    AMBUSH_SKILLS.every(
      (skill) => skill.ambush && skill.specialization === 'Mirage' && skill.slot === 'Weapon_1' && skill.icon
    )
  );
  // Catalog loading must retain the actor variants on the same skill that selects the ambush handler.
  for (const skill of AMBUSH_SKILLS) {
    const loaded = mesmerCatalog.skillsById.get(skill.id);
    assert.equal(loaded.ambush, true);
    assert.deepEqual(loaded.player, skill.player);
    assert.deepEqual(loaded.clone, skill.clone);
  }
});

test('Mirage dodge spends endurance without ammo or cooldown', () => {
  const dodge = PSEUDO_SKILLS.find((skill) => skill.name === 'Dodge / Mirage Cloak');

  assert.equal(dodge.cooldown, 0);
  assert.equal(dodge.ammo, undefined);
  assert.equal(dodge.resourceCost, 50);
  assert.equal(dodge.castTimeMs, 0);
});

test('Mesmer supplemental identities and dynamic handler profiles are explicit', () => {
  assert.ok(MESMER_SUPPLEMENTAL_SKILLS.every((skill) => skill.id > 0));
  assert.ok(PSEUDO_SKILLS.every((skill) => skill.id < 0));
  const identityFields = ['name', 'description', 'icon', 'type', 'slot', 'weapon', 'specialization', 'flipParent'];

  assert.ok(
    Object.values(MESMER_SUPPLEMENTAL_SKILL_MECHANICS).every((mechanics) =>
      identityFields.every((field) => !Object.hasOwn(mechanics, field))
    )
  );
  const shared = mesmerCatalog.skillsByName.get('Mind Stab');

  assert.equal(shared.handlerId, undefined);
  assert.ok(shared.effects.length > 0);
  const replacing = mesmerCatalog.skillsByName.get('Phantasmal Swordsman');

  assert.equal(replacing.phantasm, true);
  assert.ok(replacing.effects.length > 0);
});

test('every Mesmer specialization registers native owners without scheduler handlers', () => {
  for (const specialization of ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']) {
    const runtime = mesmerProfession.runtimeFor({ specialization });
    assert.equal(typeof runtime.initialize, 'function');
    assert.ok(runtime.catalog.skills.every((skill) => skill.handlerId == null));
    assert.equal(typeof runtime.tasks['mesmer.clone-attack'], 'function');
  }
});

test('duplicate Mesmer skill names resolve explicitly by specialization', () => {
  assert.deepEqual(MESMER_DUPLICATE_SKILL_NAMES, [
    'Axes of Symmetry',
    'Lingering Thoughts',
    'Bladecall',
    'Lively Lute',
    'Harmonious Harp'
  ]);
  const specializationCases = [
    ['Axes of Symmetry', 'Core', ID.AXES_OF_SYMMETRY],
    ['Axes of Symmetry', 'Chronomancer', ID.AXES_OF_SYMMETRY],
    ['Axes of Symmetry', 'Virtuoso', ID.VIRTUOSO_TROUBADOUR_AXES_OF_SYMMETRY],
    ['Axes of Symmetry', 'Mirage', ID.AXES_OF_SYMMETRY],
    ['Axes of Symmetry', 'Troubadour', ID.VIRTUOSO_TROUBADOUR_AXES_OF_SYMMETRY],
    ['Lingering Thoughts', 'Mirage', ID.LINGERING_THOUGHTS],
    ['Lingering Thoughts', 'Core', ID.LINGERING_THOUGHTS],
    ['Lingering Thoughts', 'Chronomancer', ID.LINGERING_THOUGHTS],
    ['Lingering Thoughts', 'Virtuoso', ID.VIRTUOSO_TROUBADOUR_LINGERING_THOUGHTS],
    ['Lingering Thoughts', 'Troubadour', ID.VIRTUOSO_TROUBADOUR_LINGERING_THOUGHTS],
    ['Bladecall', 'Virtuoso', ID.BLADECALL],
    ['Bladecall', 'Troubadour', ID.TROUBADOUR_BLADECALL],
    ['Lively Lute', 'Troubadour', ID.LIVELY_LUTE],
    ['Harmonious Harp', 'Troubadour', ID.HARMONIOUS_HARP_ALTERNATE]
  ];

  for (const [name, specialization, expectedId] of specializationCases) {
    assert.equal(
      resolveMesmerSkillIdFromDuplicateName(name, { specialization }),
      expectedId,
      `${specialization} ${name}`
    );
  }

  for (const name of ['Axes of Symmetry', 'Lingering Thoughts', 'Lively Lute', 'Harmonious Harp']) {
    assert.equal(resolveMesmerSkillIdFromDuplicateName(name), null, name);
    assert.equal(
      resolveMesmerSkillIdFromDuplicateName(name, {
        specialization: 'Unknown'
      }),
      null,
      name
    );
  }

  assert.equal(resolveMesmerSkillIdFromDuplicateName('Bladecall'), ID.BLADECALL);
  assert.equal(
    resolveMesmerSkillIdFromDuplicateName('Mind Stab', {
      specialization: 'Mirage'
    }),
    undefined
  );
  for (const name of MESMER_DUPLICATE_SKILL_NAMES) {
    assert.ok(Number.isInteger(defaultMesmerSkillIdForDuplicateName(name)), name);
  }
});

// Legacy strings and named cast objects must load the same Virtuoso Axe skills as stable IDs.
test('Virtuoso Axe name migration is equivalent to ID migration', () => {
  const build = { ...createMesmerBuildDefaults(), weapons: ['Axe', 'Sword'] };
  for (const [name, skillId] of [
    ['Lingering Thoughts', ID.VIRTUOSO_TROUBADOUR_LINGERING_THOUGHTS],
    ['Axes of Symmetry', ID.VIRTUOSO_TROUBADOUR_AXES_OF_SYMMETRY]
  ]) {
    const byId = migrateMesmerBuild({ ...build, rotation: [{ type: 'cast', skillId }] });
    for (const entry of [name, { type: 'cast', name }]) {
      const byName = migrateMesmerBuild({ ...build, rotation: [entry] });
      assert.deepEqual(byName.rotation, byId.rotation);
      assert.equal(validateMesmerBuild(byName).valid, true);
    }
  }
});
