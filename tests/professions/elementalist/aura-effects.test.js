import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { applyElementalistAttunementTraits } from '#gw2/professions/elementalist/core/traits/index.js';
import { triggerSpecializedElementEntry } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { applySchedulerZephyrsBoon, applyResolverZephyrsBoon } from '#gw2/professions/elementalist/core/traits/air.js';
import {
  applySchedulerElementalShielding,
  applyResolverElementalShielding
} from '#gw2/professions/elementalist/core/traits/earth.js';
import { tempestSchedulerHooks } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overloads.js';
import { applyTempestResolverAura } from '#gw2/professions/elementalist/specializations/tempest/mechanics/aura-effects.js';
import { applyCatalystResolverAura } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/elementalist/core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as TEMPEST } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as CATALYST } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { runNative } from '../../helpers/elementalist-simulation.js';

test('real and synthetic Air entry honor trait gates and patched buff versus boon durations', () => {
  // Superspeed must read its buff profile without concentration scaling; Resistance scales once.
  for (const duration of [9, 0]) {
    const catalog = applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: {
        [CORE.oneWithAir]: { effects: [{ type: 'buff', name: 'Superspeed', duration }] },
        [CORE.inscription]: { effects: [{ type: 'boon', name: 'Air Entry', duration: 7, stacks: 2 }] }
      }
    });
    for (const selected of [[], ['One with Air'], ['Inscription'], ['One with Air', 'Inscription']]) {
      for (const synthetic of [false, true]) {
        const events = [];
        const skill = { id: 1, name: 'Air entry' };
        const config = { stats: { concentration: 750 } };
        const context = {
          catalog,
          config,
          traits: new Set(selected),
          effectiveEnd: 4,
          state: {
            time: 4,
            activeWeaponSet: 1,
            profession: { core: {}, specialization: { kind: 'Evoker', state: {} } }
          },
          profession: { modifyAttributes: (_context, stats) => stats },
          schedulerPolicy: createGw2SchedulerPolicy(config),
          emit: (event) => events.push(event)
        };
        if (synthetic) triggerSpecializedElementEntry(context, skill, 'Air');
        else {
          applyElementalistAttunementTraits(context, {
            at: 4,
            skill,
            previous: 'Water',
            target: 'Air',
            dualAttunement: false,
            shouldTrigger: () => true
          });
        }

        const buffs = events.filter((event) => event.type === 'buff');
        assert.deepEqual(
          buffs.map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
          [
            ...(selected.includes('One with Air') ? [{ kind: 'superspeed', stacks: 1, duration }] : []),
            ...(selected.includes('Inscription') ? [{ kind: 'resistance', stacks: 2, duration: 10.5 }] : [])
          ]
        );
        for (const event of buffs) {
          assert.equal(event.at, 4);
          assert.equal(event.sourceId, skill.id);
          assert.equal(event.skillName, skill.name);
          assert.equal(event.actorType, 'player');
        }
      }
    }
  }
});

test('Core and Tempest aura boons use patched effects and scale once in each phase', () => {
  for (const [trait, profileId, names, schedule, resolve] of [
    ["Zephyr's Boon", CORE.zephyrsBoon, ['Fury', 'Swiftness'], applySchedulerZephyrsBoon, applyResolverZephyrsBoon],
    [
      'Elemental Shielding',
      CORE.elementalShielding,
      ['Protection'],
      applySchedulerElementalShielding,
      applyResolverElementalShielding
    ],
    ['Invigorating Torrents', TEMPEST.invigoratingTorrents, ['Vigor', 'Regeneration'], null, applyTempestResolverAura],
    ['Elemental Bastion', TEMPEST.elementalBastion, ['Alacrity'], null, applyTempestResolverAura]
  ]) {
    const scheduled = [],
      resolved = [],
      procs = [];
    // Distinct patched payloads catch stale defaults, effect ordering, and double scaling.
    const effects = names.map((name, index) => ({
      type: 'boon',
      name,
      boon: index ? 'Resistance' : 'Might',
      stacks: index + 2,
      duration: index + 7
    }));
    const catalog = {
      skillsById: new Map(),
      skillsByName: new Map(),
      balanceProfilesById: new Map([[profileId, { effects }]])
    };
    const config = { stats: { concentration: 750 } };
    const event = {
      type: 'elementalist.aura',
      at: 4,
      source: 'Fixture Aura',
      sourceId: 1,
      skillName: 'Fixture Aura',
      actorType: 'player'
    };
    const common = { catalog, config, traits: new Set([trait]) };
    const scheduler = {
      ...common,
      events: [],
      state: { time: 4, activeWeaponSet: 1, profession: {} },
      profession: { modifyAttributes: (_context, stats) => stats },
      schedulerPolicy: createGw2SchedulerPolicy(config),
      emit: (output) => scheduled.push(output)
    };
    if (schedule) schedule(scheduler, event.at, event.skillName, event.sourceId);
    else tempestSchedulerHooks.onEventScheduled.handler(scheduler, event);
    resolve(
      {
        ...common,
        activeWeaponSet: 1,
        query: { statsAt: () => config.stats },
        queue: { enqueue: (output) => resolved.push(output) },
        recordProc: (_type, name) => procs.push(name)
      },
      { ...event, elementalistResolverGeneratedAura: true }
    );
    for (const events of [scheduled, resolved]) {
      assert.deepEqual(
        events.map(({ kind, stacks, duration, at, sourceId, actorType }) => ({
          kind,
          stacks,
          duration,
          at,
          sourceId,
          actorType
        })),
        effects.map((effect) => ({
          kind: effect.boon.toLowerCase(),
          stacks: effect.stacks,
          duration: effect.duration * 1.5,
          at: 4,
          sourceId: 1,
          actorType: 'player'
        })),
        trait
      );
    }

    assert.deepEqual(procs, schedule ? [] : [trait]);
  }
});

