import assert from 'node:assert/strict';
import test from 'node:test';

import { restoreFlatProfessionState, snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { handleEngineerState } from '#gw2/professions/engineer/state.js';
import { handleRevenantState } from '#gw2/professions/revenant/state.js';

test('profession snapshots flatten and deeply clone active runtime state', () => {
  const runtime = {
    core: { resource: 10, nested: { value: 1 } },
    specialization: { kind: 'Fixture', state: { eliteResource: 2 } }
  };

  const snapshot = snapshotProfessionState(runtime);
  assert.deepEqual(snapshot, { resource: 10, nested: { value: 1 }, eliteResource: 2 });
  snapshot.nested.value = 9;
  assert.equal(runtime.core.nested.value, 1);
});

test('flat snapshot restoration routes declared specialization keys and clones values', () => {
  const core = { resource: 1 };
  const specialization = { eliteResource: 2, nested: {} };
  const incoming = { resource: 3, eliteResource: 4, nested: { value: 5 } };

  restoreFlatProfessionState(core, specialization, incoming);
  assert.deepEqual(core, { resource: 3 });
  assert.deepEqual(specialization, { eliteResource: 4, nested: { value: 5 } });
  incoming.nested.value = 8;
  assert.equal(specialization.nested.value, 5);
});

test('family restoration preserves resolver-owned Engineer and Revenant clocks', () => {
  const engineer = {
    profession: {
      core: { endurance: 10, traitProcReadyAt: { thermalVisionUntil: 7 } },
      specialization: { kind: 'Holosmith', state: { heat: 1 } }
    }
  };
  handleEngineerState(engineer, {
    state: { endurance: 20, heat: 2, traitProcReadyAt: { thermalVisionUntil: 1 } }
  });
  assert.equal(engineer.profession.core.endurance, 20);
  assert.equal(engineer.profession.specialization.state.heat, 2);
  assert.deepEqual(engineer.profession.core.traitProcReadyAt, { thermalVisionUntil: 7 });

  const revenant = {
    profession: {
      core: { energy: 10, traitProcReadyAt: { chargedMistsReadyAt: 8 } },
      specialization: { kind: 'Renegade', state: { kallasFervor: 1, soulcleaveReadyAt: 9 } }
    }
  };
  handleRevenantState(revenant, {
    state: {
      energy: 20,
      kallasFervor: 2,
      traitProcReadyAt: { chargedMistsReadyAt: 1 },
      soulcleaveReadyAt: 3
    }
  });
  assert.equal(revenant.profession.core.energy, 20);
  assert.equal(revenant.profession.specialization.state.kallasFervor, 2);
  assert.deepEqual(revenant.profession.core.traitProcReadyAt, { chargedMistsReadyAt: 8 });
  assert.equal(revenant.profession.specialization.state.soulcleaveReadyAt, 9);
});
