import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { engineerCoreHooks } from '#gw2/professions/engineer/core/hooks.js';
import { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { notifyToolbeltActivation } from '#gw2/professions/engineer/core/mechanics/activations.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

/** Initialize the real trait registrations against isolated per-run state and the shared emission service. */
function fixture(selected, capture = captureEffectEmissions()) {
  const runtime = {
    time: 1,
    helpers: engineerCatalog,
    traits: new Set(selected),
    profession: { core: createEngineerCoreState() },
    effects: capture.effects
  };
  engineerCoreModule.hooks.initialize(runtime);
  return { runtime, ...capture };
}

test('toolbelt notifications preserve commit, independent-command, and precast-mine boundaries', () => {
  const ordinary = engineerCatalog.skillsById.get(ID.DETONATE_MINE_FIELD);
  for (const path of ['ordinary', 'independent', 'precast-mine']) {
    const { runtime, events } = fixture([TRAIT.OPTIMIZED_ACTIVATION, TRAIT.STATIC_DISCHARGE, TRAIT.KINETIC_BATTERY]);
    const cast = { id: 1, skill: { ...ordinary, independentCast: path === 'independent' } };
    if (path === 'precast-mine') {
      runtime.profession.core.pendingMineFieldActivationIds.push(cast.id);
      assert.equal(runtime.profession.core.kineticCharges, 0);
      engineerCoreHooks.onCombatStart(runtime);
      engineerCoreHooks.onCombatStart(runtime);
    } else {
      engineerCoreHooks.onCastStart(runtime, cast);
      assert.equal(runtime.profession.core.kineticCharges, path === 'independent' ? 1 : 0);
      engineerCoreHooks.onCastCommit(runtime, cast);
    }

    assert.equal(runtime.profession.core.kineticCharges, 1, `${path} must activate once`);
    assert.ok(events.some((event) => event.sourceId === TRAIT.OPTIMIZED_ACTIVATION));
    assert.ok(events.some((event) => event.skillId === ID.STATIC_DISCHARGE_TRAIT_SKILL));
  }
});

test('activation subscriptions remain isolated between simulations and respect trait selection', () => {
  const selected = fixture([TRAIT.KINETIC_BATTERY]);
  const unselected = fixture([]);
  const toolbelt = engineerCatalog.skillsById.get(ID.DETONATE_MINE_FIELD);
  notifyToolbeltActivation(selected.runtime, { ...toolbelt, countsAsToolbeltSkill: false }, 1);
  assert.equal(selected.runtime.profession.core.kineticCharges, 0);
  notifyToolbeltActivation(selected.runtime, toolbelt, 1);
  notifyToolbeltActivation(unselected.runtime, toolbelt, 1);
  assert.equal(selected.runtime.profession.core.kineticCharges, 1);
  assert.equal(unselected.runtime.profession.core.kineticCharges, 0);
  assert.deepEqual(unselected.events, []);
});

test('Steel-Packed Powder settles Vulnerability before subsequent explosion reactions inspect state', () => {
  let vulnerability = 0;
  let rolls = 0;
  const capture = captureEffectEmissions({
    submit(event, delivery) {
      if (event.condition === 'Vulnerability') {
        assert.equal(delivery.settlement, 'reaction');
        vulnerability += event.stacks;
      }

      return event;
    }
  });
  const { runtime } = fixture([TRAIT.STEEL_PACKED_POWDER, TRAIT.SHRAPNEL], capture);
  runtime.random = {
    roll() {
      assert.equal(vulnerability, 1);
      rolls++;
      return false;
    }
  };
  const react = engineerCoreModule.hooks.reactions['damage.resolved'];
  const hit = { at: 1, actorType: 'effect', ownerActorType: 'player', coefficient: 1, explosion: true };
  react(runtime, { ...hit, coefficient: 0 }, {});
  react(runtime, { ...hit, explosion: false }, {});
  assert.equal(vulnerability, 0);
  assert.equal(rolls, 0);
  react(runtime, hit, {});
  assert.equal(vulnerability, 1);
  assert.equal(rolls, 1);
});

test('dodge recharge rewards settle in order after dodge publication and before its queued rearm', () => {
  const { runtime, events, announcements } = fixture([TRAIT.POWER_WRENCH, TRAIT.ADRENAL_IMPLANT]);
  const reductions = [];
  const elite = { id: 'elite', name: 'Elite toolbelt', type: 'Elite', countsAsToolbeltSkill: true };
  runtime.helpers = { ...engineerCatalog, skillsById: new Map([[elite.id, elite]]) };
  runtime.profession.core.explosiveEntranceFired = true;
  runtime.cooldownController = {
    reduceSkillRecharge(_skill, seconds) {
      assert.equal(events[0].type, 'engineer.dodge');
      assert.equal(runtime.profession.core.explosiveEntranceFired, true);
      reductions.push(seconds);
      return seconds;
    }
  };
  const dodge = engineerCatalog.skillsByName.get('Dodge');
  engineerCoreHooks.onCastStart(runtime, { id: 1, skill: dodge });
  assert.deepEqual(reductions, [3, 1]);
  assert.deepEqual(
    announcements.map((request) => request.attribution.sourceId),
    [TRAIT.POWER_WRENCH, TRAIT.ADRENAL_IMPLANT]
  );
});
