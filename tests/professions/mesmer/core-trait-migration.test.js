import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

// Catalog identity must let player ambush hits reach traits without counting clone ambushes as player hits.
test("Mirage Thrust retains player and clone skill identity and grants one Fencer's Finesse stack", () => {
  const result = simulateMesmer(['Dodge / Mirage Cloak', 'Mirage Thrust'], {
    specialization: 'Mirage',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    initialResource: 1,
    selectedTraitIds: [TRAIT.FENCERS_FINESSE, TRAIT.INFINITE_HORIZON]
  });
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Mirage Thrust');
  assert.deepEqual(new Set(hits.map((event) => event.actorType)), new Set(['player', 'summon']));
  assert.ok(hits.every((event) => event.skillId === ID.MIRAGE_THRUST && event.sourceId === ID.MIRAGE_THRUST));
  const stacks = result.events.filter((event) => event.kind === 'fencer');
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].stacks, 1);
  assert.ok(stacks[0].at > hits.find((event) => event.actorType === 'player').at);
});

// The Pledge follows each eligible player application, preserving delay and excluding phantasm and derived Burning.
test('The Pledge adds one trait-owned Burning packet to each supported torch skill', () => {
  for (const name of ['Phantasmal Mage', 'The Prestige']) {
    for (const selectedTraitIds of [[], [TRAIT.THE_PLEDGE]]) {
      const result = simulateMesmer([name, { name: '__wait', waitMs: 3500 }], {
        specialization: 'Core',
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Torch',
        initialResource: 0,
        selectedTraitIds
      });
      const bonus = result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.THE_PLEDGE);
      assert.equal(bonus.length, selectedTraitIds.length, name);
      if (!bonus.length) continue;
      const base = result.events.find(
        (event) =>
          event.type === 'condition' &&
          event.skillName === name &&
          event.actorType === 'player' &&
          event.sourceId === event.skillId
      );
      assert.equal(bonus[0].at, base.at);
      assert.equal(bonus[0].activationId, base.activationId);
      assert.equal(bonus[0].actorType, 'player');
      assert.equal(bonus[0].condition, 'Burning');
      assert.equal(bonus[0].stacks, 2);
      assert.equal(bonus[0].duration, 3);
    }
  }
});

test('The Pledge emits no Burning for a torch skill interrupted before its packet commits', () => {
  for (const name of ['Phantasmal Mage', 'The Prestige']) {
    const result = simulateMesmer(
      [
        { name, interruptMs: 10 },
        { name: '__wait', waitMs: 3500 }
      ],
      {
        specialization: 'Core',
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Torch',
        initialResource: 0,
        selectedTraitIds: [TRAIT.THE_PLEDGE]
      }
    );
    assert.equal(
      result.events.some((event) => event.type === 'condition' && event.sourceId === TRAIT.THE_PLEDGE),
      false,
      name
    );
  }
});

// A completed Mirror Blade keeps both delayed trait packets; interrupted casts and unselected traits cannot add them.
test('Bountiful Blades owns two additional Mirror Blade packets and respects interruption', () => {
  for (const [selectedTraitIds, interruptMs, expected] of [
    [[], undefined, 0],
    [[TRAIT.BOUNTIFUL_BLADES], undefined, 2],
    [[TRAIT.BOUNTIFUL_BLADES], 300, 0]
  ]) {
    const result = simulateMesmer(
      [
        { name: 'Mirror Blade', interruptMs },
        { name: '__wait', waitMs: 1200 }
      ],
      {
        specialization: 'Core',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: '',
        initialResource: 0,
        selectedTraitIds
      }
    );
    const bounce = result.events.filter(
      (event) => event.type === 'damage' && event.sourceId === TRAIT.BOUNTIFUL_BLADES
    );
    assert.equal(bounce.length, expected);
    if (!bounce.length) continue;
    assert.ok(bounce.every((event) => event.skillId === ID.MIRROR_BLADE));
    assert.deepEqual(
      bounce.map((event) => event.at),
      [1.25, 1.416]
    );
    assert.deepEqual(
      bounce.map((event) => event.coefficient),
      [0.0000064, 0.000000256]
    );
  }
});

test('Dazzling observes control before later control-trait work', () => {
  const result = simulateMesmer(
    ['Magic Bullet'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0,
      selectedTraitIds: [TRAIT.DAZZLING]
    })
  );
  const control = result.events.find((event) => event.type === 'control' && event.skillName === 'Magic Bullet');
  const dazzling = result.events.find(
    (event) => event.type === 'weakness_vulnerability' && event.skillName === 'Magic Bullet'
  );

  assert.ok(control);
  assert.ok(dazzling);
  assert.ok(control.eventOrder < dazzling.eventOrder);
});

test('Cry of Pain overrides Confusion before Blinding Dissipation', () => {
  const result = simulateMesmer(
    ['Cry of Frustration'],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 1,
      selectedTraitIds: [TRAIT.CRY_OF_PAIN, TRAIT.BLINDING_DISSIPATION]
    })
  );
  const confusion = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Cry of Frustration' && event.condition === 'Confusion'
  );
  const blind = result.events.find((event) => event.type === 'blind' && event.skillName === 'Cry of Frustration');

  assert.ok(confusion);
  assert.ok(blind);
  assert.equal(confusion.stacks, 4);
  assert.equal(confusion.duration, 4);
  assert.ok(confusion.eventOrder < blind.eventOrder);
});

test('Maim the Disillusioned resolves before Illusionary Membrane', () => {
  const result = simulateMesmer(
    ['Cry of Frustration'],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 1,
      selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED, TRAIT.ILLUSIONARY_MEMBRANE]
    })
  );
  const maim = result.events.find((event) => event.type === 'proc' && event.name === 'Maim the Disillusioned');
  const membrane = result.events.find((event) => event.type === 'proc' && event.name === 'Illusionary Membrane');

  assert.ok(maim);
  assert.ok(membrane);
  assert.ok(maim.eventOrder < membrane.eventOrder);
});

test('canonical phantasm ownership triggers Sharper Images without Master Fencer', () => {
  const procs = [];
  const context = {
    state: {
      profession: {
        core: createMesmerCoreState(),
        specialization: { kind: 'Core', state: {} }
      }
    },
    traits: new Set([TRAIT.MASTER_FENCER, TRAIT.SHARPER_IMAGES]),
    stochastic: true,
    emitEvent: () => null,
    boonDuration: (_boon, duration) => duration,
    addTraitProc: (name) => {
      procs.push(name);
      return null;
    },
    balanceProfile: () => undefined
  };

  // Canonical summon ownership prevents an illusion hit from also counting as a player hit.
  triggerMesmerCriticalTraits(
    context,
    {
      type: 'damage',
      at: 1,
      source: 'Phantasm',
      actorType: 'summon',
      summonKind: 'phantasm',
      name: 'Phantasm strike',
      skillName: 'Phantasm strike',
      coefficient: 1,
      didCrit: true
    },
    1
  );

  assert.deepEqual(procs, ['Sharper Images']);
});