test('one scheduled Tempest aura resolves each trait boon exactly once', () => {
  // Count authoritative applications after both phases so duplicate grants cannot hide in separate phase tests.
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '1-3-3']],
    startAttunement: 'Water',
    weapons: ['Dagger', 'Dagger'],
    rotation: ['Frost Aura', 1000]
  });
  assert.deepEqual(result.warnings, []);
  for (const kind of ['vigor', 'regeneration', 'alacrity']) {
    assert.equal(result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === kind).length, 1, kind);
  }
});

test('Tempest preserves aura damage windows and grants boons only for resolver-owned auras', () => {
  // All aura origins refresh Aria, but scheduled auras already have their boon payloads.
  for (const origin of [{}, { elementalistResolverGeneratedAura: true }, { type: 'aura' }]) {
    const queued = [];
    const context = {
      traits: new Set(['Tempestuous Aria', 'Invigorating Torrents', 'Elemental Bastion']),
      config: {},
      query: { statsAt: () => ({ concentration: 0 }) },
      boons: new Map([['tempestuous aria', [{ at: 0, expiresAt: 3, stacks: 1 }]]]),
      queue: { enqueue: (event) => queued.push(event) },
      recordProc: () => {}
    };
    applyTempestResolverAura(context, { type: 'elementalist.aura', at: 1, skillName: 'Fixture Aura', ...origin });
    assert.equal(context.boons.get('tempestuous aria')[0].expiresAt, 8);
    assert.deepEqual(
      queued.map((event) => event.kind),
      Object.keys(origin).length ? ['vigor', 'regeneration', 'alacrity'] : []
    );
  }
});

test('Catalyst refreshes scheduled aura stacks without granting again and caps resolver-generated grants', () => {
  const queued = [],
    procs = [];
  const context = {
    traits: new Set(['Empowering Auras', 'Elemental Epitome']),
    combatStartTime: 0,
    boons: new Map([['empowering auras', [{ at: 0, expiresAt: 3, stacks: 1 }]]]),
    catalog: {
      balanceProfilesById: new Map([
        [CATALYST.empoweringAuras, { maximumStacks: 1, durationMultiplier: 8 }],
        [CATALYST.elementalEpitome, { effects: [{ type: 'buff', name: 'Empowerment', stacks: 2, duration: 7 }] }]
      ])
    },
    queue: { enqueue: (event) => queued.push(event) },
    recordProc: (_type, name) => procs.push(name)
  };
  const event = { type: 'elementalist.aura', at: 1, skillName: 'Fixture Aura', sourceId: 1 };
  applyCatalystResolverAura(context, event);
  assert.equal(context.boons.get('empowering auras')[0].expiresAt, 9);
  assert.deepEqual(queued, []);
  applyCatalystResolverAura(context, { ...event, at: 2, elementalistResolverGeneratedAura: true });
  assert.equal(context.boons.get('empowering auras')[0].expiresAt, 10);
  assert.deepEqual(
    queued.map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
    [{ kind: 'elemental empowerment', stacks: 2, duration: 7 }]
  );
  assert.deepEqual(procs, ['Empowering Auras', 'Empowering Auras']);
});
