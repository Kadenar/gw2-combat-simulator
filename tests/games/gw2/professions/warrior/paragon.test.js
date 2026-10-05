import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise the registered family with one live Core and specialization owner.
function run(rotation, overrides = {}, source = warriorProfession, output = 'detailed') {
  const config = {
    specialization: 'Paragon',
    primaryWeapon: 'Axe',
    initialResource: 30,
    selectedTraitIds: [],
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 },
    ...overrides
  };
  const result = observeGw2Runtime({ profession: source.runtimeFor(config), config, rotation, output });
  assert.deepEqual(result.warnings, []);
  return result;
}

const wait = (durationMs) => ({ type: 'wait', durationMs });
const combat = { type: 'combat-start' };
const state = (result) => observedRuntime(result).profession.specialization.state;
const core = (result) => observedRuntime(result).profession.core;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

// A selected cap applies before chant rewards; snapshots and meters share the resulting detached clock.
test('Motivation policies initialize empty, cap fractional rewards, and isolate selected catalogs', () => {
  for (const maximumStacks of [0, 2.5, 12]) {
    const patchId = 'motivation-cap';
    const source = withPatchPreview(warriorProfession, {
      id: patchId,
      label: 'Motivation cap',
      professions: {
        warrior: {
          balanceProfiles: {
            [PROFILE.resources]: { fields: { maximumStacks, pulseInterval: 0 } },
            [PROFILE.chants]: { fields: { resourceGain: 6.5 } }
          }
        }
      }
    });
    const initial = run([wait(5000)], { patchId }, source);
    assert.equal(state(initial).motivation.value, 0);
    assert.equal(state(initial).motivation.maximum, maximumStacks);
    const result = run(['Chant of Action', wait(1000), wait(4000)], { patchId }, source);
    const pool = state(result).motivation;
    assert.equal(pool.value, Math.min(maximumStacks, 6.5));
    assert.equal(pool.maximum, maximumStacks);
    assert.equal(pool.rate, 0);
    assert.deepEqual(result.planningState.profession.motivation, pool);
    assert.notEqual(result.planningState.profession.motivation, pool);
    assert.equal(Object.hasOwn(state(result), 'maximumMotivation'), false);
    assert.equal(Object.hasOwn(result.planningState.profession, 'maximumMotivation'), false);
    const view = source.ui
      .resourceViews({
        specialization: 'Paragon',
        catalog: source.catalogFor(patchId),
        professionState: result.planningState.profession
      })
      .find(({ id }) => id === 'motivation');
    assert.equal(view.value, pool.value);
    assert.equal(view.maximum, maximumStacks);
  }

  assert.equal(state(run(['Chant of Action'])).motivation.maximum, 10);
});

// Refrain work runs before an intervening refill and the independent echo at the same deadline.
test('a final partial pulse stops before a same-time refill and command echo', () => {
  const source = withPatchPreview(warriorProfession, {
    id: 'partial-refrain',
    label: 'Partial refrain',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.chants]: { fields: { resourceGain: 1.5 } }
        }
      }
    }
  });
  const config = {
    specialization: 'Paragon',
    patchId: 'partial-refrain',
    initialResource: 10,
    selectedSkillIds: [76755],
    selectedTraitIds: [TRAIT.INVIGORATING_TEMPO, TRAIT.REVERBERATION]
  };
  const native = source.runtimeFor(config);
  const seen = [];
  const record = (label, runtime) =>
    seen.push([
      label,
      runtime.resourceController.value('motivation'),
      runtime.profession.core.adrenaline,
      runtime.profession.specialization.state.activeRefrainId
    ]);
  const refrain = 'warrior.paragon-refrain';
  const echo = 'warrior.paragon-command-echo';
  const result = observeGw2Runtime({
    profession: {
      ...native,
      onCastCommit(runtime, cast) {
        native.onCastCommit?.(runtime, cast);
        if (cast.skill.id === ID.CHANT_OF_RECUPERATION) {
          runtime.profession.core.adrenaline = 0;
          runtime.schedule('test.refill', runtime.time + 3, null, undefined, -100);
        }
      },
      tasks: {
        ...native.tasks,
        [refrain](runtime, data) {
          native.tasks[refrain](runtime, data);
          record('pulse', runtime);
        },
        'test.refill'(runtime) {
          runtime.resourceController.grant('motivation', 4);
          record('refill', runtime);
        },
        [echo](runtime, data) {
          native.tasks[echo](runtime, data);
          record('echo', runtime);
        }
      }
    },
    config,
    rotation: ['"We Shall Return!"', 'Chant of Recuperation', wait(6000)]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(seen, [
    ['pulse', 0, 1.5, null],
    ['refill', 4, 1.5, null],
    ['echo', 4, 11.5, null]
  ]);
  assert.equal(state(result).motivation.value, 4);
  assert.deepEqual(state(result).commandEchoes, {});
});

