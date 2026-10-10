import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS as ATTUNEMENT,
  ELEMENTALIST_TRAIT_IDS as E
} from '#gw2/professions/elementalist/data/ids.js';
import { ENGINEER_TRAIT_IDS as G, ENGINEER_SKILL_IDS as GS } from '#gw2/professions/engineer/data/ids.js';
import { NECROMANCER_TRAIT_IDS as N } from '#gw2/professions/necromancer/data/ids.js';
import { RANGER_TRAIT_IDS as R } from '#gw2/professions/ranger/data/ids.js';
import { THIEF_TRAIT_IDS as T, THIEF_SKILL_IDS as TS } from '#gw2/professions/thief/data/ids.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

const combat = { type: 'combat-start' };
const wait = { type: 'wait', durationMs: 2000 };
const strike = {
  type: 'damage',
  at: 1,
  source: 'fixture',
  sourceId: 'fixture',
  skillId: 'fixture',
  skillName: 'Trigger',
  actorType: 'player',
  coefficient: 1,
  skillWeapon: 'Unequipped'
};

/** Use native admission and the actual emitter so profile edits cannot pass through a packet-only test double. */
function simulate(family, trait, patch, { rotation = [combat, wait], event, config = {} } = {}) {
  const result = createProfessionSimulator(family)(
    rotation,
    {
      specialization: 'Core',
      selectedTraitIds: [trait],
      boons: {},
      attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, ferocity: 0, vitality: 1000 }),
      target: { armor: 2597, health: 0, conditions: {} },
      ...config
    },
    {
      catalog: (catalog) => {
        // Removal uses patch selectors; complete authored overrides also exercise fields outside numeric patch grammar.
        const selected = applyBalanceProfilePatch(catalog, {
          balanceProfiles: { [trait]: { removeEffects: patch.removeEffects ?? [] } }
        });
        const profile = selected.balanceProfilesById.get(trait);
        return withProfile(selected, trait, {
          effects: profile.effects.map((effect) => ({
            ...effect,
            ...patch.effects?.find((edit) => edit.type === effect.type && edit.name === effect.name)
          }))
        });
      },
      timeline: event ? [{ at: event.at, run: (runtime) => runtime.effects.emit({ kind: 'packet', event }) }] : []
    }
  );
  assert.deepEqual(result.warnings, []);
  return result;
}

for (const [name, family, trait, effect, event, config] of [
  [
    'Steel-Packed Powder',
    engineerProfession,
    G.STEEL_PACKED_POWDER,
    'Vulnerability',
    { ...strike, explosion: true },
    {}
  ],
  [
    'Demonic Lore',
    necromancerProfession,
    N.DEMONIC_LORE,
    'Burning',
    { ...strike, type: 'condition', coefficient: undefined, condition: 'Torment', stacks: 1, duration: 2 },
    { specialization: 'Scourge' }
  ],
  ['Opening Strike', rangerProfession, R.OPENING_STRIKE, 'Vulnerability', strike, { selectedPet: 'Pig' }]
])
  test(`${name} preserves ownership while materializing authored condition fields and removal`, () => {
    for (const removed of [false, true]) {
      const selector = { type: 'condition', name: effect };
      const result = simulate(
        family,
        trait,
        removed
          ? { removeEffects: [selector] }
          : {
              effects: [{ ...selector, stacks: 4, duration: 7, projectile: true, metadata: { procCount: 2 } }]
            },
        { event, config }
      );
      const packets = result.resolvedEvents.filter(
        (packet) => packet.sourceId === trait && packet.type === 'condition'
      );
      assert.equal(packets.length > 0, !removed);
      if (!removed) {
        assert.equal(
          packets.reduce((total, packet) => total + packet.stacks, 0),
          4
        );
        assert.equal(packets[0].duration, 7);
        assert.equal(packets[0].projectile, true);
        assert.equal(packets[0].metadata.procCount, 2);
        assert.equal(packets[0].actorType, 'effect');
        assert.equal(packets[0].triggeredBy, 'Trigger');
      }
    }
  });

