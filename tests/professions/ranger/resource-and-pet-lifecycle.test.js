import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { advanceRangerResources, rangerEnduranceReadyAt } from '#gw2/professions/ranger/core/mechanics/resources.js';
import { advanceGaleshotArrows } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { activeSoulbeastBuff } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const config = {
  selectedPet: 'Tiger',
  selectedTraitIds: [],
  boons: {},
  primaryWeapon: 'Greatsword',
  initialArrows: 0,
  stats: { power: 2000, precision: 1000, ferocity: 0 },
  target: { armor: 2597, conditions: {} }
};
const simulate = createProfessionSimulator(rangerProfession, config);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const schedulerFor = (overrides = {}) => {
  const options = { ...config, specialization: 'Core', ...overrides };
  return createScheduler({
    profession: rangerProfession,
    config: options,
    schedulerPolicy: createGw2SchedulerPolicy(options)
  });
};

const boon = (scheduler, kind, at, duration, affectsSelf = true) =>
  scheduler.context.emit({
    type: 'buff',
    source: 'test',
    sourceId: 'test-boon',
    actorType: 'effect',
    kind,
    at,
    duration,
    stacks: 1,
    audience: affectsSelf ? { recipients: 'self' } : { recipients: 'summons', affectsSelf: false, maximumRecipients: 1 }
  });

test('Ranger endurance and Dodge readiness are invariant under wait partitions', () => {
  // Two applications pool into two seconds of Vigor; a pet-only application cannot extend the player window.
  for (const partition of [[4], [1, 2, 3, 4]]) {
    const scheduler = schedulerFor();
    const state = scheduler.state.profession.core;
    state.endurance = 0;
    boon(scheduler, 'vigor', 0, 1);
    boon(scheduler, 'vigor', 0.5, 1);
    boon(scheduler, 'vigor', 2, 20, false);
    for (const at of partition) advanceRangerResources(scheduler.context, at);
    close(state.endurance, 25);
    close(rangerEnduranceReadyAt({ ...scheduler.context, start: 4 }, 50), 9);
  }

  const run = (waits) => {
    const scheduler = schedulerFor();
    boon(scheduler, 'vigor', 0, 2);
    return scheduler.run([ID.DODGE, ID.DODGE, ...waits.map(wait), ID.DODGE]);
  };

  const whole = run([4000]),
    split = run([1000, 1000, 2000]);
  assert.deepEqual(whole.warnings, []);
  assert.deepEqual(split.warnings, []);
  assert.equal(whole.steps.at(-1).start, split.steps.at(-1).start);
  close(whole.state.profession.core.endurance, split.state.profession.core.endurance);
});

test('Galeshot retains normalized partial recharge across Alacrity gain and expiry', () => {
  for (const [at, duration, before, ready] of [
    [3, 10, 4, 4.6],
    [0, 2, 4, 4.5]
  ]) {
    for (const partition of [[before], [1, 2, 3, before]]) {
      const scheduler = schedulerFor({ specialization: 'Galeshot' });
      boon(scheduler, 'alacrity', at, duration);
      const state = galeshotState.from(scheduler.context);
      for (const time of partition) advanceGaleshotArrows(scheduler.context, time);
      assert.equal(state.arrows, 0);
      advanceGaleshotArrows(scheduler.context, ready);
      assert.equal(state.arrows, 1);
      close(state.arrowRechargeProgress, 0);
    }
  }
});

test('resource integration honors boon extensions and configured permanent boons', () => {
  const scheduler = schedulerFor();
  scheduler.state.profession.core.endurance = 0;
  boon(scheduler, 'vigor', 0, 2);
  scheduler.context.emit({
    type: 'boon_extension',
    source: 'test',
    sourceId: 'extension',
    actorType: 'effect',
    at: 1,
    kind: 'vigor',
    duration: 2
  });
  advanceRangerResources(scheduler.context, 5);
  close(scheduler.state.profession.core.endurance, 35);
  const permanent = schedulerFor({ boons: { vigor: true }, selectedTraitIds: [TRAIT.NATURAL_VIGOR] });
  permanent.state.profession.core.endurance = 0;
  advanceRangerResources(permanent.context, 4);
  close(permanent.state.profession.core.endurance, 35);
});

