import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';

// Core's kit contribution must work without accessing a Holosmith state slice.
test('kit equip and stow retain cast attribution across non-Holosmith specializations', () => {
  for (const specialization of ['Core', 'Scrapper', 'Mechanist', 'Amalgam']) {
    const transitions = [];
    const result = runEngineer(
      ['Grenade Kit', 'Stow Grenade Kit'],
      { specialization, selectedSkillIds: [ID.GRENADE_KIT] },
      {
        extend: (native) => ({
          onCastCommit(runtime, cast) {
            native.onCastCommit?.(runtime, cast);
            transitions.push({ cast, kit: runtime.profession.core.activeKit });
          }
        })
      }
    );
    assert.deepEqual(result.warnings, [], specialization);
    assert.deepEqual(
      transitions.map(({ kit }) => kit),
      [ID.GRENADE_KIT, null],
      specialization
    );
    const swaps = result.events.filter((event) => event.type === 'sigil_swap');
    assert.equal(swaps.length, transitions.length, specialization);
    for (const { cast } of transitions) {
      const swap = swaps.find((event) => event.activationId === cast.id);
      assert.ok(swap, specialization);
      assert.equal(swap.source, 'engineer');
      assert.equal(swap.sourceId, cast.skill.id);
      assert.equal(swap.skillId, cast.skill.id);
      assert.equal(swap.skillName, cast.skill.name);
      assert.equal(swap.name, cast.skill.name);
      assert.equal(swap.actorType, 'player');
      assert.equal(swap.weaponSet, result.planningState.activeWeaponSet);
    }
  }
});

// Forge replaces a kit without synthesizing a stow cast or inheriting the kit swap's activation attribution.
test('Forge entry clears the kit and explicit exit preserves Forge swap attribution', () => {
  const transitions = [];
  const result = runEngineer(
    ['Grenade Kit', 'Engage Photon Forge', { type: 'wait', durationMs: 1000 }, 'Deactivate Photon Forge'],
    { specialization: 'Holosmith', selectedSkillIds: [ID.GRENADE_KIT] },
    {
      extend: (native) => ({
        onCastCommit(runtime, cast) {
          native.onCastCommit?.(runtime, cast);
          transitions.push({
            cast,
            kit: runtime.profession.core.activeKit,
            forge: holosmithState.from(runtime.profession).photonForgeActive
          });
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    transitions.map(({ kit, forge }) => ({ kit, forge })),
    [
      { kit: ID.GRENADE_KIT, forge: false },
      { kit: null, forge: true },
      { kit: null, forge: false }
    ]
  );
  const swaps = result.events.filter((event) => event.type === 'sigil_swap');
  assert.equal(swaps.length, transitions.length);
  for (const { cast } of transitions.filter(({ cast }) => !cast.skill.kitTransition)) {
    const swap = swaps.find((event) => event.skillId === cast.skill.id);
    assert.ok(swap);
    assert.equal(swap.source, 'engineer');
    assert.equal(swap.sourceId, cast.skill.id);
    assert.equal(swap.skillName, cast.skill.name);
    assert.equal(swap.actorType, 'player');
    assert.equal(swap.weaponSet, result.planningState.activeWeaponSet);
    assert.equal(swap.activationId, cast.id);
    assert.equal(swap.name, cast.skill.name);
  }
});
