import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { applyAimAssistedRocket } from '#gw2/professions/engineer/core/traits/explosives/explosions.js';
import { applyEngineerToolbeltTraits } from '#gw2/professions/engineer/core/traits/tools/toolbelt.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('Kinetic Battery resets before its reward and admits only qualifying toolbelt casts', () => {
  // A fractional profile threshold distinguishes a full reset from retained overflow.
  const core = createEngineerCoreState();
  core.kineticCharges = 2;
  const observations = [];
  const context = {
    helpers: applyBalanceProfilePatch(engineerCatalog, {
      balanceProfiles: { [TRAIT.KINETIC_BATTERY]: { fields: { maximumStacks: { from: 5, to: 2.5 } } } }
    }),
    traits: new Set([TRAIT.KINETIC_BATTERY]),
    profession: { core },
    effects: captureEffectEmissions({
      submit(event) {
        observations.push([event.kind, core.kineticCharges]);
        return event;
      }
    }).effects
  };
  const skill = { id: 'test.toolbelt', name: 'Toolbelt', countsAsToolbeltSkill: true };
  applyEngineerToolbeltTraits(context, { ...skill, countsAsToolbeltSkill: false }, 1);
  assert.equal(core.kineticCharges, 2);
  assert.deepEqual(observations, []);
  applyEngineerToolbeltTraits(context, skill, 1);
  assert.equal(core.kineticCharges, 0);
  assert.ok(observations.some(([kind]) => kind === 'quickness'));
  assert.ok(observations.every(([, count]) => count === 0));
  applyEngineerToolbeltTraits(context, skill, 2);
  assert.equal(core.kineticCharges, 1);
  context.traits.clear();
  applyEngineerToolbeltTraits(context, skill, 3);
  assert.equal(core.kineticCharges, 1);
});

test('Aim-Assisted Rocket claims its ICD and cumulative progress before emitting the selected proc', () => {
  // Ownership and the exclusive ICD boundary must filter events before they enter the orbital cycle.
  const core = createEngineerCoreState();
  core.aimAssistedRocketCount = 4;
  const observations = [];
  const context = {
    helpers: engineerCatalog,
    traits: new Set([TRAIT.AIM_ASSISTED_ROCKET]),
    profession: { core },
    effects: captureEffectEmissions({
      submit(event) {
        observations.push([event.name, core.aimAssistedRocketCount, context.procs.deadline('aimAssistedRocket')]);
        return event;
      }
    }).effects
  };
  context.procs = createProcRegistry(() => context);
  const event = { at: 1, actorType: 'player', projectile: true, skillName: 'Projectile', coefficient: 1 };
  applyAimAssistedRocket(context, { ...event, actorType: 'effect', ownerActorType: 'player' });
  assert.equal(core.aimAssistedRocketCount, 4);
  applyAimAssistedRocket(context, event);
  const readyAt = context.procs.deadline('aimAssistedRocket');
  assert.ok(readyAt > event.at);
  assert.deepEqual(observations, [['Orbital Command Strike', 5, readyAt]]);
  applyAimAssistedRocket(context, { ...event, at: readyAt });
  assert.equal(core.aimAssistedRocketCount, 5);
  applyAimAssistedRocket(context, { ...event, at: readyAt + 1 });
  assert.equal(core.aimAssistedRocketCount, 6);
  assert.equal(observations[1][0], 'Aim-Assisted Rocket');
});
