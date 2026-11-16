// Player effect selection and summon ownership must agree without delivering either owner's work twice.
import assert from 'node:assert/strict';
import test from 'node:test';

import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';

const config = {
  ...createDefaultConfig(),
  specialization: 'Core',
  primaryWeapon: 'Spear',
  secondaryWeapon: '',
  initialResource: 0,
  target: { armor: 2597, conditions: {} }
};
const rotation = [ID.PHANTASMAL_LANCER, { type: 'wait', durationMs: 5000 }];

test('player effect predicates suppress only their own delivery while summon conversion remains available', () => {
  for (const enabled of [false, true]) {
    const result = runMesmer(rotation, config, {
      catalog(catalog) {
        const skill = catalog.skillsById.get(ID.PHANTASMAL_LANCER);
        return withSkill(catalog, skill.id, {
          effects: [
            ...skill.effects.filter((effect) => effect.summonKind === 'phantasm'),
            { type: 'strike', coefficient: 1, name: 'Selected player strike', when: () => enabled },
            { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 10, when: () => enabled }
          ]
        });
      }
    });
    assert.deepEqual(result.warnings, []);
    // One authored strike and condition must each cross the player delivery path once, or not at all.
    const strikes = result.events.filter((event) => event.name === 'Selected player strike');
    const conditions = result.events.filter((event) => event.condition === 'Vulnerability');
    assert.equal(strikes.length, Number(enabled));
    assert.equal(conditions.length, Number(enabled));
    for (const event of [...strikes, ...conditions]) {
      assert.equal(event.actorType, 'player');
      assert.equal(event.source, 'Player');
      assert.equal(event.sourceId, ID.PHANTASMAL_LANCER);
    }

    assert.ok(result.events.some((event) => event.type === 'damage' && event.summonKind === 'phantasm'));
    assert.equal(result.planningState.profession[STATE.RESOURCE], 1);
  }
});

test('player variants and summon preparation share the accepted Clarity snapshot', () => {
  for (const clarity of [false, true]) {
    const result = runMesmer(rotation, config, {
      initialize(runtime) {
        runtime.profession.core.clarity = { charges: Number(clarity), expiresAt: 10 };
      },
      catalog(catalog) {
        return withSkill(catalog, ID.PHANTASMAL_LANCER, {
          effectVariants: [
            {
              when: (runtime, cast) => Boolean(runtime.profession.core.castDetails.get(cast.id)?.clarityConsumed),
              transform: (_runtime, _cast, effects) =>
                effects.map((effect) =>
                  effect.type === 'strike' && effect.summonKind !== 'phantasm'
                    ? { ...effect, name: 'Clarity player strike' }
                    : effect
                )
            }
          ]
        });
      }
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.name === 'Clarity player strike'),
      clarity
    );
    assert.equal(
      result.events.some((event) => event.name === 'Mesmer attack'),
      !clarity
    );
    assert.equal(result.planningState.profession[STATE.RESOURCE], clarity ? 2 : 1);
  }
});

test('Defender control reactions observe its already-applied Taunt condition', () => {
  const observed = [];
  const result = runMesmer([ID.PHANTASMAL_DEFENDER], config, {
    extend: (native) => ({
      reactions: {
        ...native.reactions,
        'control.resolved'(runtime, event, details) {
          if (event.skillId === ID.PHANTASMAL_DEFENDER)
            observed.push(runtime.combat.targetHasCondition('Taunt', event.at));

          return native.reactions['control.resolved']?.(runtime, event, details);
        }
      }
    })
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(observed, [true]);
});

test('player strikes, summon attacks, and Phantasmal Blades retain separate source identities', () => {
  const result = runMesmer(rotation, {
    ...config,
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.PHANTASMAL_BLADES]
  });
  assert.deepEqual(result.warnings, []);
  const cast = result.events.find((event) => event.type === 'action' && event.skillId === ID.PHANTASMAL_LANCER);
  const player = result.events.find(
    (event) => event.type === 'damage' && event.skillId === ID.PHANTASMAL_LANCER && event.actorType === 'player'
  );
  const summon = result.events.find((event) => event.type === 'damage' && event.summonKind === 'phantasm');
  const blade = result.events.find((event) => event.type === 'damage' && event.traitId === TRAIT.PHANTASMAL_BLADES);
  assert.ok(player && summon && blade);
  assert.equal(player.activationId, cast.activationId);
  assert.equal(player.source, 'Player');
  assert.equal(summon.source, 'Phantasm');
  assert.equal(summon.actorType, 'summon');
  assert.equal(blade.actorType, 'player');
  assert.equal(blade.metadata.blade, true);
  assert.notEqual(blade.sourceId, player.sourceId);
  assert.notEqual(blade.activationId, player.activationId);
  assert.notEqual(blade.activationId, summon.activationId);
});
