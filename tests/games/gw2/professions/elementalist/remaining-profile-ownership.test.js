import assert from 'node:assert/strict';
import test from 'node:test';
import { applySkillPatch, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createHammerOrbs } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { describeSimulationSkill, describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import {
  applyShatteringIce,
  applyCatalystResolvedDamage
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { applyCalcifyProtection } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

// The creating skill refreshes existing orbs as well as its own elements, and presentation reads that same duration.
test('Core and Weaver orb skills own refresh duration and expiry', () => {
  for (const [id, specialization, elements] of [
    [ID.FLAME_WHEEL, 'Core', ['Fire']],
    [ID.DUAL_ORBITS_FIRE_AND_WATER, 'Weaver', ['Fire', 'Water']]
  ]) {
    const catalog = applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { orbDuration: 2.5 } } } });
    const result = runElementalist(
      [{ type: 'wait', durationMs: 3000 }],
      { specialization, primaryWeapon: 'Hammer' },
      {
        catalog: () => catalog,
        initialize(runtime) {
          runtime.profession.core.hammerOrbs.Air = 10;
          createHammerOrbs(
            runtime,
            { id: 'orb-grant', effectiveEnd: 0, command: {}, skill: catalog.skillsById.get(id) },
            catalog.skillsById.get(id),
            elements
          );
        },
        probes: [
          [
            1,
            (runtime) => {
              for (const element of ['Air', ...elements])
                assert.equal(runtime.profession.core.hammerOrbs[element], 2.5);
            }
          ],
          [
            3,
            (runtime) => {
              for (const element of ['Air', ...elements])
                assert.equal(runtime.profession.core.hammerOrbs[element], null);
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const { tooltip: model } = fixture(id, { fields: { orbDuration: 2.5 } }, specialization, {});
    assert.equal(model.facts.find(({ name }) => name === 'Refreshed orb duration').detail, '2.5s');
  }

  for (const id of ['elementalist.core.resources', 'elementalist.core.hammer-orbs'])
    assert.throws(
      () => applyBalanceProfilePatch(elementalistCatalog, { balanceProfiles: { [id]: { fields: {} } } }),
      /unknown balance profile/
    );
});

// Isolate accepted proc boundaries while retaining canonical skill patches and real packet materialization.
function fixture(id, edit, specialization, state) {
  const catalog = applySkillPatch(elementalistCatalog, { skills: { [id]: edit } });
  const capture = captureEffectEmissions();
  const context = {
    helpers: catalog,
    catalog,
    profession: { specialization: { kind: specialization, state } },
    effects: capture.effects,
    config: {}
  };
  context.procs = createProcRegistry(() => context);
  const profession = withPatchPreview(elementalistProfession, {
    id: 'proc-ownership',
    label: 'Proc ownership',
    professions: { elementalist: {} }
  });
  const balance = { ...profession.resolvePatch({ id: 'proc-ownership' }).balanceContext, catalog };
  return {
    context,
    events: capture.events,
    tooltip: describeSimulationSkill(balance, catalog.skillsById.get(id), elementalistTooltips)
  };
}

test('Shattering Ice action rewards share the selected interval and independent removal without changing rearm', () => {
  for (const removed of [[], ['strike'], ['condition'], ['strike', 'condition']]) {
    const { context, events, tooltip } = fixture(
      ID.SHATTERING_ICE,
      {
        fields: { internalCooldown: 2 },
        sideEffects: {
          'triggered-packet': {
            effects: [
              { type: 'strike', coefficient: 1.4 },
              { type: 'condition', condition: 'Chilled', duration: 3 }
            ],
            removeEffects: removed.map((type) => ({ type }))
          }
        }
      },
      'Catalyst',
      catalystState.create()
    );
    const arm = (at) =>
      applyShatteringIce(context, {
        type: 'buff',
        kind: 'shattering ice',
        at,
        duration: 8,
        resolvedAudience: { includesSelf: true }
      });
    const hit = (at) =>
      applyCatalystResolvedDamage(context, {
        type: 'damage',
        at,
        actorType: 'player',
        coefficient: 1,
        skillId: 42,
        skillName: 'Trigger'
      });
    arm(0);
    for (const at of [1, 3, 3.001]) hit(at);
    assert.equal(context.procs.deadline('elementalist.catalyst.shatteringIce'), 3.001 + 2);
    assert.equal(events.filter((event) => event.type === 'damage').length, removed.includes('strike') ? 0 : 2);
    assert.equal(events.filter((event) => event.type === 'condition').length, removed.includes('condition') ? 0 : 2);
    for (const event of events) {
      assert.equal(event.sourceId, 42);
      assert.equal(event.triggeredBy, 'Trigger');

      if (event.type === 'damage') assert.equal(event.coefficient, 1.4);

      if (event.type === 'condition') assert.equal(event.duration, 3);
    }

    arm(4);
    hit(4);
    assert.equal(context.procs.deadline('elementalist.catalyst.shatteringIce'), 6);
    assert.equal(tooltip.facts.find((fact) => fact.name === 'Trigger interval').detail, '2s');
    assert.equal(
      tooltip.facts.some((fact) => fact.name === 'Chilled'),
      !removed.includes('condition')
    );
    assert.equal(
      tooltip.facts.some((fact) => fact.detail.includes('1.4 coefficient') && fact.detail.includes('per trigger')),
      !removed.includes('strike')
    );
  }
});

test('Calcify owns its passive Protection without requiring a cast, and removal does not consume its interval', () => {
  for (const removed of [false, true]) {
    const state = evokerState.create();
    state.element = 'Earth';
    const { context, events, tooltip } = fixture(
      ID.CALCIFY,
      {
        fields: { internalCooldown: 2 },
        sideEffects: {
          protection: removed
            ? { removeEffects: [{ type: 'boon', name: 'Protection' }] }
            : { effects: [{ type: 'boon', name: 'Protection', duration: 7 }] }
        }
      },
      'Evoker',
      state
    );
    for (const at of [1, 3, 3.001]) applyCalcifyProtection(context, { type: 'control', at, actorType: 'player' });
    assert.equal(events.length, removed ? 0 : 2);
    assert.equal(context.procs.deadline('elementalist.evoker.calcifyPassive'), removed ? 0 : 3.001 + 2);
    assert.ok(events.every((event) => event.duration === 7 && event.audience.recipients === 'self'));
    state.element = 'Air';
    applyCalcifyProtection(context, { type: 'control', at: 10, actorType: 'player' });
    assert.equal(events.length, removed ? 0 : 2);
    assert.equal(
      tooltip.facts.some(
        (fact) =>
          fact.name === 'Protection' && fact.detail.includes('7s') && fact.detail.includes('on disabling an enemy')
      ),
      !removed
    );
  }
});

test('Evocation patches its Fire-familiar Might interval independently of its entry cooldown', () => {
  const profession = withPatchPreview(elementalistProfession, {
    id: 'evocation-interval',
    label: 'Evocation interval',
    professions: { elementalist: { balanceProfiles: { [TRAIT.EVOCATION]: { fields: { pulseInterval: 2 } } } } }
  });
  const result = runElementalist(
    [{ type: 'wait', durationMs: 5000 }],
    {
      specialization: 'Evoker',
      patchId: 'evocation-interval',
      evokerElement: 'Fire',
      selectedTraitIds: []
    },
    {
      profession,
      timeline: [1, 3, 3.001].map((at) => ({
        at,
        run(runtime) {
          runtime.mechanics.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at,
              actorType: 'player',
              source: 'Fixture',
              sourceId: 42,
              skillId: 42,
              skillName: 'Fixture',
              condition: 'Burning',
              stacks: 1,
              duration: 1
            }
          });
        }
      }))
    }
  );
  assert.deepEqual(result.warnings, []);
  const grants = result.resolvedEvents.filter((event) => event.type === 'buff' && event.skillName === 'Fire Familiar');
  assert.deepEqual(
    grants.map((event) => event.at),
    [1, 3.001]
  );
  const context = profession.resolvePatch({ id: 'evocation-interval' }).balanceContext;
  const model = describeSimulationTrait(
    context,
    context.catalog.traits.find((trait) => trait.id === TRAIT.EVOCATION),
    elementalistTooltips
  );
  assert.equal(model.facts.find((fact) => fact.name.startsWith('Attunement-entry trait cooldown')).detail, '5s');
  assert.equal(model.facts.find((fact) => fact.name === 'Fire-familiar might cooldown').detail, '2s');
});
