import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  authoringNumericFieldLabel,
  compactPatchPreview,
  createEffectTemplate,
  effectDetail,
  generatePatchOverview,
  groupPatchAuthoringSkills,
  numericEditForValue,
  numericEditValue,
  patchSearchText
} from '#gw2/integrations/patches/app/model.js';
import { editorState, loadEditorPayload, setNumericEdit } from '#gw2/integrations/patches/app/editor-state.js';
import {
  balanceProfileAuthoringReference,
  balanceProfileEffectNumericFieldTier,
  balanceProfileHasAuthorableControls,
  balanceProfileNumericFieldTier,
  balanceProfilePatchableNumericFields,
  skillAuthoringReference,
  skillPatchableNumericFields
} from '#gw2/integrations/patches/authoring/fields.js';
import { elementalistProfession as baseElementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { engineerProfession as baseEngineerProfession } from '#gw2/professions/engineer/definition.js';
import { guardianProfession as baseGuardianProfession } from '#gw2/professions/guardian/definition.js';
import { mesmerProfession as baseMesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { necromancerProfession as baseNecromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { rangerProfession as baseRangerProfession } from '#gw2/professions/ranger/definition.js';
import { revenantProfession as baseRevenantProfession } from '#gw2/professions/revenant/definition.js';
import { thiefProfession as baseThiefProfession } from '#gw2/professions/thief/definition.js';
import { warriorProfession as baseWarriorProfession } from '#gw2/professions/warrior/definition.js';

const elementalistProfession = withActivePatchPreview(baseElementalistProfession);
const engineerProfession = withActivePatchPreview(baseEngineerProfession);
const guardianProfession = withActivePatchPreview(baseGuardianProfession);
const mesmerProfession = withActivePatchPreview(baseMesmerProfession);
const necromancerProfession = withActivePatchPreview(baseNecromancerProfession);
const rangerProfession = withActivePatchPreview(baseRangerProfession);
const revenantProfession = withActivePatchPreview(baseRevenantProfession);
const thiefProfession = withActivePatchPreview(baseThiefProfession);
const warriorProfession = withActivePatchPreview(baseWarriorProfession);

test('patch preview decorates the neutral profession without changing its runtime contract', () => {
  assert.equal('patchAuthoring' in baseWarriorProfession, false);
  assert.equal(warriorProfession.nativeDefinition, baseWarriorProfession.nativeDefinition);
  assert.equal(warriorProfession.catalog, baseWarriorProfession.catalog);
  assert.equal(warriorProfession.patchAuthoring.professionId, 'warrior');
});

test('patch authoring omits unused skills but retains indirect runtime skills', () => {
  const engineerSkills = engineerProfession.patchAuthoring.modules.flatMap((module) => module.skills);
  const engineerSkillIds = new Set(engineerSkills.map((entry) => entry.id));
  const engineerSkillNames = new Set(engineerSkills.map((entry) => entry.name));

  for (const unusedName of [
    'Elixir B',
    'Elixir C',
    'Detonate Elixir H',
    'Blessing of Dwayna',
    'Blessing of Kormir',
    'Blessing of Lyssa',
    'Eat Wurm Egg',
    'Eat Owl Egg'
  ]) {
    assert.equal(engineerSkillNames.has(unusedName), false, unusedName);
  }

  for (const unusedId of [5865, 29591, 29991, 30881]) {
    assert.equal(engineerSkillIds.has(unusedId), false, String(unusedId));
  }

  for (const usedId of [21659]) {
    assert.equal(engineerSkillIds.has(usedId), true, String(usedId));
  }

  const lesserGrenadeBarrage = engineerSkills.find((entry) => entry.name === 'Lesser Grenade Barrage');

  assert.match(lesserGrenadeBarrage.skill.icon, /^https:\/\/render\.guildwars2\.com\//);

  const bandTogetherVariants = revenantProfession.patchAuthoring.modules
    .flatMap((module) => module.skills)
    .filter((entry) => entry.skill.variantBadge === 'Band Together');

  assert.equal(bandTogetherVariants.length, 4);
});

test('patch authoring omits unreachable Thief skills but keeps live stolen and artifact skills', () => {
  const skills = thiefProfession.patchAuthoring.modules.flatMap((module) => module.skills);
  const ids = new Set(skills.map((entry) => entry.id));
  const names = new Set(skills.map((entry) => entry.name));

  for (const unusedName of [
    'Branch Leap',
    'Eat Egg',
    'Bone Crack',
    'Lesser Caltrops',
    'Antivenom Draught: Backfired'
  ]) {
    assert.equal(names.has(unusedName), false, unusedName);
  }

  for (const usedId of [1110, 1123, 1162, 76702]) {
    assert.equal(ids.has(usedId), true, String(usedId));
  }
});

test('patch authoring omits unreachable skills for the remaining professions', () => {
  const skillsFor = (profession) => profession.patchAuthoring.modules.flatMap((module) => module.skills);
  const idsFor = (profession) => new Set(skillsFor(profession).map((entry) => entry.id));
  const namesFor = (profession) => new Set(skillsFor(profession).map((entry) => entry.name));

  const necromancerNames = namesFor(necromancerProfession);

  for (const unusedName of ['Consume Conditions', 'Spectral Walk', 'Weapon of Warding']) {
    assert.equal(necromancerNames.has(unusedName), false, unusedName);
  }

  const guardianNames = namesFor(guardianProfession);
  const guardianIds = idsFor(guardianProfession);

  for (const unusedName of [
    '"Advance!"',
    'Mantra of Lore',
    'Opening Passage',
    'Clarified Conclusion',
    'Valorous Stance'
  ]) {
    assert.equal(guardianNames.has(unusedName), false, unusedName);
  }

  assert.equal(guardianNames.has('Chapter 1: Searing Spell'), true);
  for (const unusedId of [44846, 62532, 78604, 78770]) {
    assert.equal(guardianIds.has(unusedId), false, String(unusedId));
  }

  for (const usedId of [9168, 62648, 78514, 78358]) {
    assert.equal(guardianIds.has(usedId), true, String(usedId));
  }

  const warriorIds = idsFor(warriorProfession);

  for (const unusedId of [14372, 14422, 30435, 69297, 69433, 14443, 30989, 39972, 62804]) {
    assert.equal(warriorIds.has(unusedId), false, String(unusedId));
  }

  for (const usedId of [14353, 30185, 45252]) {
    assert.equal(warriorIds.has(usedId), true, String(usedId));
  }

  const rangerIds = idsFor(rangerProfession);

  for (const unusedId of [42809, 59554, 64882, 67382]) {
    assert.equal(rangerIds.has(unusedId), false, String(unusedId));
  }

  for (const usedId of [40729, 63094, 63258]) {
    assert.equal(rangerIds.has(usedId), true, String(usedId));
  }

  const revenantIds = idsFor(revenantProfession);

  for (const unusedId of [27198, 34198, 48170, 71827]) {
    assert.equal(revenantIds.has(unusedId), false, String(unusedId));
  }

  for (const usedId of [62689, 73149, 77920]) {
    assert.equal(revenantIds.has(usedId), true, String(usedId));
  }

  assert.equal(revenantIds.has('revenant.renegade.razorclaws-rage-proc'), true);
});

test('patch authoring groups skills by weapon and slot type', () => {
  const entry = (id, name, skill) => ({
    id,
    name,
    moduleId: 'Core',
    skill: { id, name, ...skill },
    patchableFields: {}
  });
  const groups = groupPatchAuthoringSkills([
    entry(1, 'Rifle Burst', { type: 'Weapon', weapon: 'Rifle' }),
    entry(2, 'Dagger Slash', { type: 'Weapon', weapon: 'Dagger' }),
    entry(3, 'Healing Skill', { type: 'Heal' }),
    entry(4, 'Utility Skill', { type: 'Utility' }),
    entry(5, 'Elite Skill', { type: 'Elite' }),
    entry(6, 'Profession Skill', { type: 'Profession' }),
    entry(7, 'Triggered Skill', { type: 'Action' })
  ]);

  assert.deepEqual(
    groups.map((group) => group.label),
    [
      'Dagger weapon',
      'Rifle weapon',
      'Heal skills',
      'Utility skills',
      'Elite skills',
      'Profession skills',
      'Actions and triggered skills'
    ]
  );
});

test('patch authoring subgroups Elementalist weapon skills by attunement', () => {
  const entry = (id, name, attunement) => ({
    id,
    name,
    moduleId: 'Core',
    skill: { id, name, type: 'Weapon', weapon: 'Dagger', attunement },
    patchableFields: {}
  });
  const [dagger] = groupPatchAuthoringSkills([
    entry(1, 'Fire Skill', 'Fire'),
    entry(2, 'Water Skill', 'Water'),
    entry(3, 'Air Skill', 'Air'),
    entry(4, 'Earth Skill', 'Earth'),
    entry(5, 'Dual Skill', 'Fire+Water')
  ]);

  assert.deepEqual(
    dagger.attunementGroups.map((group) => group.label),
    ['Air', 'Earth', 'Fire', 'Water', 'Dual']
  );
  assert.deepEqual(
    dagger.attunementGroups.at(-1).skills.map((skill) => skill.name),
    ['Dual Skill']
  );
});

test('patch authoring separates runtime-only, advanced, and primary profile values', () => {
  const profile = {
    id: 'fixture',
    name: 'Fixture',
    profileKind: 'mechanic',
    initialDelay: 0.5,
    maximumStacks: 10,
    pulseInterval: 1,
    effects: [{ type: 'strike', coefficient: 1.5, hits: 1, atMs: 240 }]
  };

  assert.deepEqual(balanceProfilePatchableNumericFields(profile), { maximumStacks: 10, pulseInterval: 1 });
  assert.deepEqual(balanceProfileAuthoringReference(profile), {
    id: 'fixture',
    name: 'Fixture',
    profileKind: 'mechanic',
    maximumStacks: 10,
    pulseInterval: 1,
    effects: [{ type: 'strike', coefficient: 1.5, hits: 1 }]
  });
  assert.equal(balanceProfileNumericFieldTier('initialDelay'), null);
  assert.equal(balanceProfileNumericFieldTier('maximumStacks'), 'primary');
  assert.equal(balanceProfileNumericFieldTier('pulseInterval'), 'advanced');
  assert.equal(balanceProfileEffectNumericFieldTier('atMs', 200), null);
  assert.equal(balanceProfileEffectNumericFieldTier('hits', 1), 'advanced');
  assert.equal(balanceProfileEffectNumericFieldTier('hits', 3), 'primary');
  assert.equal(balanceProfileEffectNumericFieldTier('coefficient', 1.5), 'primary');
});

test('patch authoring keeps skill timing in the runtime catalog', () => {
  const skill = {
    id: 1,
    name: 'Fixture',
    castTimeMs: 900,
    quicknessCastTimeMs: 600,
    quicknessCastMultiplier: 0.75,
    initialDelay: 0.5,
    cooldown: 12,
    summonAttack: { initialDelay: 1, coefficient: 2 },
    effects: [{ type: 'strike', coefficient: 1.5, atMs: 300 }]
  };

  assert.deepEqual(skillPatchableNumericFields(skill), { cooldown: 12 });
  const reference = skillAuthoringReference(skill);
  assert.deepEqual(reference, {
    id: 1,
    name: 'Fixture',
    cooldown: 12,
    summonAttack: { coefficient: 2 },
    effects: [{ type: 'strike', coefficient: 1.5 }]
  });
  assert.equal(skill.castTimeMs, 900);
  assert.equal(skill.summonAttack.initialDelay, 1);
  // Sanitized references must remain immutable without freezing the runtime source.
  assert.equal(Object.isFrozen(reference), true);
  assert.equal(Object.isFrozen(reference.summonAttack), true);
  assert.equal(Object.isFrozen(reference.effects[0]), true);
  assert.equal(Object.isFrozen(skill), false);
});

test('patch authoring separates skill variants and emits no runtime cast fields', () => {
  const professions = [
    elementalistProfession,
    engineerProfession,
    guardianProfession,
    mesmerProfession,
    necromancerProfession,
    rangerProfession,
    revenantProfession,
    thiefProfession,
    warriorProfession
  ];

  for (const profession of professions) {
    for (const module of profession.patchAuthoring.modules) {
      assert.equal(
        module.balanceProfiles.some((entry) => entry.profile.profileKind === 'skill-variant'),
        false
      );
      assert.equal(
        module.skillVariants.every((entry) => entry.profile.profileKind === 'skill-variant'),
        true
      );
    }
  }

  const payload = JSON.stringify(professions.map((profession) => profession.patchAuthoring));
  assert.doesNotMatch(payload, /"castTimeMs":/);
  assert.doesNotMatch(payload, /"quicknessCastTimeMs":/);
  assert.doesNotMatch(payload, /"quicknessCastMultiplier":/);
  assert.doesNotMatch(payload, /"initialDelay":/);
  assert.doesNotMatch(payload, /"atMs":/);
  assert.doesNotMatch(payload, /"interruptCommitMs":/);
});

test('patch authoring omits profiles without authorable controls', () => {
  assert.equal(
    balanceProfileHasAuthorableControls({ id: 'empty', name: 'Empty', profileKind: 'skill-variant', effects: [] }),
    false
  );
});

test('patch authoring labels profile controls with readable units', () => {
  assert.equal(authoringNumericFieldLabel('cooldown'), 'cooldown (s)');
  assert.equal(authoringNumericFieldLabel('rechargeOffsetMs'), 'recharge offset (ms)');
  assert.equal(authoringNumericFieldLabel('procChance'), 'proc chance (0-1)');
  assert.equal(authoringNumericFieldLabel('durationMultiplier', true), 'duration value (profile-specific)');
});

test('patch authoring numeric controls preserve stale live-value checks', () => {
  assert.equal(numericEditValue(10, undefined), 10);
  assert.equal(numericEditValue(10, 12), 12);
  assert.equal(numericEditValue(10, { from: 10, to: 14 }), 14);
  assert.equal(numericEditValue(10, { multiply: 1.5 }), 15);
  assert.equal(numericEditValue(10, { add: -2 }), 8);
  assert.deepEqual(numericEditForValue(10, 14), { from: 10, to: 14 });
  assert.equal(numericEditForValue(10, 10), undefined);
});

test('patch authoring editor state prunes a restored numeric edit', () => {
  loadEditorPayload({
    preview: null,
    professions: [
      {
        professionId: 'warrior',
        professionName: 'Warrior',
        modules: []
      }
    ],
    sourceFile: 'active-preview.ts'
  });
  const input = {
    entity: 'effect',
    id: '1',
    field: 'duration',
    current: 1,
    effectIndex: 0,
    tickIndex: 1
  };

  setNumericEdit({ ...input, next: 2 });
  assert.deepEqual(editorState.draft.professions, {
    warrior: {
      skills: {
        1: {
          effects: [{ effectIndex: 0, tickIndex: 1, duration: { from: 1, to: 2 } }]
        }
      }
    }
  });

  setNumericEdit({ ...input, next: 1 });
  assert.equal(editorState.draft.professions, undefined);
});

test('patch authoring compacts empty edits without dropping numeric zero', () => {
  assert.deepEqual(
    compactPatchPreview({
      id: 'august-preview',
      label: 'August Preview',
      professions: {
        warrior: {
          skills: {
            empty: { fields: {} },
            changed: { fields: { cooldown: { from: 10, to: 0 } } }
          },
          modifierRules: {}
        },
        guardian: { skills: {} }
      }
    }),
    {
      id: 'august-preview',
      label: 'August Preview',
      professions: {
        warrior: {
          skills: {
            changed: { fields: { cooldown: { from: 10, to: 0 } } }
          }
        }
      }
    }
  );
});

test('patch authoring provides valid effect templates, labels, and normalized search', () => {
  assert.deepEqual(createEffectTemplate('strike'), {
    type: 'strike',
    coefficient: 1,
    hits: 1
  });
  assert.deepEqual(createEffectTemplate('condition'), {
    type: 'condition',
    condition: 'Bleeding',
    stacks: 1,
    duration: 1
  });
  assert.equal(patchSearchText('Bloody Roar', ['strikeDamage', 'multiply']), 'bloody roar strikedamage multiply');
  assert.equal(
    effectDetail({
      type: 'condition',
      ticks: [{ atMs: 280, condition: 'Bleeding', stacks: 1, duration: 7 }]
    }),
    'Bleeding'
  );
  assert.equal(
    effectDetail({ type: 'condition', name: 'Fire', condition: 'Burning', stacks: 1, duration: 1.5 }),
    'Fire · Burning'
  );
});

test('patch authoring generates an overview and discards manual notes', () => {
  const preview = generatePatchOverview(
    {
      id: 'august-preview',
      label: 'August Preview',
      notes: [
        {
          subject: 'Global manual note',
          text: 'This must be discarded.',
          status: 'tracked'
        }
      ],
      professions: {
        necromancer: {
          notes: [
            {
              subject: 'Legacy context',
              text: 'Preserved for compatibility.',
              status: 'tracked'
            }
          ],
          skills: {
            30670: {
              effects: [
                {
                  effectIndex: 0,
                  coefficient: { from: 1.5, to: 2 },
                  hits: { from: 1, to: 2 }
                }
              ]
            }
          },
          balanceProfiles: {
            'necromancer.fixture-profile': {
              effects: [
                {
                  effectIndex: 0,
                  duration: { from: 5, to: 6 }
                }
              ]
            }
          },
          modifierRules: {
            'necromancer.fixture-modifier': {
              factor: { from: 1.1, to: 1.2 },
              parameters: { threshold: { from: 90, to: 80 } }
            }
          }
        }
      }
    },
    [
      {
        professionId: 'necromancer',
        professionName: 'Necromancer',
        modules: [
          {
            id: 'Core',
            traits: [],
            skills: [{ id: 30670, name: 'Suffer!' }],
            balanceProfiles: [
              {
                id: 'necromancer.fixture-profile',
                name: 'Fixture profile'
              }
            ],
            modifierRules: [
              {
                id: 'necromancer.fixture-modifier',
                label: 'Fixture modifier'
              }
            ]
          }
        ]
      }
    ]
  );

  const overview = preview.professions.necromancer.overview;

  assert.equal(preview.notes, undefined);
  assert.equal(preview.professions.necromancer.notes, undefined);
  assert.equal(overview.length, 3);
  assert.deepEqual(overview[0], {
    subject: 'Suffer!',
    text: 'Effect 0 coefficient 1.5 → 2; effect 0 hits 1 → 2.',
    source: 'skill-diff'
  });
  assert.deepEqual(overview[1], {
    subject: 'Fixture profile',
    text: 'Effect 0 duration 5 → 6.',
    source: 'profile-diff'
  });
  assert.deepEqual(overview[2], {
    subject: 'Fixture modifier',
    text: 'Factor 1.1 → 1.2; parameter threshold 90 → 80.',
    source: 'modifier-diff'
  });
});

test('patch authoring UI uses an official source and read-only overview', async () => {
  const source = await readFile(
    new URL('../../js/games/gw2/integrations/patches/app/render.ts', import.meta.url),
    'utf8'
  );
  const simulatorSource = await readFile(
    new URL('../../js/games/gw2/integrations/patches/view.ts', import.meta.url),
    'utf8'
  );

  assert.match(source, /data-select-section="overview"/);
  assert.match(source, /data-select-section="mechanics"/);
  assert.doesNotMatch(source, /data-select-section="profiles"/);
  assert.match(source, /data-select-trait-view="modifiers"/);
  assert.match(source, /data-select-trait-view="effects"/);
  assert.match(source, /selectedTraitView === 'modifiers'/);
  assert.match(source, /balanceProfileSection\(module, 'trait'\)/);
  assert.match(source, /balanceProfileSection\(module, 'mechanic'\)/);
  assert.match(source, /Official patch notes URL/);
  assert.match(source, /Generated from diff/);
  assert.match(source, /renderSelectedSkill\(\);\s*return;/);
  assert.doesNotMatch(source, /data-add-note/);
  assert.doesNotMatch(source, /data-note-field/);
  assert.match(simulatorSource, /Official patch notes/);
  assert.match(simulatorSource, /Change overview/);
});
