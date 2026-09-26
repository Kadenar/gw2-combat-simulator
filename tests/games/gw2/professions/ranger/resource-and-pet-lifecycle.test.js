import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { activeSoulbeastBuff } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { createLiveProfessionSimulator } from '#tests/helpers/live-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { runtimeFor } from '#tests/helpers/live-runtime.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

const config = {
  selectedPet: 'Tiger',
  selectedTraitIds: [],
  boons: {},
  primaryWeapon: 'Greatsword',
  initialArrows: 0,
  stats: { power: 2000, precision: 1000, ferocity: 0 },
  target: { armor: 2597, conditions: {} }
};
const simulate = createLiveProfessionSimulator(rangerProfession, config);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
// Seed only initial state; every gain, expiry, extension, and wait runs on the common queue.
const boon = (runtime, kind, at, duration, affectsSelf = true) =>
  runtime.emit({
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
  for (const waits of [[4000], [1000, 1000, 1000, 1000]]) {
    const result = runRanger(waits.map(wait), config, {
      initialize(runtime) {
        runtime.profession.core.endurance = 0;
        boon(runtime, 'vigor', 0, 1);
        boon(runtime, 'vigor', 0.5, 1);
        boon(runtime, 'vigor', 2, 20, false);
      }
    });
    close(runtimeFor(result).profession.core.endurance, 25);
    close(runtimeFor(result).endurance.readyAt(50), 9);
  }

  const results = [[4000], [1000, 1000, 2000]].map((waits) =>
    runRanger([ID.DODGE, ID.DODGE, ...waits.map(wait), ID.DODGE], config, {
      initialize(runtime) {
        boon(runtime, 'vigor', 0, 2);
      }
    })
  );
  results.forEach((result) => assert.deepEqual(result.warnings, []));
  assert.equal(results[0].steps.at(-1).start, results[1].steps.at(-1).start);
  close(runtimeFor(results[0]).profession.core.endurance, runtimeFor(results[1]).profession.core.endurance);
});

test('Ranger recovery rejects invalid profiles and uses each invocation profile', () => {
  const run = (rate) =>
    runRanger([wait(4000)], config, {
      extend: (native) => ({
        catalog: withProfile(native.catalog, PROFILE.resources, { enduranceRegenerationPerSecond: rate })
      }),
      initialize(runtime) {
        runtime.profession.core.endurance = 0;
      }
    });
  for (const invalid of [NaN, Infinity, undefined]) assert.throws(() => run(invalid), /Invalid balance data/);
  close(runtimeFor(run(5)).profession.core.endurance, 20);
  close(runtimeFor(run(4)).profession.core.endurance, 16);
});

test('Galeshot arrow regeneration ignores Alacrity gain and expiry across wait partitions', () => {
  for (const [at, duration] of [
    [3, 10],
    [0, 2]
  ]) {
    for (const waits of [[4900], [1000, 1000, 1000, 1900]]) {
      for (const [extra, value, nextAt] of [
        [0, 0, 5],
        [100, 1, 10],
        [5100, 2, 15]
      ]) {
        const result = runRanger(
          [...waits, extra].map(wait),
          { ...config, specialization: 'Galeshot' },
          {
            initialize(runtime) {
              boon(runtime, 'alacrity', at, duration);
            }
          }
        );
        const arrows = galeshotState.from(runtimeFor(result)).arrows;
        assert.equal(arrows.value, value);
        assert.equal(arrows.nextAt, nextAt);
      }
    }
  }
});

test('resource integration honors boon extensions and permanent boons', () => {
  const result = runRanger([wait(5000)], config, {
    initialize(runtime) {
      runtime.profession.core.endurance = 0;
      boon(runtime, 'vigor', 0, 2);
      runtime.emit({
        type: 'boon_extension',
        source: 'test',
        sourceId: 'extension',
        actorType: 'effect',
        at: 1,
        kind: 'vigor',
        duration: 2
      });
    }
  });
  close(runtimeFor(result).profession.core.endurance, 35);
  const permanent = runRanger(
    [wait(4000)],
    { ...config, boons: { vigor: true }, selectedTraitIds: [TRAIT.NATURAL_VIGOR] },
    {
      initialize(runtime) {
        runtime.profession.core.endurance = 0;
      }
    }
  );
  close(runtimeFor(permanent).profession.core.endurance, 35);
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

test('a swap retires a queued command before its pet can start it', () => {
  const result = runRanger(
    [ID.FURIOUS_POUNCE, ID.PET_SWAP, wait(12000)],
    {
      ...config,
      selectedPet: 'Tiger',
      selectedPet2: 'Pig'
    },
    {
      initialize(runtime) {
        // Reserve the pet lane past the swap; the player remains free to replace the pet immediately.
        runtime.profession.core.petAutoBusyUntil = 10;
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillId === ID.FURIOUS_POUNCE),
    false
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.FURIOUS_POUNCE),
    false
  );
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