// Extra observation boundaries must not move the owned pulse cadence or change pre-spend tiers.
test('fragmented waits preserve Motivation pulses and their tier selection', () => {
  const config = { selectedTraitIds: [TRAIT.ENDURING_REFRAIN, TRAIT.INVIGORATING_TEMPO] };
  const whole = run(['Chant of Action', wait(6000)], config);
  const split = run(['Chant of Action', wait(1001), wait(1999), wait(500), wait(2500)], config);
  assert.equal(state(split).motivation.value, state(whole).motivation.value);
  assert.equal(core(split).adrenaline, core(whole).adrenaline);
  const pulses = (result) =>
    result.events
      .filter((event) => event.kind === 'might' && event.skillId === ID.CHANT_OF_ACTION)
      .map(({ at, stacks }) => [at, stacks]);
  assert.deepEqual(pulses(split), pulses(whole));
});

// Removing one delayed component preserves entry effects, sibling packets, and the echo's consumption lifecycle.
test('Paragon delayed payloads use independent profiles without changing entry effects or echo lifetimes', () => {
  const source = withPatchPreview(warriorProfession, {
    id: 'delayed-payloads',
    label: 'Delayed payloads',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.refrain]: { removeEffects: [{ type: 'boon', name: 'fury' }] },
          [PROFILE.onYourKneesEcho]: {
            removeEffects: [{ type: 'strike', name: 'Echo Damage' }],
            effects: [{ type: 'condition', name: 'Echo Immobilized', duration: 7 }]
          },
          [PROFILE.findTheirWeaknessEcho]: { fields: { resourceGain: 6 } }
        }
      }
    }
  });
  const chant = run(['Chant of Action', wait(3000)], { patchId: 'delayed-payloads' }, source);
  const fury = chant.events.filter((event) => event.kind === 'fury');
  assert.equal(fury.length, 1);
  assert.equal(fury[0].at, chant.steps[0].end / 1000);
  const command = run([ID.ON_YOUR_KNEES, wait(3500)], { patchId: 'delayed-payloads' }, source);
  assert.equal(
    command.events.some((event) => event.name?.endsWith('Echo Damage')),
    false
  );
  assert.equal(command.events.find((event) => event.name?.endsWith('Echo Immobilized')).duration, 7);
  assert.deepEqual(state(command).commandEchoes, {});
  const baseline = run([ID.FIND_THEIR_WEAKNESS, wait(3500)], { initialResource: 0 });
  const tuned = run([ID.FIND_THEIR_WEAKNESS, wait(3500)], { initialResource: 0, patchId: 'delayed-payloads' }, source);
  assert.equal(core(tuned).adrenaline - core(baseline).adrenaline, 3);
});

test('chants and weapon bursts spend one bar and expose only live projected state', () => {
  const chant = run(['Chant of Action']);
  assert.deepEqual(chant.warnings, []);
  assert.equal(core(chant).adrenaline, 20);
  assert.equal(core(chant).maximumAdrenaline, 30);
  assert.equal(state(chant).motivation.value, 4);
  assert.equal(chant.planningState.profession.activeRefrain, 'Chant of Action');
  assert.equal(
    chant.events.some((event) => event.type === 'warrior.paragon-state'),
    false
  );
  const burst = run(['Eviscerate']);
  assert.equal(core(burst).adrenaline, 21);
  assert.equal(burst.events.find((event) => event.type === 'damage').metadata.warriorBurstTier, 1);
  const field = run(['Combustive Shot'], { primaryWeapon: 'Longbow' });
  const fields = field.events.filter((event) => event.type === 'combo_field');
  assert.equal(fields.length, 1);
  assert.equal(fields[0].expiresAt - fields[0].at, 3);
});

test('chant opening and refrain boons use actual party applications and the pre-spend tier', () => {
  const result = run(['Chant of Action', wait(3000)], { allies: { count: 4 } });
  assert.equal(state(result).motivation.value, 3);
  const packets = result.events.filter((event) => event.type === 'buff' && event.skillId === ID.CHANT_OF_ACTION);
  const pulse = packets.filter((event) => event.at > packets[0].at);
  assert.deepEqual(
    pulse.map((event) => [event.kind, event.stacks]),
    [
      ['might', 2],
      ['fury', 1]
    ]
  );
  for (const packet of packets) {
    assert.equal(packet.resolvedAudience.includesSelf, true);
    assert.equal(packet.resolvedAudience.alliedPlayerCount, 4);
  }
});

