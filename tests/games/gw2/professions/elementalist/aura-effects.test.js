import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { effectPlanningState } from '#tests/helpers/effect-report.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { applyResolverElementalShielding } from '#gw2/professions/elementalist/core/traits/earth.js';
import { applyResolverZephyrsBoon } from '#gw2/professions/elementalist/core/traits/air.js';
import { applyElementalistAttunementTraits } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { catalystModule } from '#gw2/professions/elementalist/specializations/catalyst/module.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystEffectStates } from '#gw2/professions/elementalist/specializations/catalyst/effect-state.js';
import {
  applyEmpoweringAura,
  applyEmpoweringAurasBuff,
  empoweringAuraStacks
} from '#gw2/professions/elementalist/specializations/catalyst/traits/auras.js';
import { catalystUi } from '#gw2/professions/elementalist/specializations/catalyst/presentation.js';
import { triggerSpecializedElementEntry } from '#gw2/professions/elementalist/specializations/evoker/traits/attunements.js';
import { applyTempestResolverAura } from '#gw2/professions/elementalist/specializations/tempest/traits/auras.js';
import { runElementalist, runNative } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('real and synthetic Air entry honor trait gates and patched buff versus boon durations', () => {
  // Producers preserve authored duration; the shared dispatcher owns concentration scaling.
  for (const duration of [9, 1]) {
    const catalog = applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: {
        [TRAIT.ONE_WITH_AIR]: { effects: [{ type: 'buff', name: 'Superspeed', duration }] },
        [TRAIT.INSCRIPTION]: { effects: [{ type: 'boon', name: 'Air Entry', duration: 7, stacks: 2 }] }
      }
    });
    for (const selected of [[], [TRAIT.ONE_WITH_AIR], [TRAIT.INSCRIPTION], [TRAIT.ONE_WITH_AIR, TRAIT.INSCRIPTION]]) {
      for (const synthetic of [false, true]) {
        const events = [];
        const skill = { id: 1, name: 'Air entry' };
        const config = { stats: { concentration: 750 } };
        const context = observedRuntime(runElementalist([], { ...config, specialization: 'Evoker' }));
        Object.assign(context, {
          helpers: catalog,
          traits: new Set(selected),
          time: 4,
          effectiveEnd: 4,
          effects: captureEffectEmissions({ submit: (event) => events.push(event) }).effects
        });
        if (synthetic)
          triggerSpecializedElementEntry(
            context,
            { id: 'fixture-cast', skill, command: {}, effectiveEnd: context.effectiveEnd },
            skill,
            'Air'
          );
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
            ...(selected.includes(TRAIT.INSCRIPTION) ? [{ kind: 'resistance', stacks: 2, duration: 7 }] : [])
          ]
        );
        for (const event of buffs) {
          assert.equal(event.at, 4);
          // The trait owns the grant; the triggering skill remains available for timing and attribution.
          assert.equal(event.source, 'Trait');
          assert.equal(event.sourceId, event.kind === 'superspeed' ? TRAIT.ONE_WITH_AIR : TRAIT.INSCRIPTION);
          assert.equal(event.skillName, skill.name);
          assert.equal(event.actorType, 'player');
        }
      }
    }
  }
});

