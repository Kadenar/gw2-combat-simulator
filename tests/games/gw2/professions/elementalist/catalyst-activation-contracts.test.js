import assert from 'node:assert/strict';
import test from 'node:test';
import { skillEffectKey } from '#gw2/platform/effects/validation.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { catalystCombatStarted } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/trigger-points.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { empoweringAuraStacks } from '#gw2/professions/elementalist/specializations/catalyst/traits/auras.js';
import {
  applyElementalEmpowermentAttributes,
  CATALYST_BASE_EMPOWERMENT_TASK
} from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const cause = (at, fields = {}) => ({
  at,
  source: 'Fixture',
  sourceId: 'fixture',
  skillName: 'Fixture',
  actorType: 'player',
  ...fields
});
const combo = (runtime) => runtime.mechanics.combat.react('combo.resolved', cause(runtime.time, { type: 'combo' }));
const aura = (runtime) =>
  applyElementalistAura(runtime.mechanics, { ...cause(runtime.time), aura: 'Fire Aura', duration: 4 });
const buffs = (result, id) => result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === id);

/** Use native delivery with producer registration chosen independently from selected traits and explicit state. */
function run({ traitTriggers = true, duration = 2, rotation, ...config } = {}, options = {}) {
  const result = runElementalist(
    rotation ?? [{ type: 'combat-start' }, { type: 'wait', durationMs: duration * 1000 }],
    { specialization: 'Catalyst', startAttunement: 'Fire', selectedTraitIds: [], ...config },
    {
      ...options,
      profession: { runtimeFor: (config) => elementalistProfession.runtimeFor(config, { traitTriggers }) }
    }
  );
  assert.deepEqual(result.warnings, []);
  return { result, runtime: observedRuntime(result) };
}

for (const [origin, produce] of [
  ['aura', aura],
  ['combo', combo]
]) {
  test(`Catalyst ${origin} rewards obey selection and isolation without duplicate aura consequences`, () => {
    for (const selected of [false, true]) {
      for (const traitTriggers of [false, true]) {
        const { result, runtime } = run(
          {
            traitTriggers,
            selectedTraitIds: selected
              ? [TRAIT.EMPOWERING_AURAS, TRAIT.ELEMENTAL_EPITOME, TRAIT.ELEMENTAL_SYNERGY, TRAIT.ZEPHYRS_BOON]
              : []
          },
          { timeline: [{ at: 1, run: produce }] }
        );
        const active = selected && traitTriggers;
        assert.equal(buffs(result, TRAIT.EMPOWERING_AURAS).length, Number(active));
        assert.equal(buffs(result, TRAIT.ELEMENTAL_EPITOME).length, Number(active));
        assert.equal(buffs(result, TRAIT.ELEMENTAL_SYNERGY).length, Number(active && origin === 'combo'));
        assert.equal(runtime.profession.core.activeAuras.length, Number(origin === 'aura' || active));
        assert.equal(catalystState.from(runtime).empoweringAuras.stacks, Number(active));
        assert.equal(catalystState.from(runtime).elementalEmpowermentExpiries.length, Number(active));
        assert.equal(Object.keys(runtime.procs.snapshot()).length, active && origin === 'combo' ? 2 : 0);
        if (active) {
          const sources = result.resolvedEvents.filter((event) => event.type === 'buff').map((event) => event.sourceId);
          assert.ok(sources.lastIndexOf(TRAIT.ZEPHYRS_BOON) < sources.indexOf(TRAIT.EMPOWERING_AURAS));
          for (const reward of [...buffs(result, TRAIT.EMPOWERING_AURAS), ...buffs(result, TRAIT.ELEMENTAL_EPITOME)]) {
            assert.equal(reward.actorType, 'player');
            assert.equal(reward.resolvedAudience.includesSelf, true);
          }
        }
      }
    }
  });
}