for (const [name, trait, attunement] of [
  ['Earthen Blast', E.EARTHEN_BLAST, ATTUNEMENT.Earth],
  ['Sunspot', E.SUNSPOT, ATTUNEMENT.Fire]
])
  test(`${name} uses authored strike rules and retains independent activation and trigger identity`, () => {
    const result = simulate(
      elementalistProfession,
      trait,
      {
        effects: [
          { type: 'strike', name, coefficient: 0.75, canCrit: true, weaponStrength: 1234, metadata: { procCount: 2 } }
        ]
      },
      {
        rotation: [combat, attunement, wait],
        config: { startAttunement: 'Water' }
      }
    );
    const packet = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === name);
    assert.equal(packet.coefficient, 0.75);
    assert.equal(packet.canCrit, true);
    assert.equal(packet.weaponStrength, 1234);
    assert.equal(packet.metadata.procCount, 2);
    assert.equal(packet.sourceId, attunement);
    assert.equal(packet.ownerActorType, 'player');
    assert.match(packet.activationId, /^elementalist\.effect:/);
    assert.ok(result.procSteps.some((step) => step.skill === name));
  });

test('Grand Entrance windows are independently removable and keep their triggering skill annotation', () => {
  for (const removed of [false, true]) {
    const result = simulate(
      engineerProfession,
      G.GRAND_ENTRANCE,
      {
        removeEffects: [
          { type: 'boon', name: 'Resistance' },
          ...(removed ? [{ type: 'buff', name: 'Grand Entrance' }] : [])
        ],
        ...(removed ? {} : { effects: [{ type: 'buff', name: 'Grand Entrance', duration: 7 }] })
      },
      {
        event: {
          ...strike,
          actorType: 'effect',
          skillId: GS.EXPLOSIVE_ENTRANCE_TRAIT_SKILL,
          skillName: 'Explosive Entrance'
        }
      }
    );
    const buffs = result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === G.GRAND_ENTRANCE);
    assert.equal(buffs.length, removed ? 0 : 1);
    if (!removed) {
      assert.equal(buffs[0].kind, 'grand-entrance');
      assert.equal(buffs[0].duration, 7);
      assert.equal(buffs[0].triggeredBy, 'Explosive Entrance');
    }

    assert.equal(
      result.procSteps.some((step) => step.skill === 'Grand Entrance'),
      !removed
    );
  }
});

test('Mug follows the strike profile while preserving the accepted steal activation', () => {
  for (const removed of [false, true]) {
    const effect = { type: 'strike', name: 'Mug' };
    const result = simulate(
      thiefProfession,
      T.MUG,
      removed
        ? { removeEffects: [effect] }
        : { effects: [{ ...effect, coefficient: 0.8, canCrit: true, weaponStrength: 1234 }] },
      {
        rotation: [combat, TS.STEAL, wait],
        config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger' }
      }
    );
    const packets = result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === T.MUG);
    assert.equal(packets.length, removed ? 0 : 1);
    if (!removed) {
      assert.equal(packets[0].skillId, TS.STEAL);
      assert.equal(packets[0].actorType, 'player');
      assert.equal(packets[0].canCrit, true);
      assert.equal(packets[0].coefficient, 0.8);
      assert.equal(packets[0].weaponStrength, 1234);
      assert.ok(packets[0].activationId);
    }

    assert.ok(observedRuntime(result).cooldownController.readyAt(TS.STEAL) > 0);
  }
});

test('Larcenous Torment gives each siphon an independent activation while retaining its cause', () => {
  // Independent damage activations must not steal the triggering condition's activation identity.
  const result = simulate(
    thiefProfession,
    T.LARCENOUS_TORMENT,
    {},
    {
      config: { specialization: 'Specter', primaryWeapon: 'Scepter', secondaryWeapon: 'Dagger' },
      event: {
        ...strike,
        type: 'condition',
        coefficient: undefined,
        condition: 'Torment',
        stacks: 2,
        duration: 2,
        activationId: 'test:torment'
      }
    }
  );
  const applications = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'fixture'
  );
  const siphons = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === T.LARCENOUS_TORMENT
  );
  assert.equal(siphons.length, 2);
  assert.equal(new Set(siphons.map((event) => event.activationId)).size, 2);
  for (const siphon of siphons) {
    assert.match(siphon.activationId, /^effect:derived:/);
    assert.ok(applications.some((application) => application.eventOrder === siphon.parentEventOrder));
    assert.equal(siphon.actorType, 'effect');
    assert.equal(siphon.ownerActorType, 'player');
    assert.equal(siphon.triggeredBy, 'Trigger');
  }
});
