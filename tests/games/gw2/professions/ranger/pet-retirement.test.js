import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { rangerPetCompanionId, rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const config = { selectedPet: 'Tiger', selectedPet2: 'Pig' };

for (const output of ['detailed', 'score']) {
  test(`swap retires only the outgoing boon recipient and never restores its old grants (${output})`, () => {
    let oldPet;
    let replacement;
    // Real shared grants protect player/other-companion ownership as well as both boon stacking modes.
    const result = runRanger([wait(1000), ID.PET_SWAP, wait(21000), ID.PET_SWAP, wait(1000)], config, {
      output,
      initialize(runtime) {
        oldPet = rangerPetCompanionId(runtime);
        for (const kind of ['fury', 'might', 'superspeed']) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              at: 0,
              source: 'Fixture',
              sourceId: kind,
              actorType: 'player',
              kind,
              duration: 60,
              stacks: 1,
              audience: { recipients: 'party', eligibleCompanionIds: [oldPet, 'other-companion'] }
            }
          });
        }

        // A delayed explicitly targeted grant must not revive the retired entity.
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'buff',
            at: 1.25,
            source: 'Fixture',
            sourceId: 'late-grant',
            actorType: 'player',
            kind: 'might',
            duration: 60,
            stacks: 1,
            audience: { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: [oldPet] }
          }
        });
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'boon_extension',
            at: 1.3,
            source: 'Fixture',
            sourceId: 'extension',
            actorType: 'player',
            kind: 'fury',
            duration: 5,
            extensionAudience: 'all'
          }
        });
      },
      probes: [
        [
          0.5,
          (runtime) => {
            assert.equal(
              runtime.combat.activeBoonStacks('fury', runtime.time, 1, { actor: 'companion', companionId: oldPet }),
              1
            );
          }
        ],
        [
          1.01,
          (runtime) => {
            replacement = rangerPetCompanionId(runtime);
            assert.notEqual(replacement, oldPet);
            for (const companionId of [oldPet, replacement]) {
              const recipient = { actor: 'companion', companionId };
              assert.equal(runtime.combat.activeBoonStacks('fury', runtime.time, 1, recipient), 0);
              assert.equal(runtime.combat.activeBoonStacks('might', runtime.time, 25, recipient), 0);
              assert.equal(runtime.combat.activeBuffStacks('superspeed', runtime.time, 1, recipient), 0);
              assert.deepEqual(runtime.combat.boonSnapshot('fury', runtime.time, recipient), {
                stacks: 0,
                duration: 0
              });
            }

            for (const recipient of [{ actor: 'player' }, { actor: 'companion', companionId: 'other-companion' }])
              assert.equal(runtime.combat.activeBoonStacks('fury', runtime.time, 1, recipient), 1);
            const observation = observeRuntimeEffects(runtime, {}).find(
              (state) => state.kind === 'fury' && state.recipient === `companion:${oldPet}`
            );
            assert.equal(effectStateValue(observation, runtime.time).count, 0);
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'buff',
                at: runtime.time,
                source: 'Fixture',
                sourceId: 'new-grant',
                actorType: 'player',
                kind: 'might',
                duration: 60,
                stacks: 1,
                audience: { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: [replacement] }
              }
            });
          }
        ],
        [
          1.5,
          (runtime) => {
            assert.equal(
              runtime.combat.activeBoonStacks('fury', runtime.time, 1, { actor: 'companion', companionId: oldPet }),
              0
            );
            assert.equal(
              runtime.combat.activeBoonStacks('might', runtime.time, 25, { actor: 'companion', companionId: oldPet }),
              0
            );
            assert.equal(
              runtime.combat.activeBoonStacks('might', runtime.time, 25, {
                actor: 'companion',
                companionId: replacement
              }),
              1
            );
            const late = runtime.facts.ofType('buff').find((event) => event.sourceId === 'late-grant');
            assert.equal(late.resolvedAudience.recipientCount, 0);
          }
        ],
        [
          22.5,
          (runtime) => {
            const returned = rangerPetCompanionId(runtime);
            assert.notEqual(returned, oldPet);
            for (const companionId of [oldPet, replacement, returned])
              assert.equal(
                runtime.combat.activeBoonStacks('might', runtime.time, 25, { actor: 'companion', companionId }),
                0
              );
          }
        ]
      ]
    });
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    const timeline = createGw2TimelineIndex({ events: runtime.facts.read(), resolved: true });
    assert.equal(timeline.buffStacksAt('fury', 0.5, 0, 1, 'summon', oldPet), 1);
    assert.equal(timeline.buffStacksAt('fury', 1, 0, 1, 'summon', oldPet), 0);
    assert.equal(timeline.buffStacksAt('fury', 1, 0, 1, 'all'), 1);
  });
}