test('Vicious Empowerment gates both accepted inputs and shares one strict cooldown', () => {
  for (const selected of [false, true]) {
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(
        { traitTriggers, selectedTraitIds: selected ? [TRAIT.VICIOUS_EMPOWERMENT] : [] },
        {
          timeline: [
            { at: 1, type: 'control', control: 'Stun' },
            { at: 1.25, type: 'condition', condition: 'Immobilized' },
            { at: 1.3, type: 'condition', condition: 'Immobilized' }
          ].map((event) => ({
            at: event.at,
            run: (runtime) =>
              runtime.effects.emit({ kind: 'packet', event: cause(event.at, { duration: 1, stacks: 1, ...event }) })
          }))
        }
      );
      const active = selected && traitTriggers;
      assert.equal(buffs(result, TRAIT.VICIOUS_EMPOWERMENT).length, active ? 4 : 0);
      assert.equal(catalystState.from(runtime).elementalEmpowermentExpiries.length, active ? 4 : 0);
      assert.equal(runtime.procs.deadline('elementalist.catalyst.viciousEmpowerment'), active ? 1.55 : 0);
    }
  }
});

test('Vicious Empowerment retains actor, condition and precombat eligibility', () => {
  for (const event of [
    { type: 'control', actorType: 'summon' },
    { type: 'condition', condition: 'Immobilized', actorType: 'effect' },
    { type: 'condition', condition: 'Crippled' },
    { type: 'control', at: 0 }
  ]) {
    const { result, runtime } = run(
      { selectedTraitIds: [TRAIT.VICIOUS_EMPOWERMENT], rotation: [{ type: 'wait', durationMs: 2000 }] },
      {
        combatStartTime: 0.5,
        timeline: [
          {
            at: event.at ?? 1,
            run(runtime) {
              runtime.mechanics.combat.react(
                event.type === 'control' ? 'control.resolved' : 'condition.applied',
                cause(runtime.time, event)
              );
            }
          }
        ]
      }
    );
    assert.deepEqual(buffs(result, TRAIT.VICIOUS_EMPOWERMENT), []);
    assert.equal(runtime.procs.deadline('elementalist.catalyst.viciousEmpowerment'), 0);
  }
});

test('Catalyst removed combo and control payloads still consume their admitted cooldowns', () => {
  const ids = [TRAIT.ELEMENTAL_EPITOME, TRAIT.ELEMENTAL_SYNERGY, TRAIT.VICIOUS_EMPOWERMENT];
  const { result, runtime } = run(
    { selectedTraitIds: ids },
    {
      catalog: (catalog) =>
        ids.reduce(
          (current, id) =>
            withProfile(current, id, {
              effects: [],
              removedEffectKeys: current.balanceProfilesById
                .get(id)
                .effects.map((effect) => skillEffectKey(effect.type, effect.name))
            }),
          catalog
        ),
      timeline: [
        {
          at: 1,
          run(runtime) {
            combo(runtime);
            runtime.mechanics.combat.react('control.resolved', cause(1, { type: 'control' }));
          }
        }
      ]
    }
  );
  assert.deepEqual(
    ids.flatMap((id) => buffs(result, id)),
    []
  );
  assert.equal(runtime.profession.core.activeAuras.length, 0);
  assert.equal(runtime.procs.deadline('elementalist.catalyst.elementalEpitome:Fire'), 11);
  assert.equal(runtime.procs.deadline('elementalist.catalyst.elementalSynergy:Fire'), 11);
  assert.equal(runtime.procs.deadline('elementalist.catalyst.viciousEmpowerment'), 1.25);
});

