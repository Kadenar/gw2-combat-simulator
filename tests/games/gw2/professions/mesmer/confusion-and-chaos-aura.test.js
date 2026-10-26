import assert from 'node:assert/strict';
import test from 'node:test';
import { AURA, ACTOR } from '#gw2/platform/constants.js';
import { cryOfPainConfusion } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Changing native condition tuning must remain visible through the trait rather than being replaced by fixed facts.
test('Cry of Pain augments the base condition and preserves removal and ownership', () => {
  const context = { traits: new Set([TRAIT.CRY_OF_PAIN]), helpers: mesmerCatalog };
  const base = {
    type: 'condition',
    condition: 'Confusion',
    stacks: 4,
    duration: 9,
    actorType: ACTOR.PLAYER,
    sourceId: ID.CRY_OF_FRUSTRATION
  };
  for (const [profile, stacks, duration] of [
    [undefined, 5, 12],
    [mesmerCatalog.skillsById.get(ID.FLUSTERING_FLUTE), 6, 13.5]
  ]) {
    assert.deepEqual(cryOfPainConfusion(context, base, profile), { ...base, stacks, duration });
    assert.equal(cryOfPainConfusion(context, undefined, profile), undefined);
    assert.equal(cryOfPainConfusion({ ...context, traits: new Set() }, base, profile), base);
  }

  assert.equal(base.stacks, 4);
  assert.equal(base.duration, 9);
});

const membrane = (result) =>
  result.events.filter((event) => event.type === 'buff' && event.kind === 'illusionary-membrane');

// All supported F2 paths and native staff aura sources must feed the same aura-gain reaction.
test('Illusionary Membrane follows Chaos Aura from F2, Flute, Chaos Armor, and staff combos', () => {
  for (const [specialization, rotation] of [
    ['Core', ['Cry of Frustration']],
    ['Chronomancer', ['Rewinder']],
    ['Virtuoso', ['Bladesong Sorrow']],
    ['Troubadour', ['Flustering Flute']],
    ['Core', ['Chaos Armor']],
    ['Core', ['Chaos Storm', 'Phase Retreat']]
  ]) {
    const result = simulateMesmer(
      rotation,
      defaultSimulationConfig({
        specialization,
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
        initialResource: 1,
        selectedTraitIds: [TRAIT.ILLUSIONARY_MEMBRANE]
      }),
      { kind: 'tail', durationMs: 1 }
    );
    const aura = result.resolvedEvents.find((event) => event.type === 'aura' && event.aura === AURA.CHAOS);
    assert.ok(aura, rotation.join(', '));
    const [buff] = membrane(result);
    assert.ok(buff, rotation.join(', '));
    assert.equal(buff.duration, 5);
    assert.equal(buff.activationId, aura.activationId);
    assert.ok(aura.eventOrder < buff.eventOrder);
    assert.deepEqual(result.warnings, []);
  }
});

test('Chaos Armor needs the trait for its damage buff and canceled Flute grants no aura', () => {
  const staff = simulateMesmer(
    ['Chaos Armor'],
    { specialization: 'Core', primaryWeapon: 'Staff', secondaryWeapon: '', selectedTraitIds: [] },
    { kind: 'tail', durationMs: 1 }
  );
  assert.ok(staff.resolvedEvents.some((event) => event.aura === AURA.CHAOS));
  assert.equal(membrane(staff).length, 0);
  const canceled = simulateMesmer([{ name: 'Flustering Flute', interruptMs: 0 }], {
    specialization: 'Troubadour',
    selectedTraitIds: [TRAIT.ILLUSIONARY_MEMBRANE]
  });
  assert.equal(
    canceled.resolvedEvents.some((event) => event.aura === AURA.CHAOS),
    false
  );
  assert.equal(membrane(canceled).length, 0);
});

// Minimal aura fixtures isolate buff ownership, extension, cap, expiry, and the outgoing damage multiplier.
function auraScenario(auras, endMs, selected = true) {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    selectedTraitIds: selected ? [TRAIT.ILLUSIONARY_MEMBRANE] : []
  });
  const native = mesmerProfession.runtimeFor(config);
  return observeGw2Runtime({
    config,
    rotation: [{ type: 'wait', durationMs: endMs }],
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        for (const aura of auras)
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'aura',
              at: 0,
              aura: AURA.CHAOS,
              actorType: ACTOR.PLAYER,
              source: 'Fixture',
              sourceId: ID.CHAOS_ARMOR,
              skillId: ID.CHAOS_ARMOR,
              skillName: 'Fixture Aura',
              duration: 4,
              ...aura
            }
          });
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'condition',
            at: 0.1,
            condition: 'Bleeding',
            stacks: 1,
            duration: 1,
            actorType: ACTOR.PLAYER,
            source: 'Fixture',
            sourceId: ID.CHAOS_ARMOR,
            skillId: ID.CHAOS_ARMOR,
            skillName: 'Fixture Bleeding'
          }
        });
      }
    }
  });
}

test('Chaos Aura extends one damage bonus to its cap and expires at the boundary', () => {
  const simultaneous = auraScenario([{}, {}, {}, {}], 1);
  assert.deepEqual(
    membrane(simultaneous).map((event) => event.duration),
    [5, 10, 15, 15]
  );
  const auras = [{}, { at: 1 }, { at: 2 }, { at: 3 }];
  const before = auraScenario(auras, 17999);
  const atExpiry = auraScenario(auras, 18000);
  assert.deepEqual(
    membrane(before).map((event) => event.duration),
    [5, 9, 13, 15]
  );
  assert.equal(observedRuntime(before).mechanics.combat.activeBuffStacks('illusionary-membrane', 17.999, 1), 1);
  assert.equal(observedRuntime(atExpiry).mechanics.combat.activeBuffStacks('illusionary-membrane', 18, 1), 0);
  const expired = auraScenario([{}, { at: 6 }], 6001);
  assert.deepEqual(
    membrane(expired).map((event) => event.duration),
    [5, 5]
  );
  const base = auraScenario([{}], 2000, false);
  const improved = auraScenario([{}], 2000);
  assert.ok(base.totalDamage > 0);
  assert.ok(Math.abs(improved.totalDamage / base.totalDamage - 1.07) < 0.01);
});

test('Unrelated auras and summon-owned Chaos Aura do not grant Illusionary Membrane', () => {
  const result = auraScenario([{ aura: AURA.FIRE }, { actorType: ACTOR.SUMMON }], 1000);
  assert.equal(membrane(result).length, 0);
});
