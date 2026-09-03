import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import { replaceBuild } from '#gw2/app/build/state/persistence.js';
import { GW2_SKILL_ID_ALIASES as RUNTIME_SKILL_ID_ALIASES } from '#gw2/platform/skills/aliases.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import { COMMON_EVENT_TYPES } from '#gw2/platform/engine/events/events.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { TRAIT_COVERAGE_STATUSES } from '../helpers/trait-coverage.js';
import { ENGINEER_TRAIT_COVERAGE } from '../fixtures/trait-coverage/engineer.js';
import { ENGINEER_PUBLIC_END_STATE_KEYS } from '#gw2/professions/engineer/state.js';
import { ELEMENTALIST_PUBLIC_END_STATE_KEYS } from '#gw2/professions/elementalist/state.js';
import { ELEMENTALIST_TRAIT_COVERAGE } from '../fixtures/trait-coverage/elementalist.js';
import { GUARDIAN_TRAIT_COVERAGE } from '../fixtures/trait-coverage/guardian.js';
import { GUARDIAN_PUBLIC_END_STATE_KEYS } from '#gw2/professions/guardian/state.js';
import { MESMER_TRAIT_COVERAGE } from '../fixtures/trait-coverage/mesmer.js';
import { NECROMANCER_TRAIT_COVERAGE } from '../fixtures/trait-coverage/necromancer.js';
import { NECROMANCER_PUBLIC_END_STATE_KEYS } from '#gw2/professions/necromancer/state.js';
import { RANGER_TRAIT_COVERAGE } from '../fixtures/trait-coverage/ranger.js';
import { RANGER_PUBLIC_END_STATE_KEYS } from '#gw2/professions/ranger/state.js';
import { REVENANT_TRAIT_COVERAGE } from '../fixtures/trait-coverage/revenant.js';
import { REVENANT_PUBLIC_END_STATE_KEYS } from '#gw2/professions/revenant/state.js';
import { THIEF_TRAIT_COVERAGE } from '../fixtures/trait-coverage/thief.js';
import { THIEF_PUBLIC_END_STATE_KEYS } from '#gw2/professions/thief/state.js';
import { WARRIOR_TRAIT_COVERAGE } from '../fixtures/trait-coverage/warrior.js';
import { WARRIOR_PUBLIC_END_STATE_KEYS } from '#gw2/professions/warrior/state.js';
import { professionRegistry } from '#gw2/app/profession/registry.js';
import {
  createProfessionSnapshot,
  DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS,
  fetchProfessionSnapshot,
  GW2_SKILL_FLAGS,
  GW2_SKILL_ID_ALIASES,
  isTerrestrialSkill,
  serializeProfessionSnapshot,
  skillSnapshot
} from '../../scripts/data/lib/gw2-profession-snapshot.mjs';
import { updateProfessionApiData } from '../../scripts/data/update-profession-api-data.mjs';

const apiFixture = JSON.parse(
  await readFile(new URL('../fixtures/gw2-api/profession-snapshot.json', import.meta.url), 'utf8')
);

const TRAIT_COVERAGE_BY_PROFESSION = Object.freeze({
  elementalist: ELEMENTALIST_TRAIT_COVERAGE,
  engineer: ENGINEER_TRAIT_COVERAGE,
  guardian: GUARDIAN_TRAIT_COVERAGE,
  mesmer: MESMER_TRAIT_COVERAGE,
  necromancer: NECROMANCER_TRAIT_COVERAGE,
  ranger: RANGER_TRAIT_COVERAGE,
  revenant: REVENANT_TRAIT_COVERAGE,
  thief: THIEF_TRAIT_COVERAGE,
  warrior: WARRIOR_TRAIT_COVERAGE
});
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

