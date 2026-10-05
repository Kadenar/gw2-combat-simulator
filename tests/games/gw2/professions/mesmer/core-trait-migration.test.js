import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { createProcRegistry } from '#gw2/platform/combat/procs.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/dueling.js';
import { triggerMesmerControlTraits } from '#gw2/professions/mesmer/core/traits/dispatch.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Critical trait handlers read selected traits and patched profiles from the same live runtime as the proc registry.
test('Master Fencer only claims its strict ICD on a sampled critical hit', () => {
  // Both sampled misses and hits during the ICD leave its deadline intact.
  for (const duration of [8, 0]) {
    const core = createMesmerCoreState();
    const events = [];
    const context = {
      state: {
        profession: { core, specialization: { kind: 'Core', state: {} } },
        traits: new Set(),
        helpers: {
          balanceProfilesById: new Map([
            [
              TRAIT.MASTER_FENCER,
              { ...mesmerCatalog.balanceProfilesById.get(TRAIT.MASTER_FENCER), internalCooldown: duration }
            ]
          ])
        }
      }
    };
    context.state.effects = captureEffectEmissions({
      submit: (event) => {
        assert.equal(context.state.procs.snapshot()[TRAIT.MASTER_FENCER], event.at + duration);
        events.push(event);
        return event;
      }
    }).effects;
    context.state.procs = createProcRegistry(() => context.state);
    context.state.procs.setDeadline(TRAIT.MASTER_FENCER, 2);
    const opportunity = (at, didCrit = true) =>
      triggerMesmerCriticalTraits(context, { type: 'damage', actorType: 'player', coefficient: 1, at, didCrit }, 0.5);
    opportunity(1);
    context.state.traits.add(TRAIT.MASTER_FENCER);
    opportunity(1);
    assert.equal(events.length, 0);
    opportunity(2);
    assert.equal(context.state.procs.snapshot()[TRAIT.MASTER_FENCER], 2);
    opportunity(2.000001, false);
    assert.equal(events.length, 0);
    opportunity(2.000001);
    assert.equal(events.length, 2);
    assert.equal(context.state.procs.snapshot()[TRAIT.MASTER_FENCER], 2.000001 + duration);
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
      const bonus = result.resolvedEvents.filter(
        (event) => event.type === 'condition' && event.sourceId === TRAIT.THE_PLEDGE
      );
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

// Nested condition reactions must observe the earlier Chaos recharge and both claimed interrupt cooldowns.
test('Ineptitude emission observes the committed Chaotic Interruption recharge', () => {
  let readyAt = 10;
  let observed = false;
  const context = {
    config: defaultSimulationConfig({
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      target: { activatingSkills: true, defiant: true }
    }),
    activeWeaponSet: 1,
    traits: new Set([TRAIT.CHAOTIC_INTERRUPTION, TRAIT.INEPTITUDE]),
    helpers: mesmerCatalog,
    cooldownController: {
      readyAt: () => readyAt,
      reduceSkillRecharge: (_skill, amount) => {
        readyAt -= amount;
      }
    },
    effects: {
      emit(request) {
        if (request.kind !== 'packet' || request.event.sourceId !== TRAIT.INEPTITUDE) return;
        assert.equal(readyAt, 5);
        assert.equal(context.procs.deadline(TRAIT.CHAOTIC_INTERRUPTION), 2);
        assert.equal(context.procs.deadline('mesmer.core.ineptitude'), 4);
        observed = true;
      }
    }
  };
  context.procs = createProcRegistry(() => context);
  triggerMesmerControlTraits(context, { type: 'control', at: 1, skillName: 'test control' });
  assert.ok(observed);
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

// Cross-line dispatch preserves the applied condition order before the same-time membrane modifier.
test('Maim, Rending Shatter, and Illusionary Membrane preserve post-shatter order', () => {
  const result = simulateMesmer(
    ['Cry of Frustration', { type: 'wait', durationMs: 1 }],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 1,
      selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED, TRAIT.RENDING_SHATTER, TRAIT.ILLUSIONARY_MEMBRANE]
    })
  );
  // Announcement identities are independent of combat order; compare the actual applied effects.
  const maim = result.events.find(
    (event) => event.type === 'condition' && event.name.includes('Maim the Disillusioned')
  );
  const membrane = result.events.find((event) => event.type === 'buff' && event.kind === 'illusionary-membrane');
  const rending = result.events.find((event) => event.type === 'condition' && event.sourceId === TRAIT.RENDING_SHATTER);

  assert.ok(maim);
  assert.ok(membrane);
  assert.ok(rending);
  assert.ok(maim.eventOrder < rending.eventOrder);
  assert.ok(rending.eventOrder < membrane.eventOrder);
});

test('canonical phantasm ownership triggers Sharper Images without Master Fencer', () => {
  const procs = [];
  const context = {
    state: {
      traits: new Set([TRAIT.MASTER_FENCER, TRAIT.SHARPER_IMAGES]),
      helpers: mesmerCatalog,
      profession: {
        core: createMesmerCoreState(),
        specialization: { kind: 'Core', state: {} }
      }
    }
  };
  context.state.effects = captureEffectEmissions({
    announce: (request) => {
      procs.push(request.announcement.name);
      return { type: 'proc', ...request.attribution, ...request.announcement };
    }
  }).effects;

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

// A summon can cause Dazzling, but downstream condition observers must still see a player-owned trait.
test('Dazzling preserves ownership and live profile edits for eligible control', () => {
  for (const actorType of ['player', 'summon', 'effect']) {
    for (const offTarget of [false, true]) {
      for (const removed of [false, true]) {
        const config = defaultSimulationConfig({
          specialization: 'Core',
          selectedTraitIds: [TRAIT.DAZZLING],
          target: { conditions: {} }
        });
        const native = mesmerProfession.runtimeFor(config);
        const profile = native.catalog.balanceProfilesById.get(TRAIT.DAZZLING);
        const observed = [];
        const result = observeGw2Runtime({
          config,
          rotation: [{ type: 'wait', durationMs: 1000 }],
          profession: {
            ...native,
            catalog: withProfile(native.catalog, TRAIT.DAZZLING, {
              effects: removed ? [] : profile.effects.map((effect) => ({ ...effect, stacks: 7, duration: 3 }))
            }),
            initialize(runtime) {
              native.initialize(runtime);
              runtime.effects.emit({
                kind: 'packet',
                event: {
                  type: 'control',
                  source: 'Mesmer',
                  sourceId: ID.MAGIC_BULLET,
                  at: 0.1,
                  actorType,
                  offTarget,
                  controlKind: 'stun',
                  skillId: ID.MAGIC_BULLET,
                  skillName: 'Magic Bullet',
                  activationId: 'test.control'
                }
              });
            },
            reactions: {
              ...native.reactions,
              'condition.applied'(runtime, event, details) {
                native.reactions['condition.applied']?.(runtime, event, details);
                if (event.sourceId === TRAIT.DAZZLING) observed.push(event);
              }
            }
          }
        });
        assert.deepEqual(result.warnings, []);
        assert.equal(
          observed.reduce((sum, event) => sum + event.stacks, 0),
          !removed && !offTarget && actorType !== 'effect' ? 7 : 0
        );
        if (observed.length) {
          const [event] = observed;
          assert.equal(event.actorType, 'effect');
          assert.equal(event.ownerActorType, 'player');
          assert.equal(event.skillId, ID.MAGIC_BULLET);
          assert.equal(event.skillName, 'Magic Bullet');
          assert.equal(event.activationId, 'test.control');
          assert.equal(event.stacks, 1);
          assert.equal(event.duration, 3);
        }
      }
    }
  }
});

// Variant additions retain patched base effects, live profile removal, and the projectile's command targeting.
test('Bountiful Blades uses live packets with the base projectile impact delay', () => {
  for (const removed of [false, true]) {
    for (const offTarget of [false, true]) {
      const config = defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: '',
        initialResource: 0,
        selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES]
      });
      const native = mesmerProfession.runtimeFor(config);
      const catalog = withProfile(
        withSkill(native.catalog, ID.MIRROR_BLADE, {
          effects: [
            {
              type: 'strike',
              ticks: [{ atMs: 600, coefficient: 0.75 }],
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            }
          ]
        }),
        TRAIT.BOUNTIFUL_BLADES,
        {
          effects: removed
            ? []
            : [
                {
                  type: 'strike',
                  name: 'Strike',
                  ticks: [{ atMs: 1300, coefficient: 0.125 }],
                  timingAnchor: 'castStart',
                  timingScale: 'fixed'
                }
              ]
        }
      );
      const result = observeGw2Runtime({
        config,
        profession: { ...native, catalog },
        rotation: [
          { type: 'cast', skillId: ID.MIRROR_BLADE, impactDelayMs: offTarget ? 0 : 250, offTarget },
          { type: 'wait', durationMs: 1500 }
        ]
      });
      assert.deepEqual(result.warnings, []);
      const packets = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.MIRROR_BLADE);
      assert.equal(packets.length, removed ? 1 : 2);
      assert.equal(packets[0].coefficient, 0.75);
      assert.equal(packets[0].at, offTarget ? 0.6 : 0.85);
      if (!removed) {
        assert.equal(packets[1].coefficient, 0.125);
        assert.equal(packets[1].at, offTarget ? 1.3 : 1.55);
        assert.equal(packets[1].sourceId, TRAIT.BOUNTIFUL_BLADES);
        assert.equal(packets[1].actorType, 'player');
        assert.equal(packets[1].activationId, packets[0].activationId);
      }

      assert.ok(packets.every((event) => Boolean(event.offTarget) === offTarget));
    }
  }
});
