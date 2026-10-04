import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  ELEMENTALIST_TRAIT_IDS as ELEMENTALIST,
  ELEMENTALIST_SKILL_IDS as ELEMENTALIST_SKILL
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import {
  ENGINEER_TRAIT_IDS as ENGINEER,
  ENGINEER_SKILL_IDS as ENGINEER_SKILL
} from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { GUARDIAN_TRAIT_IDS as GUARDIAN } from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { REVENANT_TRAIT_IDS as REVENANT } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Minimal actual strikes verify each migrated declaration's guard and its live profile payload.
for (const [name, profession, specialization, trait, profile, effect, fields] of [
  [
    'Symbolic Exposure',
    guardianProfession,
    'Core',
    GUARDIAN.SYMBOLIC_EXPOSURE,
    GUARDIAN.SYMBOLIC_EXPOSURE,
    { type: 'condition', name: 'Vulnerability' },
    { isSymbol: true }
  ],
  [
    'Searing Pact',
    guardianProfession,
    'Willbender',
    GUARDIAN.SEARING_PACT,
    GUARDIAN.SEARING_PACT,
    { type: 'condition', name: 'Burning' },
    { willbenderFlames: true }
  ],
  [
    'Endless Enmity',
    revenantProfession,
    'Renegade',
    REVENANT.ENDLESS_ENMITY,
    RENEGADE.endlessEnmity,
    { type: 'boon', name: 'fury' },
    { forceCrit: true }
  ]
])
  test(`${name} follows resolved eligibility and patched or removed effects`, () => {
    for (const removed of [false, true]) {
      const config = {
        specialization,
        selectedTraitIds: [trait],
        stats: { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 },
        target: { armor: 2597, conditions: {} },
        randomness: { mode: 'expected', seed: 1 }
      };
      const native = profession.runtimeFor(config);
      const catalog = applyBalanceProfilePatch(native.catalog, {
        balanceProfiles: {
          [profile]: removed ? { removeEffects: [effect] } : { effects: [{ ...effect, duration: 9 }] }
        }
      });
      const result = observeGw2Runtime({
        profession: {
          ...native,
          catalog,
          initialize(runtime) {
            native.initialize?.(runtime);
            for (const [at, overrides] of [
              [1, { actorType: 'summon' }],
              [2, { coefficient: 0 }],
              [3, { offTarget: true }],
              [4, {}]
            ])
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  type: 'damage',
                  at,
                  source: 'fixture',
                  sourceId: 'fixture',
                  actorType: 'player',
                  coefficient: 1,
                  skillWeapon: 'Unequipped',
                  skillName: 'Trait trigger',
                  ...fields,
                  ...overrides
                }
              });
          }
        },
        config,
        rotation: [{ type: 'wait', durationMs: 5000 }]
      });
      const packets = result.events.filter((event) => event.sourceId === trait);
      assert.equal(packets.length, removed ? 0 : 1);
      if (!removed) {
        assert.equal(packets[0].at, 4);
        assert.equal(packets[0].duration, 9);
      }

      if (name === 'Endless Enmity') assert.equal(observedRuntime(result).procs.deadline(profile), removed ? 0 : 12);
      assert.deepEqual(result.warnings, []);
    }
  });

// Removing or editing a selected status changes actual completion grants, including the Med Kit cap.
for (const [name, profession, specialization, trait, skill, effect, configExtra] of [
  [
    'Transcendent Tempest',
    elementalistProfession,
    'Tempest',
    ELEMENTALIST.TRANSCENDENT_TEMPEST,
    ELEMENTALIST_SKILL.OVERLOAD_FIRE,
    'Transcendent Tempest',
    { startAttunement: 'Fire' }
  ],
  [
    'Gyroscopic Acceleration',
    engineerProfession,
    'Scrapper',
    ENGINEER.GYROSCOPIC_ACCELERATION,
    ENGINEER_SKILL.FUNCTION_GYRO,
    'superspeed',
    {}
  ],
  [
    'Speed of Synergy',
    engineerProfession,
    'Scrapper',
    ENGINEER.SPEED_OF_SYNERGY,
    ENGINEER_SKILL.BANDAGE_SELF,
    'Med Kit toolbelt superspeed',
    { selectedSkillIds: [5802] }
  ]
])
  test(`${name} completion status uses its patched profile and respects removal`, () => {
    for (const removed of [false, true]) {
      const config = {
        specialization,
        selectedTraitIds: [trait],
        stats: { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 },
        target: { armor: 2597, conditions: {} },
        ...configExtra
      };
      const native = profession.runtimeFor(config);
      const catalog = applyBalanceProfilePatch(native.catalog, {
        balanceProfiles: {
          [trait]: removed
            ? { removeEffects: [{ type: 'buff', name: effect }] }
            : { effects: [{ type: 'buff', name: effect, duration: 8 }] }
        }
      });
      const result = observeGw2Runtime({
        profession: { ...native, catalog },
        config,
        rotation: [
          { type: 'wait', durationMs: 5000 },
          { type: 'cast', skillId: skill },
          { type: 'wait', durationMs: 1000 }
        ]
      });
      const packets = result.events.filter(
        (event) =>
          event.type === 'buff' && event.name === (name === 'Transcendent Tempest' ? name : `${name} \u2014 superspeed`)
      );
      assert.equal(packets.length, removed ? 0 : 1);
      if (!removed) assert.equal(packets[0].duration, 8);
      assert.deepEqual(result.warnings, []);
    }
  });