function createFixtureFetch(requests = [], fixture = apiFixture) {
  return async (requestUrl) => {
    const url = new URL(requestUrl);

    requests.push(url);
    const ids = String(url.searchParams.get('ids') || '')
      .split(',')
      .filter(Boolean)
      .map(Number);
    let value;

    if (url.pathname.startsWith('/v2/professions/')) {
      value = fixture.profession;
    } else if (url.pathname === '/v2/specializations') {
      value = fixture.specializations.filter((entry) => ids.includes(entry.id));
    } else if (url.pathname === '/v2/traits') {
      value = fixture.traits.filter((entry) => ids.includes(entry.id));
    } else if (url.pathname === '/v2/skills') {
      value = fixture.skills.filter((entry) => ids.includes(entry.id));
    } else {
      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => structuredClone(value)
    };
  };
}

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
    'isPaletteSkillAvailable',
    'isSlotSkillSelectable',
    'paletteSkillUnavailableMessage',
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

test('ready native professions classify every trait with no pending entries', async () => {
  for (const entry of professionRegistry) {
    const profession = await entry.loadProfession();
    const coverage = TRAIT_COVERAGE_BY_PROFESSION[entry.id];

    assert.ok(coverage, `${entry.id} trait coverage`);
    assert.equal(coverage.length, profession.catalog.traits.length);
    assert.equal(new Set(coverage.map((item) => item.traitId)).size, profession.catalog.traits.length);
    assert.equal(
      coverage.every((item) => item.effects.length > 0),
      true,
      `${entry.id} empty trait coverage`
    );
    assert.equal(
      coverage.some(
        (item) =>
          item.status === TRAIT_COVERAGE_STATUSES.PENDING ||
          item.effects.some((effect) => effect.status === TRAIT_COVERAGE_STATUSES.PENDING)
      ),
      false,
      `${entry.id} pending trait coverage`
    );
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

test('resolver profession state changes are chronological and preserve counters', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 980001,
        name: 'Chronology Fixture',
        type: 'Utility',
        castTimeMs: 0,
        effects: [
          strikeTimeline(
            [
              { atMs: 1000, coefficient: 1 },
              { atMs: 5000, coefficient: 1 },
              { atMs: 6000, coefficient: 1 }
            ],
            {
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            }
          ),
          {
            type: 'custom',
            eventType: 'chronology-fixture.state',
            atMs: 5000,
            event: { active: true, priority: -10 },
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'chronology-fixture',
    name: 'Chronology Fixture',
    catalog,
    resources: {
      createProfessionState: (config) => ({
        active: Boolean(config.initialActive),
        hitCount: 0
      }),
      createResolverState: (config) => ({
        active: Boolean(config.initialActive),
        hitCount: 0
      }),
      projectEndState: ({ resolverState }) => ({
        active: resolverState.active
      })
    },
    attributeRules: {
      modifyStrikeDamage(context, value) {
        return context.runtime.profession.active ? value * 2 : value;
      }
    },
    resolverHooks: {
      eventHandlers: {
        'chronology-fixture.state': (context, event) => {
          context.profession.active = event.active;
        }
      },
      eventReactions: {
        'damage.resolved': (context) => {
          context.profession.hitCount += 1;
        }
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: ['Chronology Fixture', { type: 'wait', durationMs: 6000 }]
  });
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage');

  assert.equal(Math.round(hits[1].damage / hits[0].damage), 2);
  assert.equal(Math.round(hits[2].damage / hits[0].damage), 2);
  assert.equal(result.profession.hitCount, 3);
  assert.deepEqual(result.endState.profession, { active: true });

  const configured = simulateGw2({
    profession,
    rotation: ['Chronology Fixture', { type: 'wait', durationMs: 6000 }],
    config: { initialActive: true }
  });
  const configuredHits = configured.resolvedEvents.filter((event) => event.type === 'damage');

  assert.equal(Math.round(configuredHits[2].damage / configuredHits[0].damage), 1);
});

test('API snapshot transforms chains, filtering, and ordering', () => {
  const snapshot = createProfessionSnapshot({
    profession: apiFixture.profession,
    specializationData: apiFixture.specializations,
    traitData: apiFixture.traits,
    skillData: apiFixture.skills
  });
  const reordered = createProfessionSnapshot({
    profession: {
      ...apiFixture.profession,
      skills: [...apiFixture.profession.skills].reverse()
    },
    specializationData: [...apiFixture.specializations].reverse(),
    traitData: [...apiFixture.traits].reverse(),
    skillData: [...apiFixture.skills].reverse()
  });

  assert.deepEqual(reordered, snapshot);
  assert.deepEqual(
    snapshot.skills.map((value) => value.id),
    [10, 11, 12, 20, 21, 40]
  );
  assert.equal(snapshot.skills.find((value) => value.id === 10).nextChainId, 11);
  assert.equal(snapshot.skills.find((value) => value.id === 11).flipSkillId, 12);
  assert.equal(snapshot.skills.find((value) => value.id === 20).flipSkillId, null);
  assert.equal(
    snapshot.skills.some((value) => 'canonicalAliasId' in value || 'modeAliasIds' in value || 'flags' in value),
    false
  );
  assert.equal(snapshot.skills.find((value) => value.id === 40).specialization, 'Elite');
  assert.equal(
    snapshot.skills.some((value) => 'facts' in value || 'coefficient' in value),
    false
  );
  assert.equal(
    snapshot.skills.some((value) => value.flags?.includes(GW2_SKILL_FLAGS.TERRESTRIAL_ONLY)),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 60,
        name: 'Wet Spear',
        slot: 'Weapon_1',
        flags: []
      },
      'Spear'
    ),
    false
  );
  assert.deepEqual(DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS, ['Trident', 'Speargun']);
  assert.equal(
    isTerrestrialSkill(
      {
        id: 61,
        name: 'Trident Attack',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY]
      },
      'Trident'
    ),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 64,
        name: 'Aquatic Skill',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.UNDERWATER_ONLY]
      },
      ''
    ),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 62,
        name: 'Speargun Attack',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY]
      },
      'Speargun'
    ),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 63,
        name: 'Land Spear',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY]
      },
      'Spear'
    ),
    true
  );
  assert.equal(
    serializeProfessionSnapshot({
      professionName: 'Fixture',
      snapshotDate: '2026-07-27',
      ...snapshot
    }),
    serializeProfessionSnapshot({
      professionName: 'Fixture',
      snapshotDate: '2026-07-27',
      ...reordered
    })
  );
});

