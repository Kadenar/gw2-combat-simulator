import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import {
  applyCatalystResolvedDamage,
  applyShatteringIce
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { applyCalcifyProtection } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

// The creating skill refreshes existing orbs as well as its own elements.
test('Core and Weaver orb skills own refresh duration and expiry', () => {
  for (const [id, specialization, elements] of [
    [ID.FLAME_WHEEL, 'Core', ['Fire']],
    [ID.DUAL_ORBITS_FIRE_AND_WATER, 'Weaver', ['Fire', 'Water']]
  ]) {
    const catalog = applySkillPatch(elementalistCatalog, { skills: { [id]: { fields: { orbDuration: 2.5 } } } });
    const config = { specialization, primaryWeapon: 'Hammer', startAttunement: 'Fire', secondaryAttunement: 'Water' };
    const accepted = runElementalist([{ type: 'cast', skillId: id }], config, { catalog: () => catalog });
    assert.deepEqual(accepted.warnings, []);
    const effectiveEnd = accepted.steps.find((step) => step.skillId === id).end / 1000;
    const expiresAt = canonicalTime(effectiveEnd + 2.5);
    const result = runElementalist(
      [
        { type: 'cast', skillId: id },
        { type: 'wait', durationMs: 3000 }
      ],
      config,
      {
        catalog: () => catalog,
        initialize(runtime) {
          runtime.profession.core.hammerOrbs.Air = 10;
        },
        probes: [
          [
            canonicalTime(effectiveEnd + 0.5),
            (runtime) => {
              for (const element of ['Air', ...elements])
                assert.equal(runtime.profession.core.hammerOrbs[element], gw2Time(expiresAt));
            }
          ],
          [
            canonicalTime(expiresAt + 0.1),
            (runtime) => {
              for (const element of ['Air', ...elements])
                assert.equal(runtime.profession.core.hammerOrbs[element], null);
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
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

    profession: { specialization: { kind: specialization, state } },
    effects: capture.effects,
    config: {}
  };
  context.procs = createProcRegistry(() => context);
  return {
    context,
    events: capture.events
  };
}

test('Shattering Ice action rewards share the selected interval and independent removal without changing rearm', () => {
  for (const removed of [[], ['strike'], ['condition'], ['strike', 'condition']]) {
    const { context, events } = fixture(
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
    for (const at of [1, 3, 3.04]) hit(at);
    assert.equal(context.procs.deadline('elementalist.catalyst.shatteringIce'), 3.04 + 2);
    assert.equal(events.filter((event) => event.type === 'damage').length, removed.includes('strike') ? 0 : 2);
    assert.equal(events.filter((event) => event.type === 'condition').length, removed.includes('condition') ? 0 : 2);
    for (const event of events) {
      assert.equal(event.sourceId, 42);
      assert.equal(event.triggeredBy, 'Trigger');
    }

    arm(4);
    hit(4);
    assert.equal(context.procs.deadline('elementalist.catalyst.shatteringIce'), 6);
  }
});

test('Calcify owns its passive Protection without requiring a cast, and removal does not consume its interval', () => {
  for (const removed of [false, true]) {
    const state = evokerState.create();
    state.element = 'Earth';
    const { context, events } = fixture(
      ID.CALCIFY,
      {
        fields: { internalCooldown: 2 },
        sideEffects: {
          protection: removed
            ? { removeEffects: [{ type: 'boon', name: 'protection' }] }
            : { effects: [{ type: 'boon', name: 'protection', duration: 7 }] }
        }
      },
      'Evoker',
      state
    );
    for (const at of [1, 3, 3.04]) applyCalcifyProtection(context, { type: 'control', at, actorType: 'player' });
    assert.equal(events.length, removed ? 0 : 2);
    assert.equal(context.procs.deadline('elementalist.evoker.calcifyPassive'), removed ? 0 : 3.04 + 2);
    assert.ok(events.every((event) => event.duration === 7 && event.audience.recipients === 'self'));
    state.element = 'Air';
    applyCalcifyProtection(context, { type: 'control', at: 10, actorType: 'player' });
    assert.equal(events.length, removed ? 0 : 2);
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
      timeline: [1, 3, 3.04].map((at) => ({
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
    [1, 3.04]
  );
});