test('replacing a refrain cancels its old wake and starts the new chant cadence', () => {
  const prefix = ['Chant of Action', wait(1000), 'Chant of Freedom'];
  const before = run([...prefix, wait(2000)]);
  assert.equal(state(before).motivation.value, 8);
  const after = run([...prefix, wait(3000)]);
  assert.equal(state(after).motivation.value, 5);
  assert.equal(state(after).activeRefrainId, ID.CHANT_OF_FREEDOM);
  const openingEnd = after.events.find(
    (event) => event.type === 'action' && event.skillId === ID.CHANT_OF_FREEDOM
  ).endsAt;
  assert.equal(
    after.events.some(
      (event) => event.type === 'buff' && event.skillId === ID.CHANT_OF_ACTION && event.at > openingEnd
    ),
    false
  );
});

test('Invigorating Tempo rewards only actual Motivation spent, including the final partial pulse', () => {
  const config = { initialResource: 10, selectedTraitIds: [TRAIT.ENDURING_REFRAIN, TRAIT.INVIGORATING_TEMPO] };
  const partial = run(['Chant of Recuperation', wait(9000)], config);
  assert.equal(state(partial).motivation.value, 0);
  assert.equal(state(partial).activeRefrainId, null);
  assert.equal(core(partial).adrenaline, 5);
  const later = run(['Chant of Recuperation', wait(15000)], config);
  assert.equal(core(later).adrenaline, 5);
  assert.equal(later.planningState.profession.activeRefrain, '');
});

test('Call to Action starts once at accepted combat and preserves an existing refrain cadence', () => {
  const config = { selectedTraitIds: [TRAIT.CALL_TO_ACTION] };
  assert.equal(state(run([wait(5000)], config)).motivation.value, 0);
  assert.equal(state(run([{ name: 'Chop', offTarget: true }], config)).motivation.value, 0);
  const hit = run(['Chop', 'Double Chop'], config);
  assert.equal(state(hit).motivation.value, 4);
  assert.equal(state(hit).activeRefrainId, ID.CHANT_OF_ACTION);
  const existing = run(['Chant of Freedom', wait(1000), combat, wait(2000)], config);
  assert.equal(state(existing).activeRefrainId, ID.CHANT_OF_FREEDOM);
  assert.equal(state(existing).motivation.value, 5);
});

test('Rally grants at burst acceptance, while canceled bursts and chants retain only their spend', () => {
  const config = { selectedTraitIds: [TRAIT.CALL_TO_ACTION, TRAIT.RALLY_THE_VALIANT] };
  const result = run([combat, 'Eviscerate'], config);
  assert.equal(state(result).motivation.value, 8);
  const canceled = run([combat, { name: 'Breaching Strike', interruptAfterMs: 1 }], {
    ...config,
    primaryWeapon: 'Dagger'
  });
  assert.equal(state(canceled).motivation.value, 4);
  assert.equal(core(canceled).adrenaline, 20);
  const chant = run([{ name: 'Chant of Action', interruptAfterMs: 1 }]);
  assert.equal(state(chant).motivation.value, 0);
  assert.equal(state(chant).activeRefrainId, null);
  assert.equal(core(chant).adrenaline, 20);
});

test('burst-consumed echoes cancel their old wake and restart the remaining repeat from consumption', () => {
  const config = {
    initialResource: 10,
    selectedSkillIds: [76755],
    selectedTraitIds: [TRAIT.REVERBERATION]
  };
  const prefix = ['"We Shall Return!"', 'Chant of Action'];
  const consumed = run(prefix, config);
  assert.deepEqual(consumed.warnings, []);
  assert.equal(core(consumed).adrenaline, 10);
  assert.equal(Object.values(state(consumed).commandEchoes)[0].remaining, 1);
  // The former deadline lies before the rescheduled repeat; crossing it cannot deliver another grant.
  const oldWake = run([...prefix, wait(2900)], config);
  assert.equal(core(oldWake).adrenaline, 10);
  const repeated = run([...prefix, wait(3000)], config);
  assert.equal(core(repeated).adrenaline, 20);
  assert.deepEqual(state(repeated).commandEchoes, {});
  const canceled = run(['"We Shall Return!"', { name: 'Chant of Action', interruptAfterMs: 1 }], config);
  assert.equal(Object.values(state(canceled).commandEchoes)[0].remaining, 2);
  assert.equal(core(canceled).adrenaline, 0);
});

test('command instances retain independent echoes and actual echo damage has original command attribution', () => {
  const config = { initialResource: 0, selectedSkillIds: [77114, 76755] };
  const result = run(['"On Your Knees!"', '"We Shall Return!"', wait(3000)], config);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(state(result).commandEchoes, {});
  const echo = result.events.find((event) => event.name?.endsWith('Echo Damage'));
  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.ON_YOUR_KNEES);
  assert.equal(echo.activationId, action.activationId);
  assert.equal(echo.skillId, ID.ON_YOUR_KNEES);
  assert.equal(echo.actorType, 'player');
  close(echo.at, action.endsAt + 3);
  assert.equal(core(result).adrenaline, 12);
});