test('Elemental Empowerment starts only one selected and enabled renewal loop', () => {
  for (const selected of [false, true]) {
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(
        { duration: 31, traitTriggers, selectedTraitIds: selected ? [TRAIT.ELEMENTAL_EMPOWERMENT] : [] },
        { timeline: [{ at: 1, run: (runtime) => runtime.fireTrigger(catalystCombatStarted, {}) }] }
      );
      const active = selected && traitTriggers;
      assert.equal(catalystState.from(runtime).elementalEmpowermentRefreshStarted, active);
      assert.deepEqual(
        buffs(result, TRAIT.ELEMENTAL_EMPOWERMENT).map((event) => event.at),
        active ? [0, 15, 30] : []
      );
      assert.equal(catalystState.from(runtime).elementalEmpowermentExpiries.length, active ? 3 : 0);
    }
  }
});

test('An explicitly admitted renewal task survives disabled or unselected producers', () => {
  for (const selectedTraitIds of [[], [TRAIT.ELEMENTAL_EMPOWERMENT]]) {
    const { result, runtime } = run(
      { traitTriggers: false, selectedTraitIds, duration: 17 },
      { initialize: (runtime) => runtime.schedule(CATALYST_BASE_EMPOWERMENT_TASK, 1, null) }
    );
    assert.equal(catalystState.from(runtime).elementalEmpowermentRefreshStarted, false);
    assert.deepEqual(
      buffs(result, TRAIT.ELEMENTAL_EMPOWERMENT).map((event) => event.at),
      [1, 16]
    );
    assert.equal(catalystState.from(runtime).elementalEmpowermentExpiries.length, 3);
  }
});

test('Explicit Catalyst stacks keep recipient rules, passive attributes and expiry under isolation', () => {
  for (const selectedTraitIds of [[], [TRAIT.ELEMENTAL_EMPOWERMENT, TRAIT.EMPOWERING_AURAS]]) {
    run(
      { traitTriggers: false, selectedTraitIds, duration: 5 },
      {
        timeline: [
          {
            at: 1,
            run(runtime) {
              for (const kind of ['empowering auras', 'elemental empowerment']) {
                for (const recipients of ['self', 'party'])
                  runtime.effects.emit({
                    kind: 'packet',
                    event: cause(1, {
                      type: 'buff',
                      kind,
                      stacks: 2,
                      duration: 3,
                      audience:
                        recipients === 'self'
                          ? { recipients: 'self' }
                          : { recipients: 'party', maximumRecipients: 5, affectsSelf: false }
                    })
                  });
              }
            }
          },
          { at: 2, run: aura }
        ],
        probes: [2, 4].map((at) => [
          at,
          (runtime) => {
            const live = at < 4;
            const modifier = {
              runtime,
              time: at,
              traits: new Set(selectedTraitIds),
              helpers: runtime.helpers,
              config: runtime.config
            };
            assert.equal(empoweringAuraStacks(modifier), live ? 2 : 0);
            assert.equal(
              applyElementalEmpowermentAttributes(modifier, { power: 1000 }).power,
              live && selectedTraitIds.length ? 1020 : 1000
            );
            assert.equal(
              catalystState.from(runtime).empoweringAuras.expiresAt,
              4,
              'disabled aura producers cannot refresh explicit stacks'
            );
            assert.equal(catalystState.from(runtime).elementalEmpowermentExpiries.length, 2);
          }
        ])
      }
    );
  }
});

test('Air combo grants capped endurance while intrinsic Catalyst energy remains available under isolation', () => {
  for (const traitTriggers of [false, true]) {
    run(
      {
        traitTriggers,
        startAttunement: 'Air',
        initialCatalystEnergy: 29.5,
        selectedTraitIds: [TRAIT.ELEMENTAL_SYNERGY]
      },
      {
        timeline: [
          {
            at: 1,
            run(runtime) {
              runtime.endurance.spend(25);
              const before = runtime.profession.core.endurance.value;
              combo(runtime);
              assert.equal(runtime.profession.core.endurance.value, traitTriggers ? 100 : before);
              runtime.mechanics.combat.react('damage.resolved', cause(1, { type: 'damage', coefficient: 1 }), {});
              assert.equal(runtime.resourceController.value('catalystEnergy'), 30);
            }
          }
        ]
      }
    );
  }
});
