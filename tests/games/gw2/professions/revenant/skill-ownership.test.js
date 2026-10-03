import assert from 'node:assert/strict';
import test from 'node:test';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const core = (result) => observedRuntime(result).profession.core;

// Removing an intrinsic declaration must remove its transition, rather than leave a second hook dispatcher active.
for (const [skillId, specialization, legend, active] of [
  [ID.IMPERIAL_GUARD, 'Core', LEGEND.ASSASSIN, (result) => Boolean(core(result).availableFlips[ID.TRUE_STRIKE])],
  [ID.ENCHANTED_DAGGERS, 'Core', LEGEND.ASSASSIN, (result) => core(result).enchantedDaggers.charges > 0],
  [
    ID.BLOSSOMING_AURA,
    'Core',
    LEGEND.ASSASSIN,
    (result) => Boolean(core(result).availableFlips[ID.DETONATE_BLOSSOMING_AURA])
  ],
  [ID.ABYSSAL_RAZE, 'Core', LEGEND.ASSASSIN, (result) => core(result).crushingAbyss.length > 0],
  [ID.IMPOSSIBLE_ODDS, 'Core', LEGEND.ASSASSIN, (result) => core(result).activeUpkeeps.length > 0],
  [ID.SWAP_LEGENDS, 'Core', LEGEND.ASSASSIN, (result) => core(result).activeLegendId === LEGEND.DEMON],
  [
    ID.FACET_OF_NATURE,
    'Herald',
    LEGEND.ASSASSIN,
    (result) => Boolean(core(result).availableFlips[ID.TRUE_NATURE_ASSASSIN])
  ],
  [
    ID.RAZORCLAWS_RAGE,
    'Renegade',
    LEGEND.RENEGADE,
    (result) => renegadeState.from(observedRuntime(result)).razorclawsRage.charges > 0
  ],
  [
    ID.BREAKRAZORS_BASTION,
    'Renegade',
    LEGEND.RENEGADE,
    (result) => renegadeState.from(observedRuntime(result)).bandTogetherReady
  ],
  [
    VINDICATOR_JUMP_SKILL.id,
    'Vindicator',
    LEGEND.ASSASSIN,
    (result) => result.events.some((event) => event.type === 'damage')
  ],
  [
    ID.BEGUILING_HAZE,
    'Conduit',
    LEGEND.ENTITY,
    (result) => conduitState.from(observedRuntime(result)).beguilingHazeCharges > 0
  ],
  [
    ID.COSMIC_WISDOM,
    'Conduit',
    LEGEND.DEMON,
    (result) => conduitState.from(observedRuntime(result)).cosmicWisdomUntil > 0
  ]
]) {
  test(`skill ${skillId} owns its intrinsic transition`, () => {
    for (const removed of [false, true]) {
      const result = runRevenant(
        [{ skillId }, wait(1000)],
        {
          specialization,
          selectedLegends: [legend, legend === LEGEND.ASSASSIN ? LEGEND.DEMON : LEGEND.ASSASSIN],
          startingLegend: legend,
          initialEnergy: 100
        },
        {
          catalog: (catalog) => (removed ? withSkill(catalog, skillId, { sideEffects: [] }) : catalog)
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(active(result), !removed);
    }
  });
}

test('cancelled True Strike consumes the window opened by a shortened blocking channel', () => {
  const result = runRevenant([
    { skillId: ID.IMPERIAL_GUARD, interruptMs: 100 },
    { skillId: ID.TRUE_STRIKE, interruptMs: 0 }
  ]);
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).availableFlips[ID.TRUE_STRIKE], undefined);
  const blocking = result.events.find((event) => event.kind === 'blocking');
  const guard = result.steps.find((step) => step.skillId === ID.IMPERIAL_GUARD);
  assert.equal(blocking.duration, (guard.end - guard.start) / 1000);
  assert.equal(
    result.events.some((event) => event.type === 'damage'),
    false
  );
});

