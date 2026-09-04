import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { replaceBuild } from '#gw2/app/build/state/persistence.js';
import { COMMON_EVENT_TYPES } from '#gw2/platform/engine/events/events.js';
import { SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { ENGINEER_PUBLIC_END_STATE_KEYS } from '#gw2/professions/engineer/state.js';
import { ELEMENTALIST_PUBLIC_END_STATE_KEYS } from '#gw2/professions/elementalist/state.js';
import { GUARDIAN_PUBLIC_END_STATE_KEYS } from '#gw2/professions/guardian/state.js';
import { NECROMANCER_PUBLIC_END_STATE_KEYS } from '#gw2/professions/necromancer/state.js';
import { RANGER_PUBLIC_END_STATE_KEYS } from '#gw2/professions/ranger/state.js';
import { REVENANT_PUBLIC_END_STATE_KEYS } from '#gw2/professions/revenant/state.js';
import { THIEF_PUBLIC_END_STATE_KEYS } from '#gw2/professions/thief/state.js';
import { WARRIOR_PUBLIC_END_STATE_KEYS } from '#gw2/professions/warrior/state.js';
import { professionRegistry } from '#gw2/app/profession/registry.js';

const PUBLIC_END_STATE_KEYS_BY_PROFESSION = Object.freeze({
  elementalist: ELEMENTALIST_PUBLIC_END_STATE_KEYS,
  engineer: ENGINEER_PUBLIC_END_STATE_KEYS,
  guardian: GUARDIAN_PUBLIC_END_STATE_KEYS,
  mesmer: Object.freeze([
    'resource',
    'resourceDefinition',
    'clarityRemaining',
    'counterspellAvailable',
    'availableAmbush',
    'availableFlips',
    'autoattackChains',
    'continuumActive',
    'continuumRemaining'
  ]),
  necromancer: NECROMANCER_PUBLIC_END_STATE_KEYS,
  ranger: RANGER_PUBLIC_END_STATE_KEYS,
  revenant: REVENANT_PUBLIC_END_STATE_KEYS,
  thief: THIEF_PUBLIC_END_STATE_KEYS,
  warrior: WARRIOR_PUBLIC_END_STATE_KEYS
});

function assertCatalogMetadata(entry, catalog) {
  const traitById = new Map(catalog.traits.map((trait) => [trait.id, trait]));
  const referencedTraitIds = new Set();
  const specializationNames = new Set(catalog.specializations.map((specialization) => specialization.name));

  for (const weapon of catalog.weapons) {
    assert.match(String(catalog.weaponHands.get(weapon) || ''), /^(?:mh|oh|mh\+oh|2h|-)$/, `${entry.id} ${weapon}`);
  }

  for (const specialization of catalog.specializations) {
    assert.equal(specialization.minorTraits.length, 3, specialization.name);
    assert.equal(specialization.majorTraits.length, 3, specialization.name);
    for (const tier of specialization.majorTraits) {
      assert.equal(tier.length, 3, specialization.name);
    }

    for (const trait of [...specialization.minorTraits, ...specialization.majorTraits.flat()]) {
      assert.equal(traitById.has(trait.id), true, trait.name);
      referencedTraitIds.add(trait.id);
    }
  }

  for (const trait of catalog.traits) {
    assert.equal(referencedTraitIds.has(trait.id), true, trait.name);
    assert.equal(specializationNames.has(trait.specialization), true, trait.name);
    assert.equal(Number.isInteger(Number(trait.position)), true, trait.name);
    assert.equal(Number(trait.position) >= 0, true, trait.name);
    assert.equal(Number(trait.position) <= 3, true, trait.name);
  }
}

function assertUiContracts(entry, profession, specialization) {
  const runtimeSpecialization = profession.catalog.specializations.some(
    (candidate) => candidate.elite && candidate.name === specialization
  )
    ? specialization
    : 'Core';
  let runtime;

  try {
    runtime = profession.resolveRuntime({
      specialization: runtimeSpecialization
    });
  } catch {
    runtime = profession.resolveRuntime({ specialization: 'Core' });
  }

  const context = {
    catalog: profession.catalog,
    specialization,
    config: { specialization },
    professionState: runtime.createProfessionState({ specialization })
  };
  const groups = profession.ui.paletteGroups(context);
  const views = profession.ui.resourceViews(context);

  assert.equal(Array.isArray(groups), true);
  assert.equal(Array.isArray(views), true);
  assert.equal(new Set(groups.map((group) => group.id)).size, groups.length);
  assert.ok(
    groups.filter((group) => group.resourceAnchor).length <= 1,
    `${entry.id} has at most one profession resource anchor`
  );
  for (const group of groups) {
    assert.match(String(group.id || ''), /^[a-z][a-z0-9-]*$/);
    assert.equal(Array.isArray(group.skillIds), true);
    assert.equal(new Set(group.skillIds).size, group.skillIds.length);
    for (const id of group.skillIds) {
      assert.equal(profession.catalog.skillsById.has(id), true, String(id));
    }
  }

  assert.equal(new Set(views.map((view) => view.id)).size, views.length);
  for (const view of views) {
    assert.match(String(view.id || ''), /^[a-z][a-z0-9-]*$/);
    assert.ok(String(view.singular || '').trim(), `${entry.id} singular`);
    assert.ok(String(view.plural || '').trim(), `${entry.id} plural`);
    assert.ok(Number.isFinite(Number(view.maximum)), `${entry.id} maximum`);
    assert.ok(Number(view.maximum) > 0, `${entry.id} maximum`);
    assert.ok(Number.isFinite(Number(view.value)), `${entry.id} value`);
    assert.ok(Number(view.value) >= 0, `${entry.id} value`);
    assert.ok(Number(view.value) <= Number(view.maximum), `${entry.id} value`);
    assert.equal(typeof view.canStart, 'boolean', `${entry.id} canStart`);
    assert.ok(String(view.shortLabel || '').trim(), `${entry.id} shortLabel`);
    assert.ok(String(view.statusLabel || '').trim(), `${entry.id} statusLabel`);
  }

  for (const callback of [
    'isPaletteSkillInstant',
    'paletteSkillAvailability',
    'isSlotSkillSelectable',
    'paletteGroups',
    'resourceViews',
    'skillBarGroups',
    'targetHealthThresholds',
    'timelineWeaponLineTransition',
    'timelineSkillIcon',
    'updateSkillBarSelection'
  ]) {
    assert.equal(typeof profession.ui[callback], 'function', `${entry.id} ui.${callback}`);
  }

  const sampleSkill = profession.catalog.skills.find((skill) => !skill.simulatorExcluded);

  if (sampleSkill) {
    const availability = profession.ui.paletteSkillAvailability(context, sampleSkill);

    assert.equal(typeof availability.available, 'boolean');
    assert.equal(typeof availability.message, 'string');
  }
}

function assertEventDescriptors(entry, profession) {
  const baseEvent = {
    at: 0,
    reason: 'state-updated',
    state: {
      energy: 40,
      heat: 25,
      initiative: 8,
      lifeForce: 75
    },
    name: 'Synthetic Event',
    skillName: 'Synthetic Skill',
    count: 1,
    instrument: 'Lute',
    duration: 5,
    pageCost: 1,
    pagesRemaining: 4
  };
  const specializations = [
    'Core',
    ...profession.catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
      .filter((name) => {
        try {
          profession.resolveRuntime({ specialization: name });

          return true;
        } catch {
          return false;
        }
      })
  ];

  for (const specialization of specializations) {
    const runtime = profession.resolveRuntime({ specialization });

    for (const type of Object.keys(runtime.eventHandlers)) {
      const descriptor = profession.ui.eventLogRow?.(
        { specialization, config: { specialization } },
        { ...baseEvent, type }
      );

      assert.notEqual(descriptor, undefined, `${entry.id}/${specialization} must present or suppress ${type}`);

      if (descriptor === null) continue;
      assert.deepEqual(Object.keys(descriptor).sort(), ['className', 'description', 'flags', 'order', 'type'].sort());
      assert.ok(String(descriptor.type).trim());
      assert.ok(String(descriptor.description).trim());
      assert.equal(typeof descriptor.className, 'string');
      assert.equal(Number.isFinite(descriptor.order), true);
      assert.equal(Array.isArray(descriptor.flags), true);
    }
  }
}

test('profession registry entries conform to the shared contracts', async () => {
  const storageKeys = new Set();
  const filenames = new Set();

  for (const entry of professionRegistry) {
    await access(new URL(`../../${entry.route}`, import.meta.url));
    const [profession, adapter] = await Promise.all([entry.loadProfession(), entry.loadAppAdapter()]);

    assert.match(entry.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(profession.id, entry.id);
    assert.equal(adapter.id, entry.id);
    assert.ok(entry.themeClass);
    assert.equal(typeof profession.resolveRuntime, 'function');
    assert.equal(Object.hasOwn(profession, 'eventHandlers'), false);
    assert.equal(Object.hasOwn(profession, 'taskHandlers'), false);
    assert.equal(Object.hasOwn(profession, 'createProfessionState'), false);
    assertCatalogMetadata(entry, profession.catalog);
    assertEventDescriptors(entry, profession);

    const ids = profession.catalog.skills.map((skill) => skill.id);

    assert.equal(new Set(ids).size, ids.length);
    for (const skill of profession.catalog.skills) {
      assert.equal(profession.catalog.skillsById.get(skill.id), skill);
      assert.ok(Number.isFinite(skill.castTimeMs), skill.name);
      assert.equal('activation' in skill, false, skill.name);
      assert.equal('castTime' in skill, false, skill.name);

      if (skill.handlerId) {
        const handler = profession.catalog.skillHandlers.get(skill.handlerId);

        assert.equal(typeof handler, 'object', skill.handlerId);
        assert.equal(Object.values(SKILL_HANDLER_MODES).includes(handler.mode), true, `${skill.handlerId} mode`);
        assert.equal(
          ['beforeEffects', 'afterEffect', 'afterEffects'].some((phase) => typeof handler[phase] === 'function'),
          true,
          `${skill.handlerId} phases`
        );
      }

      for (const effect of skill.effects) {
        if (effect.type !== 'custom') continue;
        // Custom effects may materialize a shared engine event directly; only
        // profession-owned event types require a namespaced runtime handler.
        const usesSharedEvent = COMMON_EVENT_TYPES.includes(effect.eventType);
        assert.equal(usesSharedEvent || effect.eventType.startsWith(`${entry.id}.`), true, effect.eventType);
        if (usesSharedEvent) continue;

        const owner =
          skill.specialization &&
          profession.catalog.specializations.some(
            (specialization) => specialization.elite && specialization.name === skill.specialization
          )
            ? skill.specialization
            : 'Core';
        const runtime = profession.resolveRuntime({ specialization: owner });

        assert.equal(typeof runtime.eventHandlers[effect.eventType], 'function', effect.eventType);
      }
    }

    for (const specialization of [
      'Core',
      ...profession.catalog.specializations.filter((candidate) => candidate.elite).map((candidate) => candidate.name)
    ]) {
      let runtime;

      try {
        runtime = profession.resolveRuntime({ specialization });
      } catch {
        continue;
      }

      for (const type of Object.keys(runtime.eventHandlers)) {
        assert.equal(type.startsWith(`${entry.id}.`), true, type);
        assert.equal(COMMON_EVENT_TYPES.includes(type), false, type);
      }

      for (const type of Object.keys(runtime.taskHandlers)) {
        assert.equal(type.startsWith(`${entry.id}.`), true, type);
      }
    }

    const defaults = profession.createBuildDefaults();
    const migrated = profession.migrateBuild(defaults);

    assert.equal(profession.validateBuild(migrated).valid, true);
    assert.equal(migrated.profession, entry.id);
    assert.deepEqual(profession.migrateBuild(migrated), migrated);
    const oneWeaponSet = profession.migrateBuild({
      ...defaults,
      alternateWeapons: ['', ''],
      startingWeaponSet: 2
    });

    assert.deepEqual(oneWeaponSet.alternateWeapons, ['', '']);
    assert.equal(oneWeaponSet.startingWeaponSet, 1);
    assert.equal(profession.validateBuild(oneWeaponSet).valid, true);
    assert.throws(
      () =>
        profession.migrateBuild({
          ...defaults,
          profession: 'wrong-profession'
        }),
      /Cannot load/
    );
    assert.throws(
      () =>
        profession.migrateBuild({
          ...defaults,
          schemaVersion: defaults.schemaVersion + 1
        }),
      /Unsupported build schema version/
    );

    const result = simulateGw2({ profession, rotation: [], config: {} });

    assert.deepEqual(
      Object.keys(result.endState).sort(),
      ['activeWeaponSet', 'ammo', 'ammoBySkillId', 'cooldowns', 'profession', 'time'].sort()
    );
    assert.equal(typeof result.endState.profession, 'object');
    const unknown = simulateGw2({
      profession,
      rotation: [{ type: 'cast', skillId: -999 }],
      config: {}
    });

    assert.match(unknown.warnings.join(' '), /Unknown skill id -999/);

    for (const specialization of ['Core', ...profession.catalog.specializations.map((value) => value.name)]) {
      assertUiContracts(entry, profession, specialization);
    }

    assert.equal(storageKeys.has(adapter.storageKey), false);
    storageKeys.add(adapter.storageKey);
    for (const filename of Object.values(adapter.filenames)) {
      assert.equal(filenames.has(filename), false);
      filenames.add(filename);
    }
  }
});

test('ready native professions expose deliberate public end-state keys', async () => {
  const internalKeys = {
    elementalist: [
      'freshAirProgress',
      'freshAirLastResetAt',
      'burningPrecisionProgress',
      'enduranceUpdatedAt',
      'comboProgress',
      'procReadyAt'
    ],
    engineer: ['heatUpdatedAt', 'passiveHeatAt', 'lightningRodActivationId', 'traitProcReadyAt'],
    guardian: ['ashesNextTriggerAt', 'furiousFocusReadyAt', 'radiantForgeEnteredAt'],
    mesmer: ['bloodsongProgress', 'pendingResources', 'traitReadyAt'],
    necromancer: [
      'lastResourceAt',
      'nextBlightAt',
      'minionGenerations',
      'minionAttackGenerations',
      'spiritGenerations',
      'spiritInitialUntil',
      'spiritBusyUntil',
      'spiritAutoAnchorAt',
      'resummonedSpiritAutoCycle',
      'pendingShroudEntryId',
      'activeShroudEntryId',
      'activeShroudExitId',
      'activeShroudProfileId',
      'pendingSoulTwistSkill',
      'plagueSendingArmed',
      'plagueSendingEntrySkillId',
      'signetNextLifeForceAt',
      'vampirismNextAt',
      'painfulBondPulseAnchorAt',
      'targetChilledUntil',
      'targetControlledUntil',
      'fearOfDeathReadyAt',
      'vampiricPresenceReadyAt',
      'barbedPrecisionProgress',
      'chillingNovaProgress',
      'chillingNovaReadyAt',
      'chillingVictoryReadyAt',
      'demonicLoreReadyAt',
      'nourishingAshesReadyAt',
      'spitefulFortitudeLifeForce',
      'traitProcReadyAt',
      'weaponSpells'
    ],
    ranger: [],
    revenant: [
      'energyUpdatedAt',
      'enduranceUpdatedAt',
      'renegadeCriticalProgress',
      'soulcleaveNextAlliedProcAt',
      'endlessEnmityReadyAt',
      'bloodFuryReadyAt',
      'soulcleaveReadyAt',
      'upkeepAffinityNextAt',
      'impossibleOddsLesserDaggersNextAt',
      'mistfireReadyAt',
      'traitProcReadyAt'
    ],
    thief: ['artifactOutcomeIndices', 'doubleEdgeOutcomeIndex', 'initiativeSpentSincePilfer', 'traitProcReadyAt'],
    warrior: [
      'burstPowerExpiries',
      'dragonTriggerStartedAt',
      'fierceAsFireExpiries',
      'flowUpdatedAt',
      'gunsAndGloryUntil',
      'lastResourceAt',
      'nextRefrainAt',
      'signetMasteryExpiries',
      'soldierFocusReadyAt',
      'targetControlledUntil',
      'traitProcReadyAt'
    ]
  };

  for (const entry of professionRegistry) {
    const profession = await entry.loadProfession();
    const result = simulateGw2({ profession, rotation: [], config: {} });

    assert.deepEqual(
      Object.keys(result.endState.profession).sort(),
      [...PUBLIC_END_STATE_KEYS_BY_PROFESSION[entry.id]].sort(),
      entry.id
    );
    for (const key of internalKeys[entry.id]) {
      assert.equal(Object.hasOwn(result.endState.profession, key), false, `${entry.id}.${key}`);
    }
  }
});

test('Elementalist exposes only its manifest entry', () => {
  const elementalist = professionRegistry.find((entry) => entry.id === 'elementalist');

  assert.ok(elementalist);
  assert.equal(typeof elementalist.loadAppAdapter, 'function');
  assert.equal(
    professionRegistry.some((entry) => entry.id === 'elementalist'),
    true
  );
  assert.equal(
    professionRegistry.some((entry) => entry.id === 'elementalist-legacy'),
    false
  );
});

test('profession registry IDs and routes are unique', () => {
  const ids = professionRegistry.map(({ id }) => id);
  const routes = professionRegistry.map(({ route }) => route);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(routes).size, routes.length);
});

test('build validation reports malformed specializations across skill-loadout strategies', async () => {
  for (const professionId of ['thief', 'revenant']) {
    const entry = professionRegistry.find(({ id }) => id === professionId);
    const profession = await entry.loadProfession();
    const result = profession.validateBuild({
      ...profession.createBuildDefaults(),
      specializations: {}
    });

    assert.equal(result.valid, false, professionId);
    assert.ok(result.errors.includes('specializations must be an array.'), professionId);
  }
});

describe('native build codecs', () => {
  for (const entry of professionRegistry) {
    const loaded = Promise.all([entry.loadProfession(), entry.loadAppAdapter()]);
    const load = async () => {
      const [profession, adapter] = await loaded;

      return { profession, adapter, defaults: profession.createBuildDefaults() };
    };

    test(`${entry.id} migrates supported schema versions`, async () => {
      const { profession, adapter, defaults } = await load();

      assert.throws(() => replaceBuild({ ...defaults, profession: 'wrong-profession' }, adapter), /Cannot load/);
      assert.throws(
        () => replaceBuild({ ...defaults, schemaVersion: defaults.schemaVersion + 1 }, adapter),
        /Unsupported build schema version/
      );
      for (let version = 0; version <= defaults.schemaVersion; version += 1) {
        const migrated = profession.migrateBuild({
          ...defaults,
          schemaVersion: version
        });

        assert.equal(migrated.schemaVersion, defaults.schemaVersion, `${entry.id} v${version}`);
        assert.equal(profession.validateBuild(migrated).valid, true);
      }

      if (entry.id === 'guardian') {
        assert.equal(Object.hasOwn(defaults, 'initialResource'), false);
        assert.equal(
          Object.hasOwn(profession.migrateBuild({ ...defaults, initialResource: 3 }), 'initialResource'),
          false
        );
      }
    });

    test(`${entry.id} sanitizes shared equipment fields`, async () => {
      const { profession, defaults } = await load();
      const legacySigils = profession.migrateBuild({
        ...defaults,
        schemaVersion: 0,
        weaponSigils: undefined,
        sigils: ['Force', 'Impact']
      });

      assert.deepEqual(legacySigils.weaponSigils, [
        ['Force', 'Impact'],
        ['Force', 'Impact']
      ]);
      assert.equal('sigils' in legacySigils, false);

      for (const field of ['rune', 'food', 'utility']) {
        const invalidBuild = { ...defaults, [field]: `Unknown ${field}` };

        assert.equal(profession.validateBuild(invalidBuild).valid, false);
        assert.equal(profession.migrateBuild(invalidBuild)[field], defaults[field]);
      }

      const invalid = {
        ...defaults,
        gear: { ...defaults.gear, Helm: 'Unknown Prefix' },
        relic: 'Unknown Relic',
        rotation: [{ type: 'cast', skillId: -999 }],
        specializations: [defaults.specializations[0], defaults.specializations[0], defaults.specializations[0]]
      };
      const sanitized = profession.migrateBuild(invalid);

      assert.equal(profession.validateBuild(invalid).valid, false);
      assert.equal(sanitized.relic, defaults.relic);
      assert.equal(sanitized.gear.Helm, defaults.gear.Helm);
      assert.deepEqual(sanitized.specializations, defaults.specializations);
      assert.equal(
        profession.validateBuild(sanitized).errors.some((error) => error.includes('unknown skill')),
        true
      );

      const twoHanded = [...profession.catalog.weaponHands].find(([, hand]) => hand === '2h')?.[0];

      if (twoHanded) {
        assert.deepEqual(
          profession.migrateBuild({
            ...defaults,
            weapons: [twoHanded, defaults.weapons[1] || 'invalid']
          }).weapons,
          [twoHanded, '']
        );
      }
    });

    test(`${entry.id} rejects invalid shared scalar and rotation fields`, async () => {
      const { profession, defaults } = await load();

      assert.equal(profession.validateBuild({ ...defaults, jadeBotCore: 'yes' }).valid, false);
      assert.equal(profession.migrateBuild({ ...defaults, jadeBotCore: 'yes' }).jadeBotCore, defaults.jadeBotCore);
      for (const rotation of [
        [{ type: 'wait', durationMs: -1 }],
        [{ type: 'cast', skillId: profession.catalog.skills[0].id, concurrentOffsetMs: -1 }],
        [{ type: 'combat-start', interruptAfterMs: 1 }]
      ]) {
        assert.equal(profession.validateBuild({ ...defaults, rotation }).valid, false);
      }
    });

    test(`${entry.id} sanitizes generic slot selections`, async () => {
      const { profession, adapter, defaults } = await load();

      if (adapter.slotLoadout) return;

      const selectedSpecializations = new Set(defaults.specializations.map(({ name }) => name));
      const lockedSlotSkill = profession.catalog.skills.find(
        (skill) =>
          ['Heal', 'Utility', 'Elite'].includes(skill.type) &&
          !skill.simulatorExcluded &&
          skill.flipParentId == null &&
          skill.specialization &&
          !selectedSpecializations.has(skill.specialization)
      );

      if (lockedSlotSkill) {
        const slot = lockedSlotSkill.type === 'Heal' ? 'Heal' : lockedSlotSkill.type === 'Elite' ? 'Elite' : 'Utility1';
        const lockedBuild = {
          ...defaults,
          selectedSkills: { ...defaults.selectedSkills, [slot]: lockedSlotSkill.name }
        };
        const migrated = profession.migrateBuild(lockedBuild);

        assert.equal(profession.validateBuild(lockedBuild).valid, false);
        assert.notEqual(migrated.selectedSkills[slot], lockedSlotSkill.name);
        assert.equal(profession.validateBuild(migrated).valid, true);
      }

      const duplicateUtility = {
        ...defaults,
        selectedSkills: { ...defaults.selectedSkills, Utility2: defaults.selectedSkills.Utility1 }
      };
      const normalizedUtilities = profession.migrateBuild(duplicateUtility);

      assert.equal(profession.validateBuild(duplicateUtility).valid, false);
      assert.equal(
        new Set([
          normalizedUtilities.selectedSkills.Utility1,
          normalizedUtilities.selectedSkills.Utility2,
          normalizedUtilities.selectedSkills.Utility3
        ]).size,
        3
      );

      const flip = profession.catalog.skills.find(
        (skill) => skill.flipParentId != null && ['Heal', 'Utility', 'Elite'].includes(skill.type)
      );

      if (flip) {
        const slot = flip.type === 'Heal' ? 'Heal' : flip.type === 'Elite' ? 'Elite' : 'Utility1';
        const withFlip = { ...defaults, selectedSkills: { ...defaults.selectedSkills, [slot]: flip.name } };

        assert.equal(profession.validateBuild(withFlip).valid, false);
        assert.equal(profession.migrateBuild(withFlip).selectedSkills[slot], defaults.selectedSkills[slot]);
      }
    });

    test(`${entry.id} normalizes rotations for application use`, async () => {
      const { profession, adapter, defaults } = await load();
      const firstSkill = profession.catalog.skills[0];
      const cast = { type: 'cast', skillId: firstSkill.id };

      assert.deepEqual(profession.migrateBuild({ ...defaults, rotation: [firstSkill.name] }).rotation, [cast]);
      assert.deepEqual(adapter.toApplicationBuild({ ...defaults, rotation: [cast] }).rotation[0], cast);
    });
  }
});