test('API snapshots emit canonical records for reviewed aliases only', () => {
  const snapshot = createProfessionSnapshot({
    profession: {
      id: 'Fixture',
      skills: [{ id: 42297 }, { id: 68666 }, { id: 9224 }, { id: 99999 }]
    },
    specializationData: [],
    traitData: [],
    skillData: [
      { id: 42297, name: 'Manifest Sand Shade', type: 'Profession', slot: 'Profession_1', facts: [] },
      {
        id: 44946,
        name: 'Manifest Sand Shade',
        type: 'Profession',
        slot: 'Profession_1',
        facts: [],
        flip_skill: 42297
      },
      { id: 68666, name: 'Renewed Focus', type: 'Elite', slot: 'Elite', facts: [] },
      { id: 9154, name: 'Renewed Focus', type: 'Elite', slot: 'Elite', facts: [] },
      { id: 9224, name: 'Shield of Absorption', type: 'Weapon', slot: 'Weapon_5', facts: [] },
      { id: 99999, name: 'Renewed Focus', type: 'Elite', slot: 'Elite', facts: [] }
    ]
  });

  assert.deepEqual(GW2_SKILL_ID_ALIASES, RUNTIME_SKILL_ID_ALIASES);
  assert.equal(GW2_SKILL_ID_ALIASES[42297], 44946);
  assert.equal(GW2_SKILL_ID_ALIASES[68666], 9154);
  assert.equal(
    snapshot.skills.some((skill) => Object.hasOwn(skill, 'attunement')),
    false
  );
  assert.equal(
    skillSnapshot({
      id: 1,
      name: 'Flame Burst',
      type: 'Weapon',
      slot: 'Weapon_1',
      attunement: 'Fire',
      facts: []
    }).attunement,
    'Fire'
  );
  assert.deepEqual(
    snapshot.skills.map((skill) => skill.id),
    [9154, 9224, 44946, 99999]
  );
  assert.equal(snapshot.skills.find((skill) => skill.id === 44946).flipSkillId, null);
});