test('personal stances ignore pet-only combat and trigger on the next player strike', () => {
  const prefix = [ID.LEAVE_BEASTMODE, ID.ONE_WOLF_PACK, ID.VULTURE_STANCE, { type: 'combat-start' }, wait(2500)];
  const petOnly = simulate('Soulbeast', prefix);
  const player = simulate('Soulbeast', [...prefix, ID.SLASH_ID_12474, wait(500)]);
  const procs = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        ['damage', 'condition'].includes(event.type) && [ID.ONE_WOLF_PACK, ID.VULTURE_STANCE].includes(event.skillId)
    );
  assert.ok(petOnly.resolvedEvents.some((event) => event.type === 'damage' && event.source === 'ranger-pet'));
  assert.deepEqual(procs(petOnly), []);
  assert.ok(procs(player).some((event) => event.skillId === ID.ONE_WOLF_PACK));
  assert.ok(procs(player).some((event) => event.skillId === ID.VULTURE_STANCE));
  assert.ok(procs(player).every((event) => event.triggeredBy === 'Slash'));
  assert.equal(
    activeSoulbeastBuff(
      {
        boons: new Map([
          ['vulture-stance', [{ at: 0, expiresAt: 10, stacks: 1, resolvedAudience: { includesSelf: false } }]]
        ])
      },
      'vulture-stance',
      1
    ),
    false
  );
});

test('modeled and unmodeled swaps preserve projectiles but interrupt unfinished melee attacks', () => {
  // Existing projectile effects retain their caster; swapping interrupts a Root Slap before its impact.
  for (const selectedPet2 of ['Tiger', 'Pig']) {
    for (const selectedPet of ['Carrion Devourer', 'Jacaranda']) {
      const result = simulate('Core', [{ type: 'combat-start' }, wait(500), ID.PET_SWAP, wait(2000)], {
        selectedPet,
        selectedPet2
      });
      assert.deepEqual(result.warnings, []);
      const outgoing = result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.summonOwner === 'ranger-pet:1:0' && event.at > 0.5
      );
      if (selectedPet === 'Carrion Devourer') {
        assert.ok(outgoing.some((event) => event.skillId === ID.TWIN_DARTS));
      } else {
        assert.deepEqual(outgoing, []);
      }

      const swap = result.events.find((event) => event.type === 'ranger.pet-swapped');
      assert.equal(swap.generation, 1);
      assert.equal(
        result.events.some(
          (event) =>
            event.type === 'action' &&
            event.autonomousPetSkill &&
            event.at > 0.5 &&
            event.summonOwner === 'ranger-pet:1:0'
        ),
        false
      );
    }
  }
});

test('persistent autonomous effects survive swaps with the outgoing pet identity and attributes', () => {
  // Call Lightning has launched before the swap; its remaining pulses belong to the outgoing Jacaranda.
  for (const selectedPet2 of ['Tiger', 'Pig']) {
    const result = simulate('Core', [{ type: 'combat-start' }, wait(2500), ID.PET_SWAP, wait(5000)], {
      selectedPet: 'Jacaranda',
      selectedPet2
    });
    assert.deepEqual(result.warnings, []);
    const lightning = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.JACARANDA_CALL_LIGHTNING
    );
    const before = lightning.find((event) => event.at < 2.5);
    const after = lightning.filter((event) => event.at > 2.5);
    assert.ok(before);
    assert.ok(after.length > 0);
    for (const event of after) {
      assert.equal(event.summonOwner, before.summonOwner);
      assert.equal(event.summonBasePower, before.summonBasePower);
    }

    assert.equal(
      result.events.some(
        (event) =>
          event.type === 'action' &&
          event.autonomousPetSkill &&
          event.at > 2.5 &&
          event.summonOwner === before.summonOwner
      ),
      false
    );
  }
});

test('a queued command that starts still lands, and already-started persistent pet effects survive swapping', () => {
  const queued = simulate('Core', [{ type: 'combat-start' }, ID.FURIOUS_POUNCE, wait(4000)]);
  assert.deepEqual(queued.warnings, []);
  assert.ok(queued.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.FURIOUS_POUNCE));
  const persistent = simulate('Core', [ID.JACARANDAS_EMBRACE, wait(1000), ID.PET_SWAP, wait(6000)], {
    selectedPet: 'Jacaranda',
    selectedPet2: 'Pig'
  });
  assert.deepEqual(persistent.warnings, []);
  const swappedAt = persistent.events.find((event) => event.type === 'ranger.pet-swapped').at;
  assert.ok(
    persistent.resolvedEvents.some(
      (event) => event.type === 'condition' && event.skillId === ID.JACARANDAS_EMBRACE && event.at > swappedAt
    )
  );
});