test('Poisonous Cloud keeps ranger-owned strikes and poison after its caster is retired', () => {
  const result = runRanger([ID.POISONOUS_CLOUD, wait(1500), ID.PET_SWAP, wait(5000)], {
    specialization: 'Untamed',
    selectedPet: 'Carrion Devourer',
    selectedPet2: 'Pig',
    initialUntamedState: 'Ranger',
    selectedTraitIds: [TRAIT.SHARPENED_EDGES],
    stats: { power: 2000, precision: 4000, conditionDamage: 1000 }
  });
  assert.deepEqual(result.warnings, []);
  const swappedAt = result.events.find((event) => event.type === 'ranger.pet-swapped').at;
  for (const type of ['damage', 'condition']) {
    const cloud = result.resolvedEvents.filter((event) => event.type === type && event.skillId === ID.POISONOUS_CLOUD);
    assert.ok(cloud.some((event) => event.at < swappedAt));
    assert.ok(cloud.some((event) => event.at > swappedAt));
    assert.ok(cloud.every((event) => event.actorType === 'player'));
  }

  // Surviving player-stat pulses cannot give the removed pet (or its replacement) new trait-owned damage.
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.sourceId === TRAIT.SHARPENED_EDGES &&
        event.triggeredBy === 'Poisonous Cloud' &&
        event.at >= swappedAt
    ),
    false
  );
});

test('an established pet field remains usable after its damaging pulses stop', () => {
  const result = runRanger([ID.UNDEAD_PLAGUE_PET, wait(1500), ID.PET_SWAP, ID.WARCLAWS_ENGAGE, wait(2000)], {
    specialization: 'Untamed',
    selectedPet: 'Wallow',
    selectedPet2: 'Pig',
    initialUntamedState: 'Ranger',
    primaryWeapon: 'Spear'
  });
  assert.deepEqual(result.warnings, []);
  const swappedAt = result.events.find((event) => event.type === 'ranger.pet-swapped').at;
  const field = result.events.find((event) => event.type === 'combo_field' && event.skillId === ID.UNDEAD_PLAGUE_PET);
  assert.ok(field.at < swappedAt && field.expiresAt > swappedAt);
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        ['damage', 'condition'].includes(event.type) && event.skillId === ID.UNDEAD_PLAGUE_PET && event.at >= swappedAt
    ),
    false
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === 'combo' && event.fieldType === 'Poison' && event.finisherType === 'Leap' && event.at > swappedAt
    )
  );
  assert.equal(observedRuntime(result).combo.fields.get(field.fieldId).expiresAt, field.expiresAt);
});

test('swap cancellation follows causal order for same-time packets and pending field creation', () => {
  const result = runRanger([wait(2500)], config, {
    timeline: [
      {
        at: 1,
        priority: -100,
        run(runtime) {
          swapRangerPets(runtime.mechanics, runtime.helpers.skillsById.get(ID.PET_SWAP));
        }
      }
    ],
    initialize(runtime) {
      const pet = rangerPetCombatMetadata(runtime);
      runtime.effects.emit({
        kind: 'packet',
        priority: -200,
        event: {
          type: 'damage',
          at: 1,
          source: 'ranger-pet',
          sourceId: 'before-retirement',
          actorType: 'summon',
          coefficient: 1,
          ...pet
        }
      });
      // These packets are already queued, but swap retirement executes before ordinary impacts at this boundary.
      for (const at of [1, 2])
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            at,
            source: 'ranger-pet',
            sourceId: 'retired-hit',
            actorType: 'summon',
            coefficient: 1,
            ...pet
          }
        });
      runtime.effects.emit({
        kind: 'packet',
        event: {
          type: 'combo_field',
          at: 2,
          source: 'ranger-pet',
          sourceId: 'uncreated-field',
          actorType: 'summon',
          fieldId: 'uncreated-field',
          fieldType: 'Smoke',
          ownerId: 'ranger',
          ownerActorType: 'summon',
          expiresAt: 8,
          ...pet
        }
      });
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.ok(result.resolvedEvents.some((event) => event.sourceId === 'before-retirement' && event.damage > 0));
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === 'retired-hit'),
    false
  );
  assert.equal(observedRuntime(result).combo.fields.has('uncreated-field'), false);
});
