import { mesmerCatalog } from '#gw2/professions/mesmer/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

test('Master Fencer only claims its strict ICD on a sampled critical hit', () => {
  // Both sampled misses and hits during the ICD leave its deadline intact.
  for (const duration of [8, 0]) {
    const core = createMesmerCoreState();
    core.traitReadyAt[TRAIT.MASTER_FENCER] = 2;
    const events = [];
    const context = {
      state: { profession: { core, specialization: { kind: 'Core', state: {} } } },
      traits: new Set(),
      stochastic: false,
      balanceProfile: (id) => ({ ...mesmerCatalog.balanceProfilesById.get(id), internalCooldown: duration }),
      boonDuration: (_boon, duration) => duration,
      addTraitProc(_name, at) {
        assert.equal(core.traitReadyAt[TRAIT.MASTER_FENCER], at + duration);
      },
      emitEvent(_cause, event) {
        events.push(event);
      }
    };
    const opportunity = (at, didCrit = true) =>
      triggerMesmerCriticalTraits(context, { type: 'damage', actorType: 'player', coefficient: 1, at, didCrit }, 0.5);
    opportunity(1);
    context.traits.add(TRAIT.MASTER_FENCER);
    opportunity(1);
    assert.equal(events.length, 0);
    opportunity(2);
    assert.equal(core.traitReadyAt[TRAIT.MASTER_FENCER], 2);
    opportunity(2.000001, false);
    assert.equal(events.length, 0);
    opportunity(2.000001);
    assert.equal(events.length, 2);
    assert.equal(core.traitReadyAt[TRAIT.MASTER_FENCER], 2.000001 + duration);
    opportunity(2.000001 + duration);
    assert.equal(events.length, 2);
    opportunity(2.000002 + duration);
    assert.equal(events.length, 4);
  }
});

// Catalog identity must let player ambush hits reach traits without counting clone ambushes as player hits.
test("Mirage Thrust retains player and clone skill identity and grants one Fencer's Finesse stack", () => {
  const result = simulateMesmer(['Dodge / Mirage Cloak', 'Mirage Thrust', { type: 'wait', durationMs: 1 }], {
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
  const playerHit = hits.find((event) => event.actorType === 'player');
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].stacks, 1);
  assert.equal(stacks[0].at, playerHit.at);
  assert.ok(stacks[0].priority > Number(playerHit.priority || 0));
});

// The Pledge follows each eligible player application, preserving delay and excluding phantasm and derived Burning.
test('The Pledge adds separate trait-owned Burning stacks to each supported torch skill', () => {
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
      assert.equal(bonus.length, 2 * selectedTraitIds.length, name);
      if (!bonus.length) continue;
      const base = result.events.find(
        (event) =>
          event.type === 'condition' &&
          event.skillName === name &&
          event.actorType === 'player' &&
          event.sourceId === event.skillId
      );
      // Every stack retains the player burn's attribution and impact without recursively retriggering the trait.
      for (const packet of bonus) {
        assert.equal(packet.at, base.at);
        assert.equal(packet.activationId, base.activationId);
        assert.equal(packet.actorType, 'player');
        assert.equal(packet.condition, 'Burning');
        assert.equal(packet.stacks, 1);
        assert.equal(packet.duration, 3);
      }
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
      [1.24, 1.4]
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
    (event) => event.type === 'condition' && event.condition === 'Vulnerability' && event.sourceId === TRAIT.DAZZLING
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
    ['Cry of Frustration', { type: 'wait', durationMs: 1 }],
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
    balanceProfile: (id) => mesmerCatalog.balanceProfilesById.get(id)
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