test('Feverish Pulse reduces other chants even when its Alacrity component is removed', () => {
  const patched = withPatchPreview(warriorProfession, {
    id: 'no-feverish-alacrity',
    label: 'No Alacrity',
    professions: {
      warrior: { balanceProfiles: { [TRAIT.FEVERISH_PULSE]: { removeEffects: [{ type: 'boon', all: true }] } } }
    }
  });
  const rotation = ['Chant of Action', 'Chant of Freedom'];
  const config = { patchId: 'no-feverish-alacrity' };
  const bare = run(rotation, config, patched);
  const trained = run(rotation, { ...config, selectedTraitIds: [TRAIT.FEVERISH_PULSE] }, patched);
  close(
    observedRuntime(bare).cooldownController.readyAt(ID.CHANT_OF_ACTION) -
      observedRuntime(trained).cooldownController.readyAt(ID.CHANT_OF_ACTION),
    1.6
  );
  assert.equal(
    observedRuntime(bare).cooldownController.readyAt(ID.CHANT_OF_FREEDOM),
    observedRuntime(trained).cooldownController.readyAt(ID.CHANT_OF_FREEDOM)
  );
  assert.equal(
    trained.events.some((event) => event.kind === 'alacrity'),
    false
  );
});

test('score and detailed execution retain the same live Motivation, echoes, and damage', () => {
  const config = { selectedSkillIds: [77114], selectedTraitIds: [TRAIT.CALL_TO_ACTION, TRAIT.BRISK_PACING] };
  const rotation = [combat, 'Chant of Action', '"On Your Knees!"', 'Eviscerate', wait(6000)];
  const detailed = run(rotation, config);
  const score = run(rotation, config, warriorProfession, 'score');
  close(score.totalDamage, detailed.totalDamage);
  assert.deepEqual(state(score), state(detailed));
});

test('Inspiring Implements composes with Core swap grants and respects its own exclusive cooldown', () => {
  const config = {
    initialResource: 0,
    alternatePrimaryWeapon: 'Sword',
    selectedTraitIds: [TRAIT.INSPIRING_IMPLEMENTS, TRAIT.VERSATILE_RAGE]
  };
  const first = run([combat, 'Swap Weapons'], config);
  assert.equal(state(first).motivation.value, 2);
  assert.equal(core(first).adrenaline, 10);
  assert.equal(first.planningState.activeWeaponSet, 2);
  const prefix = [combat, 'Swap Weapons', { type: 'cooldown-reset' }];
  assert.equal(state(run([...prefix, wait(4000), 'Swap Weapons'], config)).motivation.value, 2);
  assert.equal(state(run([...prefix, wait(4001), 'Swap Weapons'], config)).motivation.value, 4);
});

test('removed opening packets and disabled cadences retain chant state without queuing repeats', () => {
  const patched = withPatchPreview(warriorProfession, {
    id: 'silent-paragon',
    label: 'Silent Paragon',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.chants]: { removeEffects: [{ type: 'boon', all: true }] },
          [PROFILE.resources]: { fields: { pulseInterval: { from: 3, to: 0 } } },
          [PROFILE.commands]: { fields: { pulseInterval: { from: 3, to: 0 } } }
        }
      }
    }
  });
  const result = run(
    ['Chant of Action', '"We Shall Return!"', wait(10000)],
    {
      initialResource: 10,
      patchId: 'silent-paragon',
      selectedSkillIds: [76755]
    },
    patched
  );
  assert.equal(state(result).motivation.value, 4);
  assert.equal(state(result).activeRefrainId, ID.CHANT_OF_ACTION);
  assert.equal(core(result).adrenaline, 0);
  assert.deepEqual(state(result).commandEchoes, {});
  assert.equal(
    result.events.some((event) => event.type === 'buff'),
    false
  );
});

// One pulse isolates patchable tier scaling and boon duration from the chant's opening application.
test('Action refrain reads patched Might and Enduring Refrain values', () => {
  const source = withPatchPreview(warriorProfession, {
    id: 'refrain-values',
    label: 'Refrain values',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.refrain]: { effects: [{ type: 'boon', name: 'might', duration: { from: 8, to: 11 } }] },
          [TRAIT.ENDURING_REFRAIN]: { fields: { stackMultiplier: 3 } }
        }
      }
    }
  });
  const result = run(
    ['Chant of Action', wait(3000)],
    { patchId: 'refrain-values', selectedTraitIds: [TRAIT.ENDURING_REFRAIN] },
    source
  );
  const pulse = result.events.filter((event) => event.kind === 'might' && event.skillId === ID.CHANT_OF_ACTION).at(-1);
  assert.equal(pulse.stacks, 6);
  assert.equal(pulse.duration, 11);
});