test('Requiem target-size eligibility is fixed at acceptance', () => {
  // A changed target assumption after acceptance cannot add or remove the conditional component.
  for (const initial of ['small', 'large']) {
    const result = runRevenant(
      [{ skillId: ID.ETERNITYS_REQUIEM }, wait(2500)],
      {
        professionAssumptions: { hitboxSize: initial }
      },
      {
        initialize(runtime) {
          runtime.schedule('test.change-hitbox', 0.1);
        },
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'test.change-hitbox'(runtime) {
              runtime.config.professionAssumptions.hitboxSize = initial === 'small' ? 'large' : 'small';
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const conditional = result.events.find((event) => event.type === 'damage' && event.at > 1.8);
    assert.equal(Boolean(conditional), initial === 'large');
  }
});

test('Heroic Command refreshes only live Fervor at commitment, including when Might is removed', () => {
  for (const removed of [false, true]) {
    const result = runRevenant(
      [{ skillId: ID.HEROIC_COMMAND }],
      {
        specialization: 'Renegade',
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE
      },
      {
        catalog: (catalog) =>
          withSkill(
            removed
              ? applySkillPatch(catalog, {
                  skills: { [ID.HEROIC_COMMAND]: { removeEffects: [{ type: 'boon', name: 'might' }] } }
                })
              : catalog,
            ID.HEROIC_COMMAND,
            { castTimeMs: 1000 }
          ),
        initialize(runtime) {
          renegadeState.from(runtime).kallasFervor = [
            { at: 0, expiresAt: 0.5 },
            { at: 0, expiresAt: 2 }
          ];
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const fervor = renegadeState.from(observedRuntime(result)).kallasFervor;
    assert.equal(fervor.length, 1);
    assert.ok(fervor[0].expiresAt > 2);
    const might = result.events.find((event) => event.type === 'buff' && event.kind === 'might');
    assert.equal(Boolean(might), !removed);
    if (might) assert.equal(might.stacks, 2);
  }
});

test('Cosmic Wisdom grants Core traits once before form activation', () => {
  const order = [];
  const result = runRevenant(
    ['__combat_start', { skillId: ID.COSMIC_WISDOM }],
    {
      specialization: 'Conduit',
      selectedTraitIds: [TRAIT.NOTORIETY],
      selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
      startingLegend: LEGEND.DEMON
    },
    {
      extend: (native) => ({
        sideEffectHandlers: {
          ...native.sideEffectHandlers,
          'revenant.cosmic-wisdom'(runtime, context, action) {
            // Observe synchronous trait publication at the point it can still see pre-form attributes.
            const effects = runtime.effects;
            runtime.effects = {
              emit(request) {
                const event = request.kind === 'packet' ? request.event : request.attribution;
                if (event?.sourceId === TRAIT.NOTORIETY) order.push(conduitState.from(runtime).conduitForm);
                return effects.emit(request);
              }
            };

            try {
              native.sideEffectHandlers[action.type](runtime, context, action);
            } finally {
              runtime.effects = effects;
            }
          }
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(order, ['']);
  assert.equal(result.events.filter((event) => event.sourceId === TRAIT.NOTORIETY).length, 1);
  assert.equal(conduitState.from(observedRuntime(result)).conduitForm, 'Mesmer');
});

test('Herald consume publishes Core rewards before establishing Echo retention', () => {
  const retainedDuringReward = [];
  const result = runRevenant(
    ['__combat_start', 'Facet of Nature', { skillId: ID.TRUE_NATURE_DRAGON }],
    {
      specialization: 'Herald',
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      selectedTraitIds: [TRAIT.NOTORIETY, TRAIT.DRACONIC_ECHO]
    },
    {
      initialize(runtime) {
        // Retaining Dragon Nature too early would change the duration of the consume's own Core reward.
        const effects = runtime.effects;
        runtime.effects = {
          emit(request) {
            const event = request.kind === 'packet' ? request.event : request.attribution;
            if (event?.sourceId === TRAIT.NOTORIETY && event.skillId === ID.TRUE_NATURE_DRAGON)
              retainedDuringReward.push(Boolean(heraldState.from(runtime).lingeringFacets[ID.FACET_OF_NATURE]));
            return effects.emit(request);
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(retainedDuringReward, [false]);
  assert.ok(heraldState.from(observedRuntime(result)).lingeringFacets[ID.FACET_OF_NATURE]);
});

test('Twin Moon affinity belongs to each resolved player packet, independently of fragments', () => {
  for (const offTarget of [false, true]) {
    for (const removed of [false, true]) {
      const result = runRevenant(
        ['__combat_start', { skillId: ID.TWIN_MOON_SWEEP, offTarget }],
        {
          specialization: 'Conduit',
          selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
          startingLegend: LEGEND.ENTITY
        },
        {
          catalog: (catalog) =>
            withSkill(catalog, ID.TWIN_MOON_SWEEP, {
              effects: catalog.skillsById.get(ID.TWIN_MOON_SWEEP).effects.map((effect) =>
                effect.reactions
                  ? {
                      ...effect,
                      ticks: [
                        { atMs: 400, coefficient: 1 },
                        { atMs: 800, coefficient: 1 }
                      ],
                      ...(removed ? { reactions: [] } : {})
                    }
                  : effect
              )
            })
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(conduitState.from(observedRuntime(result)).affinity, removed || offTarget ? 0 : 4);
    }
  }
});