// Every aura enters one reaction pipeline, including patched boon payloads and duration scaling.
test('Core and Tempest aura boons submit patched authored effects', () => {
  for (const [trait, traitId, profileId, names, resolve] of [
    ["Zephyr's Boon", TRAIT.ZEPHYRS_BOON, TRAIT.ZEPHYRS_BOON, ['Fury', 'Swiftness'], applyResolverZephyrsBoon],
    [
      'Elemental Shielding',
      TRAIT.ELEMENTAL_SHIELDING,
      TRAIT.ELEMENTAL_SHIELDING,
      ['Protection'],
      applyResolverElementalShielding
    ],
    [
      'Invigorating Torrents',
      TRAIT.INVIGORATING_TORRENTS,
      TRAIT.INVIGORATING_TORRENTS,
      ['Vigor', 'Regeneration'],
      applyTempestResolverAura
    ],
    ['Elemental Bastion', TRAIT.ELEMENTAL_BASTION, TRAIT.ELEMENTAL_BASTION, ['Alacrity'], applyTempestResolverAura]
  ]) {
    const effects = names.map((name, index) => ({
      type: 'boon',
      name,
      boon: index ? 'Resistance' : 'Might',
      stacks: index + 2,
      duration: index + 7
    }));
    const config = { stats: { concentration: 750 }, specialization: 'Tempest' };
    const context = observedRuntime(runElementalist([], config));
    const events = [];
    context.helpers = withProfile(elementalistCatalog, profileId, { effects });
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
        duration: effect.duration
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
  for (const origin of [{}, { type: 'aura' }]) {
    const queued = [];
    const context = {
      helpers: elementalistCatalog,
      traits: new Set([TRAIT.TEMPESTUOUS_ARIA, TRAIT.INVIGORATING_TORRENTS, TRAIT.ELEMENTAL_BASTION]),
      config: {},
      query: { statsAt: () => ({ concentration: 0 }) },
      boons: new Map([]),
      buffs: new Map([
        ['tempestuous aria', [{ resolvedAudience: { includesSelf: true }, at: 0, expiresAt: 3, stacks: 1 }]]
      ]),
      effects: captureEffectEmissions({ submit: (event) => queued.push(event) }).effects
    };
    // Bind real owner operations for this focused mechanic fixture.
    context.combat = createMechanicCombatServices(context);
    applyTempestResolverAura(context, { type: 'elementalist.aura', at: 1, skillName: 'Fixture Aura', ...origin });
    assert.equal(context.buffs.get('tempestuous aria')[0].expiresAt, 8);
    assert.deepEqual(
      queued.map((event) => event.kind),
      ['vigor', 'regeneration', 'alacrity']
    );
  }
});

test('Catalyst caps and refreshes Empowering Auras while granting Elemental Epitome', () => {
  const queued = [],
    procs = [];
  const state = catalystState.create();
  state.empoweringAuras = { stacks: 1, expiresAt: 3 };
  const context = {
    profession: { core: {}, specialization: { kind: 'Catalyst', state } },
    traits: new Set([TRAIT.EMPOWERING_AURAS, TRAIT.ELEMENTAL_EPITOME]),
    combatStartTime: 0,
    boons: new Map(),
    buffs: new Map(),
    // Both scalar and effect overrides are assembled before aura reactions read their owners.
    helpers: withProfile(
      withProfile(elementalistCatalog, TRAIT.EMPOWERING_AURAS, { maximumStacks: 1, durationMultiplier: 8 }),
      TRAIT.ELEMENTAL_EPITOME,
      { effects: [{ type: 'buff', name: 'Empowerment', stacks: 2, duration: 7 }] }
    ),
    effects: captureEffectEmissions({
      submit: (event) => queued.push(event),
      announce: (request) => procs.push(request.announcement.name)
    }).effects
  };
  // Bind real owner operations for this focused mechanic fixture.
  context.combat = createMechanicCombatServices(context);
  const event = { type: 'elementalist.aura', at: 1, skillName: 'Fixture Aura', sourceId: 1 };
  catalystModule.hooks.reactions['aura.applied'](context, event);
  assert.equal(state.empoweringAuras.expiresAt, 9);
  assert.deepEqual(
    queued.map((event) => event.kind),
    ['elemental empowerment']
  );
  queued.length = 0;
  catalystModule.hooks.reactions['aura.applied'](context, { ...event, at: 2 });
  assert.equal(state.empoweringAuras.expiresAt, 10);
  assert.deepEqual(
    queued.map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
    [{ kind: 'elemental empowerment', stacks: 2, duration: 7 }]
  );
  assert.deepEqual(procs, ['Empowering Auras', 'Empowering Auras']);
});

test('Empowering Auras keeps queued grants, tick-aligned refreshes, exclusive expiry, and read-only observations', () => {
  const state = catalystState.create();
  const { effects, events } = captureEffectEmissions();
  const context = {
    profession: { core: {}, specialization: { kind: 'Catalyst', state } },
    traits: new Set([TRAIT.EMPOWERING_AURAS]),
    catalog: withProfile(elementalistCatalog, TRAIT.EMPOWERING_AURAS, { maximumStacks: 2 }),
    effects
  };
  const aura = (at) => applyEmpoweringAura(context, { at, skillName: 'Fixture Aura' });
  const apply = (event, includesSelf = true) =>
    applyEmpoweringAurasBuff(context, { ...event, resolvedAudience: { includesSelf } });
  aura(0.001);
  assert.equal(state.empoweringAuras.stacks, 0, 'aura acceptance only queues a new stack');
  apply(events.at(-1), false);
  assert.equal(state.empoweringAuras.stacks, 0);
  apply(events.at(-1));
  assert.deepEqual(state.empoweringAuras, { stacks: 1, expiresAt: 10.04 });
  aura(1.001);
  apply(events.at(-1));
  const queued = events.length;
  aura(2.001);
  assert.equal(events.length, queued, 'at-cap refreshes do not queue additional stacks');
  assert.deepEqual(state.empoweringAuras, { stacks: 2, expiresAt: 12.04 });
  const snapshot = catalystEffectStates(context).find((effect) => effect.kind === 'empowering auras');
  const prior = structuredClone(state.empoweringAuras);
  assert.equal(empoweringAuraStacks({ runtime: context, time: 12.039 }), 2);
  assert.equal(empoweringAuraStacks({ runtime: context, time: 12.04 }), 0);
  assert.deepEqual(state.empoweringAuras, prior);
  aura(12.04);
  assert.equal(state.empoweringAuras.stacks, 0);
  apply(events.at(-1));
  assert.equal(state.empoweringAuras.stacks, 1);
  assert.deepEqual(snapshot.windows, [prior], 'later refreshes cannot rewrite earlier observations');
});

test('Catalyst snapshots retain capped aura refreshes without adding or reviving stacks', () => {
  // Exercise real buff resolution and proc reporting, then inspect before and after each window.
  const result = runElementalist(
    [{ type: 'wait', durationMs: 30000 }],
    { specialization: 'Catalyst', selectedTraitIds: [TRAIT.EMPOWERING_AURAS] },
    {
      timeline: [0, 1, 2, 3, 4, 8, 19].map((at) => ({
        at,
        run: (runtime) =>
          catalystModule.hooks.reactions['aura.applied'](runtime, {
            type: 'elementalist.aura',
            at,
            skillName: 'Fixture Aura',
            sourceId: 1,
            actorType: 'player'
          })
      }))
    }
  );
  assert.deepEqual(result.warnings, []);
  const snapshot = (atSeconds) =>
    catalystUi
      .rotationStateSnapshot({
        balanceContext: { catalog: elementalistCatalog, modifierRulesById: new Map() },
        result,
        planningState: effectPlanningState(result, atSeconds),
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
