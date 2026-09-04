import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { triggerMesmerCriticalTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

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
