import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDaredevilDodge } from '#gw2/professions/thief/specializations/daredevil/traits/index.js';
import { createDaredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { createThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

test('Daredevil emits only current profile effects, including patched condition offsets', () => {
  for (const effects of [[], [{ type: 'condition', condition: 'Poisoned', atMs: 400, duration: 7, stacks: 3 }]]) {
    const events = [];
    const config = { selectedDodge: 'Lotus Training' };
    const context = {
      config,
      events,
      start: 2,
      effectiveEnd: 3,
      state: {
        profession: {
          core: createThiefCoreState(config),
          specialization: { kind: 'Daredevil', state: createDaredevilState(config) }
        }
      },
      catalog: { ...thiefCatalog, balanceProfilesById: new Map([[TRAIT.LOTUS_TRAINING, { effects }]]) },
      emit: (event) => {
        events.push(event);
        return event;
      }
    };
    applyDaredevilDodge(context, thiefCatalog.skillsById.get(ID.DODGE));
    const packets = events.filter((event) => event.type === 'damage' || event.type === 'condition');
    assert.equal(packets.length, effects.length);
    if (effects.length) {
      const [packet] = packets;
      assert.equal(packet.at, 2.4);
      assert.equal(packet.condition, 'Poisoned');
      assert.equal(packet.stacks, 3);
      assert.equal(packet.duration, 7);
      assert.equal(packet.sourceId, TRAIT.LOTUS_TRAINING);
      assert.equal(packet.skillId, ID.DODGE);
      assert.equal(packet.skillName, 'Impaling Lotus');
      assert.equal(packet.actorType, 'player');
    }
  }
});
