import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/policy.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

import { advanceProfessionResources } from '#gw2/platform/combat/resources/resource-policy.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { activeSoulbeastBuff } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import {
  advanceProfessionEndurance,
  professionEnduranceReadyAt
} from '#gw2/platform/combat/resources/endurance-policy.js';

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
    for (const at of partition) advanceProfessionEndurance(scheduler.context, at);
    close(state.endurance, 25);
    close(professionEnduranceReadyAt({ ...scheduler.context, start: 4 }, 50), 9);
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

test('Ranger recovery rates reject invalid profiles and reread patched profiles between invocations', () => {
  // Missing or non-finite rates fail visibly; invocation-local rates must not survive a profile replacement.
  for (const invalid of [NaN, Infinity, undefined]) {
    const scheduler = schedulerFor({ selectedTraitIds: [TRAIT.NATURAL_VIGOR] });
    const profiles = new Map([
      [PROFILE.resources, { enduranceRegenerationPerSecond: invalid, vigorRegenerationMultiplier: 1.5 }],
      [PROFILE.naturalVigor, { vigorRegenerationMultiplier: 0.25 }]
    ]);
    const context = { ...scheduler.context, catalog: { balanceProfilesById: profiles } };
    assert.throws(() => professionEnduranceReadyAt({ ...context, start: 0 }, 30), /Invalid balance data/);
  }

  const scheduler = schedulerFor({ selectedTraitIds: [TRAIT.NATURAL_VIGOR] });
  const state = scheduler.state.profession.core;
  const profiles = new Map([
    [PROFILE.resources, { enduranceRegenerationPerSecond: 5, vigorRegenerationMultiplier: 1.5 }],
    [PROFILE.naturalVigor, { vigorRegenerationMultiplier: 0.25 }]
  ]);
  const context = { ...scheduler.context, catalog: { balanceProfilesById: profiles } };
  state.endurance = 0;
  boon(scheduler, 'vigor', 1, 2);
  close(professionEnduranceReadyAt({ ...context, start: 0 }, 30), 4);
  advanceProfessionEndurance(context, 4);
  close(state.endurance, 30);
  profiles.set(PROFILE.resources, { enduranceRegenerationPerSecond: 4, vigorRegenerationMultiplier: 2 });
  profiles.set(PROFILE.naturalVigor, { vigorRegenerationMultiplier: 0.5 });
  close(professionEnduranceReadyAt({ ...context, start: 4 }, 36), 5);
  advanceProfessionEndurance(context, 5);
  close(state.endurance, 36);
});

test('Galeshot arrow regeneration ignores Alacrity gain and expiry across wait partitions', () => {
  for (const [at, duration] of [
    [3, 10],
    [0, 2]
  ]) {
    for (const partition of [[4.9], [1, 2, 3, 4.9]]) {
      const scheduler = schedulerFor({ specialization: 'Galeshot' });
      boon(scheduler, 'alacrity', at, duration);
      const state = galeshotState.from(scheduler.context);
      for (const time of partition) advanceProfessionResources(scheduler.context, time);
      assert.equal(state.arrows.value, 0);
      assert.equal(state.arrows.nextAt, 5);
      advanceProfessionResources(scheduler.context, 5);
      assert.equal(state.arrows.value, 1);
      assert.equal(state.arrows.nextAt, 10);
      advanceProfessionResources(scheduler.context, 10);
      assert.equal(state.arrows.value, 2);
      assert.equal(state.arrows.nextAt, 15);
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
  advanceProfessionEndurance(scheduler.context, 5);
  close(scheduler.state.profession.core.endurance, 35);
  const permanent = schedulerFor({ boons: { vigor: true }, selectedTraitIds: [TRAIT.NATURAL_VIGOR] });
  permanent.state.profession.core.endurance = 0;
  advanceProfessionEndurance(permanent.context, 4);
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

test('pet swaps preserve committed projectiles but interrupt unfinished melee attacks', () => {
  // Autonomous projectiles commit when launched, while non-persistent melee packets leave with the outgoing pet.
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

test('committed autonomous effects survive swaps with the outgoing pet identity and attributes', () => {
  // Call Lightning commits on launch, so its remaining pulses belong to the outgoing Jacaranda.
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
