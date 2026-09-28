import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { applyElementalistAttunementTraits } from '#gw2/professions/elementalist/core/traits/index.js';
import { triggerSpecializedElementEntry } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { applyResolverZephyrsBoon } from '#gw2/professions/elementalist/core/traits/air.js';
import { applyResolverElementalShielding } from '#gw2/professions/elementalist/core/traits/earth.js';
import { applyTempestResolverAura } from '#gw2/professions/elementalist/specializations/tempest/mechanics/aura-effects.js';
import { applyCatalystResolverAura } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { catalystUi } from '#gw2/professions/elementalist/specializations/catalyst/presentation.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/elementalist/core/profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as TEMPEST } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as CATALYST } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

test('real and synthetic Air entry honor trait gates and patched buff versus boon durations', () => {
  // Superspeed must read its buff profile without concentration scaling; Resistance scales once.
  for (const duration of [9, 1]) {
    const catalog = applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: {
        [CORE.oneWithAir]: { effects: [{ type: 'buff', name: 'Superspeed', duration }] },
        [CORE.inscription]: { effects: [{ type: 'boon', name: 'Air Entry', duration: 7, stacks: 2 }] }
      }
    });
    for (const selected of [[], [TRAIT.ONE_WITH_AIR], [TRAIT.INSCRIPTION], [TRAIT.ONE_WITH_AIR, TRAIT.INSCRIPTION]]) {
      for (const synthetic of [false, true]) {
        const events = [];
        const skill = { id: 1, name: 'Air entry' };
        const config = { stats: { concentration: 750 } };
        const context = observedRuntime(
          runElementalist({ config: { ...config, specialization: 'Evoker' }, rotation: [] })
        );
        Object.assign(context, {
          helpers: catalog,
          traits: new Set(selected),
          time: 4,
          effectiveEnd: 4,
          emit: (event) => events.push(event)
        });
        if (synthetic) triggerSpecializedElementEntry(context, context, skill, 'Air');
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
            ...(selected.includes(TRAIT.ONE_WITH_AIR) ? [{ kind: 'superspeed', stacks: 1, duration }] : []),
            ...(selected.includes(TRAIT.INSCRIPTION) ? [{ kind: 'resistance', stacks: 2, duration: 10.5 }] : [])
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

// Every aura enters one reaction pipeline, including patched boon payloads and duration scaling.
test('Core and Tempest aura boons use patched effects and scale once', () => {
  for (const [trait, traitId, profileId, names, resolve] of [
    ["Zephyr's Boon", TRAIT.ZEPHYRS_BOON, CORE.zephyrsBoon, ['Fury', 'Swiftness'], applyResolverZephyrsBoon],
    [
      'Elemental Shielding',
      TRAIT.ELEMENTAL_SHIELDING,
      CORE.elementalShielding,
      ['Protection'],
      applyResolverElementalShielding
    ],
    [
      'Invigorating Torrents',
      TRAIT.INVIGORATING_TORRENTS,
      TEMPEST.invigoratingTorrents,
      ['Vigor', 'Regeneration'],
      applyTempestResolverAura
    ],
    ['Elemental Bastion', TRAIT.ELEMENTAL_BASTION, TEMPEST.elementalBastion, ['Alacrity'], applyTempestResolverAura]
  ]) {
    const effects = names.map((name, index) => ({
      type: 'boon',
      name,
      boon: index ? 'Resistance' : 'Might',
      stacks: index + 2,
      duration: index + 7
    }));
    const config = { stats: { concentration: 750 }, specialization: 'Tempest' };
    const context = observedRuntime(runElementalist({ config, rotation: [] }));
    const events = [];
    const profiles = new Map(elementalistCatalog.balanceProfilesById);
    profiles.set(profileId, { effects });
    context.helpers = { ...elementalistCatalog, balanceProfilesById: profiles };
    context.traits = new Set([traitId]);
    context.queue.enqueue = (event) => events.push(event);
    // Live attribute and cooldown queries use the aura's actual application clock.
    context.time = 4;
    resolve(context, { type: 'elementalist.aura', at: 4, sourceId: 1, skillName: 'Fixture Aura', actorType: 'player' });
    assert.deepEqual(
      events.map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
      effects.map((effect) => ({
        kind: effect.boon.toLowerCase(),
        stacks: effect.stacks,
        duration: effect.duration * 1.5
      })),
      trait
    );
  }
});

test('one Tempest aura resolves each trait boon exactly once', () => {
  // Count authoritative applications in the live pipeline so duplicate grants cannot hide.
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

test('Tempest preserves aura damage windows and grants boons for every actual aura', () => {
  // Every accepted aura refreshes Aria and grants each selected trait once.
  for (const origin of [{}, { elementalistResolverGeneratedAura: true }, { type: 'aura' }]) {
    const queued = [];
    const context = {
      helpers: elementalistCatalog,
      traits: new Set([TRAIT.TEMPESTUOUS_ARIA, TRAIT.INVIGORATING_TORRENTS, TRAIT.ELEMENTAL_BASTION]),
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
      ['vigor', 'regeneration', 'alacrity']
    );
  }
});

test('Catalyst caps and refreshes Empowering Auras while granting Elemental Epitome', () => {
  const queued = [],
    procs = [];
  const context = {
    traits: new Set([TRAIT.EMPOWERING_AURAS, TRAIT.ELEMENTAL_EPITOME]),
    combatStartTime: 0,
    boons: new Map([['empowering auras', [{ at: 0, expiresAt: 3, stacks: 1 }]]]),
    helpers: {
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
  assert.deepEqual(
    queued.map((event) => event.kind),
    ['elemental empowerment']
  );
  queued.length = 0;
  applyCatalystResolverAura(context, { ...event, at: 2, elementalistResolverGeneratedAura: true });
  assert.equal(context.boons.get('empowering auras')[0].expiresAt, 10);
  assert.deepEqual(
    queued.map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
    [{ kind: 'elemental empowerment', stacks: 2, duration: 7 }]
  );
  assert.deepEqual(procs, ['Empowering Auras', 'Empowering Auras']);
});

test('Catalyst snapshots retain capped aura refreshes without adding or reviving stacks', () => {
  // Exercise real buff resolution and proc reporting, then inspect before and after each window.
  const result = runElementalist({
    config: { specialization: 'Catalyst', selectedTraitIds: [TRAIT.EMPOWERING_AURAS] },
    rotation: [{ type: 'wait', durationMs: 30000 }],
    timeline: [0, 1, 2, 3, 4, 8, 19].map((at) => ({
      at,
      run: (runtime) =>
        applyCatalystResolverAura(runtime, {
          type: 'elementalist.aura',
          at,
          skillName: 'Fixture Aura',
          sourceId: 1,
          actorType: 'player'
        })
    }))
  });
  assert.deepEqual(result.warnings, []);
  const snapshot = (atSeconds) =>
    catalystUi
      .rotationStateSnapshot({
        catalog: elementalistCatalog,
        result,
        atSeconds
      })
      .find((item) => item.id === 'catalyst-empowering-auras')?.value;
  assert.equal(snapshot(0), '1/5 · 10.0s');
  assert.equal(snapshot(4), '5/5 · 10.0s');
  assert.equal(snapshot(7), '5/5 · 7.0s');
  assert.equal(snapshot(8), '5/5 · 10.0s');
  assert.equal(snapshot(15), '5/5 · 3.0s');
  assert.equal(snapshot(18), undefined);
  assert.equal(snapshot(19), '1/5 · 10.0s');
  assert.equal(snapshot(29), undefined);
  assert.ok(
    !result.events.some((event) => event.type === 'buff' && event.kind === 'empowering auras' && event.at === 8)
  );
  assert.equal(
    result.procSteps.find((proc) => proc.skill === 'Empowering Auras' && proc.start === 8000).expiresAt,
    18000
  );
});