test('API snapshot fetches are English, fixture-backed, and profession-generic', async () => {
  const requests = [];
  const fetchImpl = createFixtureFetch(requests);
  const snapshot = await fetchProfessionSnapshot({
    professionName: 'Warrior',
    fetchImpl
  });

  assert.deepEqual(
    snapshot.skills.map((skill) => skill.id),
    [10, 11, 12, 20, 21, 40]
  );
  assert.ok(requests.length > 0);
  assert.equal(
    requests.every((request) => request.searchParams.get('lang') === 'en'),
    true
  );
  const directory = await mkdtemp(path.join(tmpdir(), 'gw2-profession-snapshot-'));
  const output = path.join(directory, 'warrior-api-metadata.ts');

  try {
    const result = await updateProfessionApiData('warrior', {
      fetchImpl: createFixtureFetch(),
      snapshotDate: '2026-07-27',
      output,
      log: () => {}
    });

    assert.equal(result.output, path.resolve(output));
    const source = await readFile(output, 'utf8');

    assert.match(source, /Generated Guild Wars 2 API metadata for warrior/);
    assert.match(source, /npm run update:profession-data -- --profession Warrior/);
    assert.match(source, /warrior\/core\/ and warrior\/specializations\//);
    assert.doesNotMatch(source, /warrior\/mechanics\//);
    assert.match(source, /import type \{ Gw2ApiSpecialization, Gw2ApiTrait \}/);
    assert.match(source, /export const DATA_SNAPSHOT: string = "2026-07-27"/);
    assert.match(source, /export const SPECIALIZATIONS: readonly WarriorApiSpecialization\[]/);
    assert.match(source, /export const SKILLS: readonly WarriorSkill\[]/);

    const thiefRequests = [];

    await updateProfessionApiData('thief', {
      fetchImpl: createFixtureFetch(thiefRequests),
      snapshotDate: '2026-07-27',
      output: path.join(directory, 'thief-api-metadata.ts'),
      log: () => {}
    });
    const requestedThiefSkillIds = thiefRequests
      .filter((request) => request.pathname === '/v2/skills')
      .flatMap((request) =>
        String(request.searchParams.get('ids') || '')
          .split(',')
          .map(Number)
      );

    assert.equal(
      [76633, 76674, 76702].every((skillId) => requestedThiefSkillIds.includes(skillId)),
      true
    );

    const omittedProfessionFixture = (skillIds, professionName) => ({
      ...apiFixture,
      profession: {
        ...apiFixture.profession,
        skills: [...apiFixture.profession.skills, ...skillIds.map((id) => ({ id }))]
      },
      skills: [
        ...apiFixture.skills,
        ...skillIds.map((id) => ({
          id,
          name: `${professionName} skill ${id}`,
          type: 'Utility',
          slot: 'Utility',
          facts: []
        }))
      ]
    });
    const omittedSkillsByProfession = Object.freeze({
      engineer: [
        5811, 5818, 5821, 5825, 5832, 5834, 5836, 5837, 5838, 5860, 5861, 5862, 5865, 5893, 5900, 5904, 5910, 5912,
        5913, 5960, 5968, 6113, 29739, 30101, 41218, 44646, 77018
      ],
      guardian: [9150, 9182, 9245, 29786, 30461, 30871, 41571, 68676],
      mesmer: [10197, 10200, 10201, 10203, 10236, 62573],
      necromancer: [10612, 40274, 42917],
      ranger: [12494, 12500, 12502, 12542, 12550, 31582, 31746, 34309, 45142, 45789, 45970, 63195, 63256],
      thief: [13020, 13035, 13096, 76784, 76808, 76879, 77361],
      warrior: [14368, 14403, 14413, 14479, 76769, 76934]
    });

    // The profession updater owns these exclusions so refreshing generated data cannot restore unsupported skills.
    for (const [professionName, skillIds] of Object.entries(omittedSkillsByProfession)) {
      const snapshot = await updateProfessionApiData(professionName, {
        fetchImpl: createFixtureFetch([], omittedProfessionFixture(skillIds, professionName)),
        snapshotDate: '2026-07-27',
        output: path.join(directory, `${professionName}-api-metadata.ts`),
        log: () => {}
      });

      assert.equal(
        snapshot.skills.some((skill) => skillIds.includes(skill.id)),
        false,
        professionName
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
