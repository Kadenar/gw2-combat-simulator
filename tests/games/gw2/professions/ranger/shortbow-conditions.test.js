import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { triggerBloodThirst } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

// Base positional bonuses and trait extensions are separate contracts; neither creates extra bleed stacks.
test('shortbow conditions distinguish frontal and defiant targets with and without Light on Your Feet', () => {
  for (const defiant of [false, true]) {
    for (const trait of [false, true]) {
      const result = runRanger(
        [ID.CROSSFIRE, ID.POISON_VOLLEY, ID.CRIPPLING_SHOT, ID.CONCUSSION_SHOT, { type: 'wait', durationMs: 1000 }],
        {
          primaryWeapon: 'Shortbow',
          selectedTraitIds: trait ? [TRAIT.LIGHT_ON_YOUR_FEET] : [],
          stats: { expertise: 0 },
          target: { armor: 2597, defiant, conditions: {} }
        }
      );
      assert.deepEqual(result.warnings, []);
      const conditions = (id, condition) =>
        result.resolvedEvents.filter((e) => e.type === 'condition' && e.sourceId === id && e.condition === condition);
      const bleeding = conditions(ID.CROSSFIRE, 'Bleeding');
      assert.equal(
        bleeding.reduce((sum, e) => sum + e.stacks, 0),
        1
      );
      assert.equal(bleeding[0].effectiveDuration, defiant ? (trait ? 5 : 3) : 2);
      assert.ok(
        conditions(ID.POISON_VOLLEY, 'Poisoned').every((e) => e.effectiveDuration === (defiant ? (trait ? 9 : 7) : 5))
      );
      const immobilized = conditions(ID.CRIPPLING_SHOT, 'Immobilized');
      assert.equal(immobilized.length, defiant ? 1 : 0);
      if (defiant) assert.equal(immobilized[0].effectiveDuration, trait ? 2.5 : 1.5);
      assert.equal(conditions(ID.CRIPPLING_SHOT, 'Crippled')[0].effectiveDuration, 4);
      assert.equal(
        result.events.find((e) => e.type === 'control' && e.sourceId === ID.CONCUSSION_SHOT).controlKind,
        defiant ? 'stun' : 'daze'
      );
    }
  }
});

// Charge ownership follows Beastmode, while the resulting condition always belongs to the Ranger.
test('Blood Thirst spends only eligible pet or merged-player charges and expires before a hit at its boundary', () => {
  for (const merged of [false, true]) {
    const core = createRangerCoreState({});
    core.bloodThirst = { charges: 3, expiresAt: 12 };
    const emitted = [];
    const context = {
      config: {},
      profession: { core, specialization: { kind: 'Soulbeast', state: { beastmodeActive: merged } } },
      helpers: rangerCatalog,
      effects: { emit: ({ event }) => emitted.push(event) }
    };
    const player = {
      at: 1,
      source: 'ranger',
      actorType: 'player',
      sourceId: ID.CROSSFIRE,
      skillName: 'Crossfire',
      coefficient: 0.5
    };
    const pet = { ...player, source: 'ranger-pet', actorType: 'summon', skillName: 'Pet strike' };
    const eligible = merged ? player : pet;
    triggerBloodThirst(context, merged ? pet : player);
    triggerBloodThirst(context, { ...eligible, coefficient: 0 });
    assert.equal(core.bloodThirst.charges, 3);
    assert.deepEqual(emitted, []);
    for (let i = 0; i < 4; i++) triggerBloodThirst(context, eligible);
    assert.equal(core.bloodThirst.charges, 0);
    assert.equal(emitted.length, 3);
    for (const event of emitted) {
      assert.equal(event.duration, 15);
      assert.equal(event.stacks, 1);
      assert.equal(event.ownerActorType, 'player');
      assert.equal(event.actorType, 'effect');
      assert.equal(event.source, 'ranger');
      assert.equal(event.summonOwner, undefined);
    }
    core.bloodThirst.charges = 1;
    triggerBloodThirst(context, { ...eligible, at: 12 });
    assert.equal(core.bloodThirst.charges, 0);
    assert.equal(emitted.length, 3);
  }
});

// A pet-triggered bleed uses player Expertise and never adds a direct bleed to Crippling Shot itself.
test('Crippling Shot grants pet bleeding with player condition duration', () => {
  const result = runRanger(['__combat_start', ID.CRIPPLING_SHOT, { type: 'wait', durationMs: 5000 }], {
    primaryWeapon: 'Shortbow',
    selectedPet: 'Tiger',
    stats: { expertise: 1500 },
    target: { armor: 2597, defiant: true, conditions: {} }
  });
  assert.deepEqual(result.warnings, []);
  const bleeds = result.resolvedEvents.filter(
    (e) => e.type === 'condition' && e.sourceId === ID.CRIPPLING_SHOT && e.condition === 'Bleeding'
  );
  assert.ok(bleeds.length > 0);
  assert.ok(bleeds.every((e) => e.skillName === 'Blood Thirst' && e.effectiveDuration === 30));
});
