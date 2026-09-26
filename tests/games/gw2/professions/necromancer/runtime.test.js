import assert from 'node:assert/strict';
import test from 'node:test';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/hooks.js';
import { completeNecromancerMinion } from '#gw2/professions/necromancer/core/mechanics/minions.js';
import { addSoulShards } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { minionDefinitionForSkill } from '#gw2/professions/necromancer/core/mechanics/minion-profiles.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';

const base = {
  specialization: 'Reaper',
  initialResource: 0,
  stats: { power: 1000, precision: 1000, vitality: 1000 },
  target: { armor: 2597, health: 0, conditions: {} }
};
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const simulate = (rotation, config = base, extra = {}) =>
  observeGw2Runtime({ profession: necromancerProfession.runtimeFor(config), config, rotation, ...extra });

// Ordinary swaps change command legality, clear chains, and deliver destination equipment effects before the next input.
test('live weapon swaps commit the destination set and its sigils before subsequent commands', () => {
  const config = {
    ...base,
    primaryWeapon: 'Greatsword',
    weaponSet2Primary: 'Axe',
    weaponSet2Secondary: 'Focus',
    sigilSets: [{ names: [] }, { names: ['Doom', 'Doom'] }],
    transitionDelays: { weaponSwapMs: 120 }
  };
  const native = necromancerProfession.runtimeFor(config);
  const seen = [];
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.profession.core.autoattackChains[ID.DUSK_STRIKE] = ID.FADING_TWILIGHT;
    },
    onCastStart(runtime, cast) {
      native.onCastStart(runtime, cast);
      if (cast.skill.id === ID.GHASTLY_CLAWS)
        seen.push([runtime.activeWeaponSet, runtime.sigil.doomPending, runtime.time]);
    }
  };
  const result = simulate(
    [cast(ID.GHASTLY_CLAWS), cast(ID.SWAP_WEAPONS), cast(ID.GHASTLY_CLAWS), cast(ID.GRAVEDIGGER)],
    config,
    { profession, combatStartTime: 0 }
  );
  assert.equal(result.steps[0].invalid, true);
  assert.equal(result.steps.at(-1).invalid, true);
  assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings.every((warning) => warning.includes('required weapon is not equipped')));
  assert.deepEqual(seen, [[2, true, 0.12]]);
  assert.equal(result.planningState.activeWeaponSet, 2);
  assert.deepEqual(result.planningState.profession.autoattackChains, {});
  assert.equal(result.events.filter((event) => event.type === 'weapon_set').length, 1);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === 'sigil.doom').length,
    1
  );
});

test('live swap recharge is free before combat and reserves the relic-adjusted work during combat', () => {
  const rotation = [cast(ID.SWAP_WEAPONS), cast(ID.SWAP_WEAPONS)];
  const setup = simulate(rotation);
  assert.deepEqual(
    setup.steps.map((step) => step.start),
    [0, 0]
  );
  assert.equal(setup.planningState.activeWeaponSet, 1);
  const config = { ...base, relic: 'Warrior', boons: { alacrity: true } };
  const combat = simulate(rotation, config, { combatStartTime: 0 });
  assert.deepEqual(
    combat.steps.map((step) => step.start),
    [0, 7520]
  );
  assert.equal(observedRuntime(combat).cooldowns.get(ID.SWAP_WEAPONS), 15.02);
  assert.deepEqual(combat.warnings, []);
  const oneSwap = simulate([cast(ID.SWAP_WEAPONS)], { ...base, transitionDelays: { weaponSwapMs: 120 } });
  assert.equal(oneSwap.planningState.atSeconds, 0.12);
});

test('cancelled swaps retain the active set and form legality blocks ordinary swaps', () => {
  const native = necromancerProfession.runtimeFor(base);
  const skillsById = new Map(native.catalog.skillsById);
  skillsById.set(ID.SWAP_WEAPONS, { ...skillsById.get(ID.SWAP_WEAPONS), castTimeMs: 1000 });
  const profession = {
    ...native,
    catalog: { ...native.catalog, skillsById }
  };
  const cancelled = simulate([{ ...cast(ID.SWAP_WEAPONS), interruptAfterMs: 100 }], base, { profession });
  assert.equal(cancelled.planningState.activeWeaponSet, 1);
  assert.equal(
    cancelled.events.some((event) => event.type === 'weapon_set'),
    false
  );
  const transformed = simulate([cast(ID.LICH_FORM), cast(ID.SWAP_WEAPONS)]);
  assert.equal(transformed.planningState.activeWeaponSet, 1);
  assert.equal(transformed.steps.at(-1).invalid, true);
});

test('native live build eligibility rejects excluded skills and foreign specialization utilities', () => {
  const native = necromancerProfession.runtimeFor(base);
  const skillsById = new Map(native.catalog.skillsById);
  skillsById.set(ID.GHASTLY_CLAWS, { ...skillsById.get(ID.GHASTLY_CLAWS), simulatorExcluded: true });
  skillsById.set(ID.LICH_FORM, { ...skillsById.get(ID.LICH_FORM), specialization: 'Harbinger' });
  const profession = { ...native, catalog: { ...native.catalog, skillsById } };
  const result = simulate([cast(ID.LICH_FORM), cast(ID.GHASTLY_CLAWS)], base, { profession });
  assert.ok(result.steps.every((step) => step.invalid));
  assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings.every((warning) => warning.includes('unavailable for this build')));
});

// Temporary horrors appear at their own spawn boundary and retain an independent lifetime after the form ends.
test('Summon Madness creates staggered live creatures only after completion', () => {
  const cancelled = simulate([cast(ID.LICH_FORM), { ...cast(ID.SUMMON_MADNESS), interruptAfterMs: 40 }, wait(2000)]);
  assert.deepEqual(cancelled.planningState.profession.activeMinions, {});
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.skillId === ID.SUMMON_MADNESS),
    false
  );
  const first = simulate([cast(ID.LICH_FORM), cast(ID.SUMMON_MADNESS)]);
  assert.equal(Object.keys(first.planningState.profession.activeMinions).length, 1);
  const staggered = simulate([cast(ID.LICH_FORM), cast(ID.SUMMON_MADNESS), wait(1500)]);
  assert.equal(Object.keys(staggered.planningState.profession.activeMinions).length, 2);
  const hit = staggered.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.SUMMON_MADNESS);
  assert.equal(hit.actorType, 'summon');
  assert.ok(hit.damage > 0);
  assert.ok(hit.summonOwner);
  assert.deepEqual(staggered.warnings, []);
});

test('horrors retain their terminal attack after leaving Lich and clear their actual lifetimes', () => {
  const rotation = [wait(120), cast(ID.LICH_FORM), cast(ID.SUMMON_MADNESS), cast(ID.EXIT_LICH_FORM), wait(14000)];
  const result = simulate(rotation);
  assert.deepEqual(result.planningState.profession.activeMinions, {});
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Unstable Horror - Explosion')
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.sourceId === 'unstable-horror.0' && event.name === 'Unstable Horror - Explosion'
    )
  );
  assert.equal(simulate(rotation, base, { output: 'score' }).totalDamage, result.totalDamage);
  assert.deepEqual(result.warnings, []);
});

test('horror expiry survives explosion removal and rejects authored strikes beyond its lifetime', () => {
  const native = necromancerProfession.runtimeFor(base);
  const profession = {
    ...native,
    catalog: applySkillPatch(native.catalog, {
      skills: {
        [ID.SUMMON_MADNESS]: {
          removeEffects: [{ effectIndex: 1, type: 'strike' }],
          addEffects: [
            { type: 'strike', coefficient: 1, atMs: 7000, timingAnchor: 'castEnd', name: 'Expired horror strike' }
          ]
        }
      }
    })
  };
  const result = simulate([cast(ID.LICH_FORM), cast(ID.SUMMON_MADNESS), wait(14000)], base, { profession });
  assert.deepEqual(result.planningState.profession.activeMinions, {});
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.SUMMON_MADNESS));
  assert.equal(
    result.resolvedEvents.some(
      (event) => event.name === 'Expired horror strike' || event.name === 'Unstable Horror - Explosion'
    ),
    false
  );
});

test('repeated Summon Madness casts retain distinct creature owners', () => {
  const result = simulate([
    cast(ID.LICH_FORM),
    cast(ID.SUMMON_MADNESS),
    wait(1000),
    { type: 'cooldown-reset' },
    cast(ID.SUMMON_MADNESS),
    wait(1000)
  ]);
  const casts = result.steps.filter((step) => step.skillId === ID.SUMMON_MADNESS);
  const keys = Object.keys(result.planningState.profession.activeMinions);
  assert.equal(casts.length, 2);
  for (const cast of casts) assert.ok(keys.some((key) => key.includes(`:${cast.activationId}:`)));
  const firstHorrors = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === 'unstable-horror.0'
  );
  assert.equal(new Set(firstHorrors.map((event) => event.summonOwner)).size, 2);
  assert.deepEqual(result.warnings, []);
});

test('condition-only hands grant spendable life force at their accepted target application', () => {
  for (const skillId of [ID.SPECTRAL_GRASP, ID.SOUL_GRASP]) {
    const native = necromancerProfession.runtimeFor(base);
    const skill = native.catalog.skillsById.get(skillId);
    const landed = simulate([cast(skillId)]);
    assert.equal(landed.planningState.profession.lifeForce.value, skill.lifeForceGain);
    for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }])
      assert.equal(simulate([{ ...cast(skillId), ...flags }]).planningState.profession.lifeForce.value, 0);
    const profession = {
      ...native,
      catalog: applySkillPatch(native.catalog, {
        skills: {
          [skillId]: { removeEffects: [{ type: 'condition', effectIndex: 0, condition: skill.effects[0].condition }] }
        }
      })
    };
    assert.equal(simulate([cast(skillId)], base, { profession }).planningState.profession.lifeForce.value, 0);
    assert.deepEqual(simulate([cast(skillId), cast(ID.REAPERS_SHROUD)]).warnings, []);
  }
});

// A focused finisher case starts with its earlier chain steps already completed.
function withChainStep(config, skillId) {
  const native = necromancerProfession.runtimeFor(config);
  return {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      const position = native.catalog.autoattackChainPositions.get(skillId);
      if (position) runtime.profession.core.autoattackChains[position.root] = skillId;
    }
  };
}

test('live sword chains advance, complete, and expire at their exclusive continuation deadline', () => {
  const complete = simulate([cast(ID.ENERVATION_BLADE), cast(ID.ENERVATION_ECHO), cast(ID.DEATHLY_ENERVATION)]);
  assert.deepEqual(complete.warnings, []);
  assert.deepEqual(complete.planningState.profession.autoattackChains, {});
  const expired = simulate([cast(ID.ENERVATION_BLADE), wait(3000), cast(ID.ENERVATION_ECHO)]);
  assert.ok(expired.warnings.some((warning) => warning.includes('cast Enervation Blade first')));
  assert.deepEqual(expired.planningState.profession.autoattackChains, {});
  const active = simulate([cast(ID.ENERVATION_BLADE), wait(2960), cast(ID.ENERVATION_ECHO)]);
  assert.deepEqual(active.warnings, []);
  assert.equal(active.planningState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.DEATHLY_ENERVATION);
});

test('a later sword transition cancels the old expiry without extending a preserved continuation', () => {
  const refreshed = simulate([cast(ID.ENERVATION_BLADE), wait(2000), cast(ID.ENERVATION_ECHO), wait(600)]);
  assert.equal(refreshed.planningState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.DEATHLY_ENERVATION);
  const preserved = simulate([cast(ID.ENERVATION_BLADE), cast(ID.GHASTLY_CLAWS)]);
  assert.equal(preserved.planningState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.ENERVATION_ECHO);
  const expired = simulate([cast(ID.ENERVATION_BLADE), cast(ID.GHASTLY_CLAWS), wait(1600)]);
  assert.equal(expired.planningState.profession.autoattackChains[ID.ENERVATION_BLADE], undefined);
});

test('live Necromancer form transitions reset weapon chains while cancelled attacks preserve them', () => {
  const config = { ...base, initialResource: 100 };
  const transformed = simulate([cast(ID.ENERVATION_BLADE), cast(ID.REAPERS_SHROUD)], config);
  assert.equal(transformed.planningState.profession.autoattackChains[ID.ENERVATION_BLADE], undefined);
  const cancelled = simulate([cast(ID.ENERVATION_BLADE), { ...cast(ID.ENERVATION_ECHO), interruptAfterMs: 40 }]);
  assert.equal(cancelled.planningState.profession.autoattackChains[ID.ENERVATION_BLADE], ID.ENERVATION_ECHO);
  const ordinary = simulate([cast(ID.DUSK_STRIKE), cast(ID.GHASTLY_CLAWS)]);
  assert.equal(ordinary.planningState.profession.autoattackChains[ID.DUSK_STRIKE], undefined);
  const depleted = simulate([cast(ID.REAPERS_SHROUD), cast(ID.LIFE_REND), wait(6000)], {
    ...base,
    initialResource: 10
  });
  assert.equal(depleted.planningState.profession.activeShroud, '');
  assert.deepEqual(depleted.planningState.profession.autoattackChains, {});
  assert.deepEqual(depleted.warnings, []);
});

// Minimal live resource scenarios isolate spear state from saved-rotation aggregates.
test('spear shard gains require landed hits and refreshed grants survive their old expiry', () => {
  for (const skillId of [ID.DEADLY_SLICE, ID.SINISTER_STAB, ID.EXTIRPATE]) {
    const profession = withChainStep(base, skillId);
    assert.equal(
      simulate([cast(skillId)], base, { profession }).planningState.profession.soulShardGrant.charges,
      skillId === ID.EXTIRPATE ? 2 : 1
    );
    for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }])
      assert.equal(
        simulate([{ ...cast(skillId), ...flags }], base, { profession }).planningState.profession.soulShardGrant
          .charges,
        0
      );
  }

  const rotation = [cast(ID.EXTIRPATE), wait(8000), cast(ID.DARK_SLASH), cast(ID.DEADLY_SLICE), wait(2000)];
  assert.equal(simulate(rotation).planningState.profession.soulShardGrant.charges, 3);
  assert.equal(simulate([...rotation, wait(10000)]).planningState.profession.soulShardGrant.charges, 0);
});

test('Addle snapshots its activation gate but grants shards and defiance life force at impact', () => {
  const config = { ...base, target: { ...base.target, defiant: true } };
  const native = necromancerProfession.runtimeFor(config);
  const makeProfession = (initial, during) => ({
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      addSoulShards(runtime.profession.core, initial, runtime.time);
    },
    onCastStart(runtime, cast) {
      native.onCastStart(runtime, cast);
      if (cast.skill.id === ID.ADDLE) runtime.schedule('test.shards', cast.start + (cast.fullEnd - cast.start) / 2);
    },
    tasks: {
      ...native.tasks,
      'test.shards'(runtime) {
        if (during) addSoulShards(runtime.profession.core, during, runtime.time);
        else runtime.profession.core.soulShardGrant.charges = 0;
      }
    }
  });
  const gained = simulate([cast(ID.ADDLE)], config, { profession: makeProfession(0, 3) });
  assert.equal(
    gained.resolvedEvents.some((event) => event.condition === 'Immobilized'),
    false
  );
  assert.equal(gained.planningState.profession.lifeForce.value, 20);
  assert.equal(gained.planningState.profession.soulShardGrant.charges, 6);
  const spent = simulate([cast(ID.ADDLE)], config, { profession: makeProfession(3, 0) });
  assert.ok(spent.resolvedEvents.some((event) => event.condition === 'Immobilized'));
  assert.equal(spent.planningState.profession.soulShardGrant.charges, 4);
  const missed = simulate([{ ...cast(ID.ADDLE), offTarget: true }], config);
  assert.equal(missed.planningState.profession.soulShardGrant.charges, 0);
  assert.equal(missed.planningState.profession.lifeForce.value, 0);
});

test('Perforate consumes current shards per accepted packet, including gains during the channel', () => {
  const native = necromancerProfession.runtimeFor(base);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      addSoulShards(runtime.profession.core, 1, runtime.time);
    },
    onCastStart(runtime, cast) {
      native.onCastStart(runtime, cast);
      if (cast.skill.id === ID.PERFORATE)
        runtime.schedule('test.shard', cast.start + (cast.fullEnd - cast.start) * 0.7);
    },
    tasks: {
      ...native.tasks,
      'test.shard'(runtime) {
        addSoulShards(runtime.profession.core, 1, runtime.time);
      }
    }
  };
  const result = simulate([cast(ID.PERFORATE)], base, { profession });
  assert.equal(result.planningState.profession.soulShardGrant.charges, 0);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.SOUL_SHARDS).length,
    2
  );
  const missed = simulate([{ ...cast(ID.PERFORATE), offTarget: true }], base, { profession });
  assert.equal(missed.planningState.profession.soulShardGrant.charges, 2);
  const removed = {
    ...profession,
    catalog: applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: { [PROFILE.soulShards]: { removeEffects: [{ type: 'strike', name: 'Soul Shards' }] } }
    })
  };
  const noSiphon = simulate([cast(ID.PERFORATE)], base, { profession: removed });
  assert.equal(noSiphon.planningState.profession.soulShardGrant.charges, 0);
  assert.equal(
    noSiphon.resolvedEvents.some((event) => event.skillId === ID.SOUL_SHARDS),
    false
  );
  assert.equal(simulate([cast(ID.PERFORATE)], base, { profession, output: 'score' }).totalDamage, result.totalDamage);
});

test('Distress consumes its flip, refreshes Perforate, and grants the single-target shard allowance', () => {
  const result = simulate([cast(ID.PERFORATE), cast(ID.ISOLATE), cast(ID.DISTRESS)]);
  assert.equal(result.planningState.profession.soulShardGrant.charges, 6);
  assert.equal(observedRuntime(result).cooldowns.has(ID.PERFORATE), false);
  assert.equal(result.planningState.profession.availableFlips[ID.DISTRESS], undefined);
  assert.deepEqual(result.warnings, []);
});

test('Soul Marks grants only on accepted mark impacts', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.SOUL_MARKS] };
  const native = necromancerProfession.runtimeFor(config);
  const amount = native.catalog.balanceProfilesById.get(TRAIT.SOUL_MARKS).lifeForceGain;
  assert.equal(simulate([cast(ID.REAPERS_MARK)], config).planningState.profession.lifeForce.value, amount);
  for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }])
    assert.equal(
      simulate([{ ...cast(ID.REAPERS_MARK), ...flags }], config).planningState.profession.lifeForce.value,
      0
    );
});

test('axe half-health bonuses use the crossing impact and the burst keeps its delayed boundary', () => {
  const config = { ...base, target: { ...base.target, health: 100000, startingHealthFraction: 0.6 } };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.emit({
        type: 'damage',
        at: 0.1,
        source: 'necromancer',
        sourceId: ID.UNHOLY_FEAST,
        skillId: ID.UNHOLY_FEAST,
        skillName: 'Unholy Feast',
        actorType: 'player',
        coefficient: 1,
        flatDamage: 11000,
        activationId: 'test.crossing'
      });
    }
  };
  const early = simulate([wait(200)], config, { profession });
  assert.equal(
    early.resolvedEvents.some((event) => event.skillId === ID.UNHOLY_BURST),
    false
  );
  const late = simulate([wait(1000)], config, { profession });
  assert.ok(late.resolvedEvents.some((event) => event.skillId === ID.UNHOLY_BURST));
  const high = simulate([cast(ID.RENDING_CLAWS)], config);
  const low = simulate([cast(ID.RENDING_CLAWS)], {
    ...config,
    target: { ...config.target, startingHealthFraction: 0.49 }
  });
  const vulnerability = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.condition === 'Vulnerability')
      .reduce((sum, event) => sum + event.stacks, 0);
  assert.equal(vulnerability(low), 2 * vulnerability(high));
});

test('Oppressive Collapse observes conditions when its impact arrives and misses grant no Might', () => {
  const config = { ...base, target: { ...base.target, conditions: { Bleeding: 1, Poisoned: 1 } } };
  const command = { ...cast(ID.OPPRESSIVE_COLLAPSE), impactDelayMs: 1000 };
  const pending = simulate([command], config);
  assert.equal(
    pending.resolvedEvents.some((event) => event.kind === 'might'),
    false
  );
  const landed = simulate([command, wait(1100)], config);
  assert.equal(landed.resolvedEvents.find((event) => event.kind === 'might').stacks, 4);
  assert.equal(
    simulate([{ ...cast(ID.OPPRESSIVE_COLLAPSE), offTarget: true }], config).resolvedEvents.some(
      (event) => event.kind === 'might'
    ),
    false
  );
});

test('Augury of Death requires shout completion and survives removal of the shout strike', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.AUGURY_OF_DEATH] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applySkillPatch(native.catalog, {
      skills: { [ID.NOTHING_CAN_SAVE_YOU]: { removeEffects: [{ type: 'strike', effectIndex: 0 }] } }
    })
  };
  const result = simulate([cast(ID.NOTHING_CAN_SAVE_YOU)], config, { profession });
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.AUGURY_OF_DEATH));
  const cancelled = simulate([{ ...cast(ID.NOTHING_CAN_SAVE_YOU), interruptAfterMs: 40 }], config, { profession });
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.sourceId === TRAIT.AUGURY_OF_DEATH),
    false
  );
});

// Seed actual applications to isolate transfer selection from unrelated weapon and corruption behavior.
function withSelfConditions(config, applications, armed = false) {
  const native = necromancerProfession.runtimeFor(config);
  return {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.profession.core.selfConditions = applications.map((application) => ({
        stacks: 1,
        appliedAt: 0,
        expiresAt: 10,
        sourceSkillId: ID.BLOOD_IS_POWER,
        sourceSkillName: 'Blood Is Power',
        ...application
      }));
      runtime.profession.core.plagueSendingArmed = armed;
    }
  };
}

test('live corruption excludes Expertise from self durations and expires the actual applications', () => {
  const config = { ...base, stats: { ...base.stats, expertise: 1500 }, selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION] };
  const rotation = [cast(ID.BLOOD_IS_POWER)];
  const result = simulate(rotation, config);
  const applications = result.planningState.profession.selfConditions;
  assert.deepEqual(
    applications.map((application) => application.condition),
    ['Bleeding', 'Torment']
  );
  for (const application of applications) assert.equal(application.expiresAt - application.appliedAt, 10);
  assert.equal(result.events.filter((event) => event.type === 'self_condition').length, 2);
  assert.deepEqual(simulate([...rotation, wait(10000)], config).planningState.profession.selfConditions, []);
  assert.deepEqual(result.warnings, []);
});

test('ordinary transfers move all applications of the oldest distinct types with remaining duration', () => {
  const profession = withSelfConditions(base, [
    { condition: 'Bleeding' },
    { condition: 'Poisoned' },
    { condition: 'Bleeding', stacks: 2 },
    { condition: 'Torment' }
  ]);
  const result = simulate([cast(ID.DEATHLY_SWARM)], base, { profession });
  assert.deepEqual(
    result.planningState.profession.selfConditions.map((application) => application.condition),
    ['Torment']
  );
  const moved = result.resolvedEvents.filter((event) => event.type === 'condition' && event.transferredCondition);
  assert.deepEqual(
    moved.map((event) => event.condition),
    ['Bleeding', 'Poisoned', 'Bleeding']
  );
  for (const event of moved) {
    assert.equal(event.fixedDuration, true);
    assert.equal(event.duration + event.at, 10);
  }

  for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }]) {
    const missed = simulate([{ ...cast(ID.DEATHLY_SWARM), ...flags }], base, { profession });
    assert.equal(missed.planningState.profession.selfConditions.length, 4);
  }
});

test('first-hit self conditions follow accepted impacts and are not repeated by channel pulses', () => {
  for (const skillId of [ID.LIFE_SIPHON, ID.DARK_PACT]) {
    const landed = simulate([cast(skillId), wait(2000)]);
    assert.equal(landed.events.filter((event) => event.type === 'self_condition').length, 1);
    assert.equal(landed.planningState.profession.selfConditions.length, 1);
    for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }]) {
      const missed = simulate([{ ...cast(skillId), ...flags }, wait(2000)]);
      assert.deepEqual(missed.planningState.profession.selfConditions, []);
    }
  }
});

test('corruption boons use the current minion recipients without triggering an armed transfer', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.PLAGUE_SENDING] };
  const profession = withSelfConditions(config, [{ condition: 'Poisoned' }], true);
  const result = simulate([cast(ID.SUMMON_BONE_MINIONS), { ...cast(ID.BLOOD_IS_POWER), offTarget: true }], config, {
    profession
  });
  const boon = result.resolvedEvents.find((event) => event.type === 'buff' && event.sourceId === ID.BLOOD_IS_POWER);
  assert.deepEqual(boon.resolvedAudience.companionIds, ['minion:bone-minion:0', 'minion:bone-minion:1']);
  assert.equal(observedRuntime(result).profession.core.plagueSendingArmed, true);
  assert.deepEqual(
    result.planningState.profession.selfConditions.map((application) => application.condition),
    ['Poisoned', 'Bleeding']
  );
});

test('Plague Sending waits for an accepted strike and consumes the newest applications once', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.PLAGUE_SENDING] };
  const profession = withSelfConditions(
    config,
    [{ condition: 'Bleeding' }, { condition: 'Poisoned' }, { condition: 'Torment' }],
    true
  );
  const missed = simulate([{ ...cast(ID.RENDING_CLAWS), offTarget: true }], config, { profession });
  assert.equal(observedRuntime(missed).profession.core.plagueSendingArmed, true);
  assert.equal(missed.planningState.profession.selfConditions.length, 3);
  const landed = simulate([cast(ID.RENDING_CLAWS), cast(ID.RENDING_CLAWS)], config, { profession });
  assert.equal(observedRuntime(landed).profession.core.plagueSendingArmed, false);
  assert.deepEqual(
    landed.planningState.profession.selfConditions.map((application) => application.condition),
    ['Bleeding']
  );
  assert.equal(
    landed.resolvedEvents.filter((event) => event.type === 'condition' && event.transferredCondition).length,
    2
  );
});

test('strike-less transfers consume state only when their delayed target application can execute', () => {
  const profession = withSelfConditions(base, [{ condition: 'Bleeding' }]);
  const command = { ...cast(ID.PLAGUE_SIGNET), impactDelayMs: 1000 };
  const pending = simulate([command], base, { profession });
  assert.equal(pending.planningState.profession.selfConditions.length, 1);
  const landed = simulate([command, wait(1100)], base, { profession });
  assert.deepEqual(landed.planningState.profession.selfConditions, []);
  const missed = simulate([{ ...cast(ID.PLAGUE_SIGNET), offTarget: true }, wait(1100)], base, { profession });
  assert.equal(missed.planningState.profession.selfConditions.length, 1);
  const removed = {
    ...profession,
    catalog: applySkillPatch(profession.catalog, {
      skills: { [ID.DEATHLY_SWARM]: { removeEffects: [{ type: 'strike', effectIndex: 0 }] } }
    })
  };
  const noHit = simulate([cast(ID.DEATHLY_SWARM)], base, { profession: removed });
  assert.equal(noHit.planningState.profession.selfConditions.length, 1);
});

test('condition-based life force belongs to a landed impact and Devouring counts before its own Torment', () => {
  for (const skillId of [ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS]) {
    const config = {
      ...base,
      selectedTraitIds: skillId === ID.DEVOURING_DARKNESS ? [TRAIT.LINGERING_CURSE] : [],
      target: { ...base.target, conditions: { Bleeding: 1, Poisoned: 1 } }
    };
    const result = simulate([cast(skillId)], config);
    assert.equal(result.planningState.profession.lifeForce.value, 10);
    if (skillId === ID.DEVOURING_DARKNESS)
      assert.equal(
        result.resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Torment').stacks,
        2
      );
    for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }])
      assert.equal(simulate([{ ...cast(skillId), ...flags }], config).planningState.profession.lifeForce.value, 0);
  }
});

test('Devouring observes a condition arriving during travel and its condition survives strike removal', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.LINGERING_CURSE] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.emit({
        type: 'condition',
        at: 0.8,
        source: 'test',
        sourceId: 'test.condition',
        actorType: 'player',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5
      });
    }
  };
  const rotation = [{ ...cast(ID.DEVOURING_DARKNESS), impactDelayMs: 1000 }, wait(1100)];
  const landed = simulate(rotation, config, { profession });
  assert.equal(landed.planningState.profession.lifeForce.value, 9);
  assert.equal(
    landed.resolvedEvents.find((event) => event.skillId === ID.DEVOURING_DARKNESS && event.type === 'condition').stacks,
    1
  );
  const removed = {
    ...profession,
    catalog: applySkillPatch(native.catalog, {
      skills: { [ID.DEVOURING_DARKNESS]: { removeEffects: [{ type: 'strike', effectIndex: 0 }] } }
    })
  };
  const result = simulate(rotation, config, { profession: removed });
  assert.equal(result.planningState.profession.lifeForce.value, 0);
  assert.ok(
    result.resolvedEvents.some((event) => event.skillId === ID.DEVOURING_DARKNESS && event.type === 'condition')
  );
});

// Real catalog casts prove the live resource path without importing any predicted gain or feedback fixture.
test('landed Ghastly Claws funds shroud entry in one native runtime', () => {
  const rotation = [cast(ID.GHASTLY_CLAWS), cast(ID.REAPERS_SHROUD)];
  const result = simulate(rotation);
  assert.equal(result.planningState.profession.lifeForce.value, 12);
  assert.equal(result.planningState.profession.activeShroud, 'reaper');
  assert.deepEqual(result.warnings, []);
  const score = simulate(rotation, base, { output: 'score' });
  assert.equal(score.totalDamage, result.totalDamage);
  assert.equal(score.rotationEndTime, result.rotationEndTime);
});

test('missed and late Ghastly Claws packets cannot fund shroud entry', () => {
  for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }]) {
    const result = simulate([{ ...cast(ID.GHASTLY_CLAWS), ...flags }, cast(ID.REAPERS_SHROUD)]);
    assert.equal(result.planningState.profession.lifeForce.value, 0);
    assert.equal(result.planningState.profession.activeShroud, '');
    assert.ok(result.warnings.some((warning) => warning.includes('life force')));
  }
});

test('the crossing strike grants Spiteful Fortitude and later dead-target packets do not', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE], target: { ...base.target, health: 100 } };
  const native = necromancerProfession.runtimeFor(config);
  const values = [];
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      for (const [index, flatDamage] of [30, 30, 40, 50].entries())
        runtime.emit({
          type: 'damage',
          at: 0.1,
          source: 'necromancer',
          sourceId: ID.RENDING_CLAWS,
          skillId: ID.RENDING_CLAWS,
          skillName: 'Rending Claws',
          actorType: 'player',
          activationId: `hit:${index}`,
          coefficient: 1,
          flatDamage,
          canCrit: false
        });
    },
    reactions: {
      ...native.reactions,
      'damage.resolved'(runtime, event, details) {
        native.reactions['damage.resolved'](runtime, event, details);
        values.push(runtime.resourceController.value('lifeForce'));
      }
    }
  };
  const result = simulate([wait(500)], config, { profession });
  assert.deepEqual(values, [0, 1, 2]);
  assert.equal(result.planningState.profession.lifeForce.value, 2);
});

test('Gravedigger completion uses actual target health to determine the next cast', () => {
  const rotation = [cast(ID.GRAVEDIGGER), cast(ID.GRAVEDIGGER)];
  const high = simulate(rotation, { ...base, target: { ...base.target, health: 1000000 } });
  const low = simulate(rotation, {
    ...base,
    target: { ...base.target, health: 1000000, startingHealthFraction: 0.49 }
  });
  assert.ok(low.steps[1].start < high.steps[1].start);
  assert.equal(low.steps[1].start, low.steps[0].end);
});

// A committed strike retains its reset decision through animation cancellation, using health at the retained boundary.
test('Gravedigger retains its health-gated recharge reset after a committed interruption', () => {
  const config = { ...base, target: { ...base.target, health: 1000000 } };
  const native = necromancerProfession.runtimeFor(config);
  const skill = native.catalog.skillsById.get(ID.GRAVEDIGGER);
  for (const [committed, offTarget, resets] of [
    [true, false, true],
    [true, true, false],
    [false, false, false]
  ]) {
    const duringLockout = [];
    const profession = {
      ...native,
      onCastStart(runtime, current) {
        native.onCastStart(runtime, current);
        const at = (current.effectiveEnd + current.fullEnd) / 2;
        runtime.schedule('inspect-recharge', at);
        runtime.emit({
          type: 'damage',
          at,
          source: 'fixture',
          sourceId: 'threshold-crossing',
          actorType: 'player',
          coefficient: 1,
          flatDamage: 600000,
          canCrit: false,
          offTarget
        });
      },
      tasks: {
        ...native.tasks,
        'inspect-recharge'(runtime) {
          duringLockout.push(runtime.cooldowns.has(ID.GRAVEDIGGER));
        }
      }
    };
    const result = simulate(
      [
        {
          ...cast(ID.GRAVEDIGGER),
          interruptAfterMs: committed ? (skill.interruptCommitMs + skill.castTimeMs) / 2 : skill.interruptCommitMs / 2
        },
        wait(skill.castTimeMs)
      ],
      config,
      { profession }
    );
    assert.deepEqual(duringLockout, [true]);
    assert.equal(observedRuntime(result).cooldowns.has(ID.GRAVEDIGGER), !resets);
    assert.deepEqual(result.warnings, []);
  }
});

test('a life-force grant replaces depletion and reset restores the same live pool', () => {
  const config = { ...base, initialResource: 10 };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.schedule('grant', 1);
    },
    tasks: {
      ...native.tasks,
      grant(runtime) {
        grantNecromancerLifeForce(runtime, 10);
      }
    }
  };
  const during = simulate([cast(ID.REAPERS_SHROUD), wait(2500)], config, { profession });
  assert.equal(during.planningState.profession.activeShroud, 'reaper');
  const after = simulate([cast(ID.REAPERS_SHROUD), wait(6000), { type: 'cooldown-reset' }], config, { profession });
  assert.equal(after.planningState.profession.activeShroud, '');
  assert.equal(after.planningState.profession.lifeForce.value, 100);
});

// Expiry owns its earlier priority even when a same-time passive grant was enqueued first.
test('shroud depletion precedes a simultaneous life-force refill', () => {
  const config = { ...base, initialResource: 10 };
  const native = necromancerProfession.runtimeFor(config);
  const entry = native.catalog.skillsById.get(ID.REAPERS_SHROUD);
  const drain = native.catalog.balanceProfilesById.get(entry.shroudProfileId).lifeForceDrain;
  const at = Math.ceil(10 / drain / 0.04) * 0.04;
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.schedule('refill', at);
    },
    tasks: {
      ...native.tasks,
      refill(runtime) {
        grantNecromancerLifeForce(runtime, 10);
      }
    }
  };
  const result = simulate([cast(ID.REAPERS_SHROUD), wait(at * 1000)], config, { profession });
  assert.equal(result.planningState.profession.activeShroud, '');
  assert.equal(result.planningState.profession.lifeForce.value, 10);
});

// Minimal summon sequences exercise lifetime and recharge ownership without using saved rotations.
test('an interrupted summon creates neither a minion nor a usable command', () => {
  const result = simulate([
    { ...cast(ID.SUMMON_BONE_MINIONS), interruptAfterMs: 40 },
    cast(ID.PUTRID_EXPLOSION),
    wait(4000)
  ]);
  assert.deepEqual(result.planningState.profession.activeMinions, {});
  assert.ok(result.warnings.some((warning) => warning.includes('not alive')));
  assert.equal(result.totalDamage, 0);
});

test('consumption cancels only the removed creature and starts summon recharge at the last death', () => {
  const one = simulate([cast(ID.SUMMON_BONE_MINIONS), cast(ID.PUTRID_EXPLOSION), wait(5000)]);
  assert.equal(one.planningState.profession.activeMinions['bone-minion'], 1);
  const autonomous = one.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.SUMMON_BONE_MINIONS
  );
  assert.ok(autonomous.length > 0);
  assert.ok(autonomous.every((event) => event.summonOwner === 'minion:bone-minion:0'));
  assert.equal(
    one.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.PUTRID_EXPLOSION).summonOwner,
    'minion:bone-minion:1'
  );
  const result = simulate([
    cast(ID.SUMMON_BONE_MINIONS),
    cast(ID.PUTRID_EXPLOSION),
    cast(ID.PUTRID_EXPLOSION),
    wait(5000)
  ]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.planningState.profession.activeMinions, {});
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.SUMMON_BONE_MINIONS),
    false
  );
  const native = necromancerProfession.runtimeFor(base);
  const recharge = native.catalog.skillsById.get(ID.SUMMON_BONE_MINIONS).cooldown;
  const deathAt = result.steps.findLast((step) => step.skillId != null).end / 1000;
  assert.equal(observedRuntime(result).cooldowns.get(ID.SUMMON_BONE_MINIONS), deathAt + recharge);
  assert.equal(observedRuntime(one).cooldowns.has(ID.SUMMON_BONE_MINIONS), false);
});

test('an active death-gated minion cannot be replaced by recasting after a cooldown reset', () => {
  const result = simulate([cast(ID.SUMMON_SHADOW_FIEND), { type: 'cooldown-reset' }, cast(ID.SUMMON_SHADOW_FIEND)]);
  assert.equal(observedRuntime(result).profession.core.minionGenerations['shadow-fiend'], 1);
  assert.ok(result.warnings.some((warning) => warning.includes('still alive')));
});

test('Haunt grants life force once at its accepted impact, with no off-target or late grant', () => {
  for (const [command, durationMs, expected] of [
    [cast(ID.HAUNT), 2500, 10],
    [{ ...cast(ID.HAUNT), offTarget: true }, 2500, 0],
    [cast(ID.HAUNT), 1000, 0]
  ]) {
    const result = simulate([cast(ID.SUMMON_SHADOW_FIEND), command, wait(durationMs)]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.lifeForce.value, expected);
  }
});

test('a replacement generation cancels the old autonomous clock and pending Haunt', () => {
  const native = necromancerProfession.runtimeFor(base);
  let original;
  const profession = {
    ...native,
    onCastComplete(runtime, completed) {
      native.onCastComplete(runtime, completed);
      if (completed.skill.id === ID.SUMMON_SHADOW_FIEND) {
        original = completed;
        runtime.schedule('replace-minion', runtime.time + 1);
      }
    },
    tasks: {
      ...native.tasks,
      'replace-minion'(runtime) {
        // An actual replacement completion invalidates the previous creature's already queued work.
        completeNecromancerMinion(runtime, {
          ...original,
          id: 'replacement',
          start: runtime.time,
          fullEnd: runtime.time,
          effectiveEnd: runtime.time
        });
      }
    }
  };
  const result = simulate([cast(ID.SUMMON_SHADOW_FIEND), cast(ID.HAUNT), wait(9000)], base, { profession });
  assert.equal(observedRuntime(result).profession.core.minionGenerations['shadow-fiend'], 2);
  assert.equal(result.planningState.profession.lifeForce.value, 0);
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage');
  assert.ok(strikes.length > 0);
  assert.ok(strikes.every((event) => event.activationId.startsWith('replacement:')));
});

test('ordinary minion projectiles do not inherit the alternate cycle condition', () => {
  const native = necromancerProfession.runtimeFor(base);
  const definition = minionDefinitionForSkill(native, ID.SUMMON_BONE_FIEND);
  assert.ok(definition.attacks.every((attack) => attack.condition === undefined));
  assert.ok(definition.alternateAttacks.every((attack) => attack.condition[0] === 'Crippled'));
});

test('a Reaper summon projectile owns exactly one shared combo attempt', () => {
  const native = necromancerProfession.runtimeFor(base);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.emit({
        type: 'combo_field',
        ownerActorType: 'player',
        at: 0,
        source: 'necromancer',
        sourceId: 'field',
        actorType: 'player',
        fieldId: 'field',
        fieldType: 'Ice',
        expiresAt: 1,
        ownerId: 'necromancer'
      });
      runtime.emit({
        type: 'damage',
        at: 0.1,
        source: 'Minion',
        sourceId: 3633,
        skillId: 3633,
        actorType: 'summon',
        coefficient: 0.1,
        weaponStrength: 1048,
        canCrit: false,
        activationId: 'projectile',
        comboFinishers: [{ ownerId: 'necromancer', finisherType: 'Projectile', chance: 1 }]
      });
    }
  };
  const result = simulate([wait(500)], base, { profession });
  assert.equal(result.events.filter((event) => event.type === 'combo_finisher').length, 1);
  assert.equal(result.events.filter((event) => event.type === 'combo').length, 1);
  assert.deepEqual(result.warnings, []);
});

// Entry uses one live stack collection: existing stacks fund life force before entry grants or cleansing add more.
test('shroud entry reads existing Carapace, then grants stacks and removes active self-conditions', () => {
  const config = {
    ...base,
    initialResource: 10,
    selectedTraitIds: [
      TRAIT.SOUL_COMPREHENSION,
      TRAIT.FLESH_OF_THE_MASTER,
      TRAIT.ARMORED_SHROUD,
      TRAIT.SHROUDED_REMOVAL,
      TRAIT.PLAGUE_SENDING
    ]
  };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.profession.core.carapaceExpiries = [0, 10, 10];
      runtime.profession.core.selfConditions = [
        { condition: 'Weakness', stacks: 1, appliedAt: 0, expiresAt: 0.1 },
        { condition: 'Bleeding', stacks: 1, appliedAt: 0, expiresAt: 10 },
        { condition: 'Poisoned', stacks: 1, appliedAt: 0, expiresAt: 10 }
      ];
    }
  };
  const result = simulate([cast(ID.SUMMON_BONE_MINIONS), cast(ID.REAPERS_SHROUD)], config, { profession });
  const state = result.planningState.profession;
  assert.equal(state.lifeForce.value, 13);
  assert.equal(state.carapaceExpiries.length, 10);
  assert.deepEqual(
    state.selfConditions.map((application) => application.condition),
    ['Poisoned']
  );
  assert.equal(observedRuntime(result).profession.core.plagueSendingArmed, true);
  assert.deepEqual(result.warnings, []);
});

test('automatic shroud depletion refreshes Soul Barbs and starts entry recharge at the transition', () => {
  const config = { ...base, initialResource: 10, selectedTraitIds: [TRAIT.SOUL_BARBS] };
  const result = simulate([cast(ID.REAPERS_SHROUD), wait(4000)], config);
  const grants = result.events.filter((event) => event.type === 'buff' && event.kind === 'necromancer-soul-barbs');
  const exit = result.events.find(
    (event) => event.type === 'weapon_set' && event.sourceId === 'necromancer.shroud-exit'
  );
  assert.equal(grants.length, 2);
  assert.equal(grants[1].at, exit.at);
  assert.equal(observedRuntime(result).cooldowns.get(ID.REAPERS_SHROUD), exit.at + 10);
});

test('Lich expiry owns an exact deadline and never invokes life-force shroud entry traits', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.SOUL_BARBS, TRAIT.ARMORED_SHROUD] };
  const during = simulate([cast(ID.LICH_FORM), wait(19960)], config);
  assert.equal(during.planningState.profession.activeShroud, 'lich');
  assert.equal(during.planningState.profession.lifeForce.value, 0);
  const ended = simulate([cast(ID.LICH_FORM), wait(20000)], config);
  assert.equal(ended.planningState.profession.activeShroud, '');
  assert.equal(ended.planningState.profession.lifeForce.value, 15);
  assert.equal(ended.planningState.profession.availableFlips[ID.EXIT_LICH_FORM], undefined);
  assert.deepEqual(ended.planningState.profession.carapaceExpiries, []);
  assert.equal(
    ended.events.some((event) => event.kind === 'necromancer-soul-barbs'),
    false
  );
});

test('manual Lich exit cancels its old deadline before a replacement form begins', () => {
  const native = necromancerProfession.runtimeFor(base);
  const profession = {
    ...native,
    onCastComplete(runtime, completed) {
      native.onCastComplete(runtime, completed);
      if (completed.skill.id === ID.EXIT_LICH_FORM) runtime.cooldownController.clear(ID.LICH_FORM);
    }
  };
  const result = simulate(
    [cast(ID.LICH_FORM), wait(1000), cast(ID.EXIT_LICH_FORM), cast(ID.LICH_FORM), wait(19000)],
    base,
    { profession }
  );
  assert.equal(result.planningState.profession.activeShroud, 'lich');
  assert.equal(result.planningState.profession.lifeForce.value, 15);
  assert.deepEqual(result.warnings, []);
});

test('Lich bar skills require the live form and ordinary skills remain unavailable inside it', () => {
  const blocked = simulate([cast(ID.DEATHLY_CLAWS)]);
  assert.ok(blocked.warnings.some((warning) => warning.includes('Lich Form')));
  const result = simulate([
    cast(ID.LICH_FORM),
    cast(ID.DEATHLY_CLAWS),
    cast(ID.GHASTLY_CLAWS),
    cast(ID.EXIT_LICH_FORM)
  ]);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.DEATHLY_CLAWS));
  assert.ok(result.warnings.some((warning) => warning.includes('cannot cast in shroud')));
  assert.equal(result.planningState.profession.activeShroud, '');
});

test('entry conditions award live Carapace without a restored state event', () => {
  const config = { ...base, initialResource: 10, selectedTraitIds: [TRAIT.WEAKENING_SHROUD, TRAIT.CORRUPTERS_FERVOR] };
  const result = simulate([cast(ID.REAPERS_SHROUD)], config);
  assert.equal(result.planningState.profession.carapaceExpiries.length, 2);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'condition' && event.condition === 'Weakness'));
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.state'),
    false
  );
});

test('a delivered entry boon triggers Blighters Boon once for the whole application', () => {
  const config = { ...base, initialResource: 10, selectedTraitIds: [TRAIT.AWAKEN_THE_PAIN, TRAIT.BLIGHTERS_BOON] };
  const result = simulate([cast(ID.REAPERS_SHROUD)], config);
  const might = result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === 'might');
  assert.equal(might.stacks, 5);
  assert.equal(result.planningState.profession.lifeForce.value, 11);
});

test('a landed shroud strike triggers Core conditions and siphons once in detailed and score execution', () => {
  const config = { ...base, initialResource: 100, selectedTraitIds: [TRAIT.DHUUMFIRE, TRAIT.VAMPIRIC] };
  const rotation = [cast(ID.REAPERS_SHROUD), cast(ID.LIFE_REND), wait(1000)];
  const result = simulate(rotation, config);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.DHUUMFIRE).length,
    1
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC).length,
    1
  );
  const score = simulate(rotation, config, { output: 'score' });
  assert.equal(result.totalDamage, score.totalDamage);
  const missed = simulate([cast(ID.REAPERS_SHROUD), { ...cast(ID.LIFE_REND), offTarget: true }, wait(1000)], config);
  assert.equal(
    missed.resolvedEvents.some((event) => event.sourceId === TRAIT.DHUUMFIRE || event.sourceId === TRAIT.VAMPIRIC),
    false
  );
});

// Resource retries follow existing pulse boundaries and only spend the values those pulses actually deliver.
test('selected resource passives can fund shroud entry without a predicted gain', () => {
  for (const [options, expectedStart] of [
    [{ selectedTraitIds: [TRAIT.ETERNAL_LIFE] }, 4000],
    [{ selectedSkills: ['Signet of Undeath'] }, 9000]
  ]) {
    const config = { ...base, ...options };
    const result = simulate([cast(ID.REAPERS_SHROUD)], config);
    assert.equal(result.steps[0].start, expectedStart);
    assert.equal(result.planningState.profession.lifeForce.value, 12);
    assert.deepEqual(result.warnings, []);
    assert.equal(
      simulate([cast(ID.REAPERS_SHROUD)], config, { output: 'score' }).rotationEndTime,
      result.rotationEndTime
    );
  }
});

test('Eternal Life keeps its cadence through overflow and caps its grants at the configured threshold', () => {
  const config = { ...base, initialResource: 65, selectedTraitIds: [TRAIT.ETERNAL_LIFE, TRAIT.GLUTTONY] };
  const native = necromancerProfession.runtimeFor(config);
  const values = [];
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.schedule('spend-below-cap', 2.5);
      runtime.schedule('observe-cap', 4);
    },
    tasks: {
      ...native.tasks,
      'spend-below-cap'(runtime) {
        values.push(runtime.resourceController.value('lifeForce'));
        runtime.resourceController.spend('lifeForce', 6);
      },
      'observe-cap'(runtime) {
        values.push(runtime.resourceController.value('lifeForce'));
      }
    }
  };
  const result = simulate([wait(4000)], config, { profession });
  assert.deepEqual(values, [66, 66]);
  assert.equal(observedRuntime(result).profession.core.passiveNextAt['eternal-life'], 5);
});

test('signet passives sample current recharge and only real shrouds enable Signets of Suffering', () => {
  const run = (rotation, traits = [], initialResource = 50) => {
    const config = {
      ...base,
      initialResource,
      selectedSkills: ['Signet of Undeath', 'Lich Form'],
      selectedTraitIds: traits
    };
    const native = necromancerProfession.runtimeFor(config);
    const profession = {
      ...native,
      initialize(runtime) {
        native.initialize(runtime);
        runtime.cooldownController.setReadyAt(ID.SIGNET_OF_UNDEATH, 7);
      }
    };
    return simulate(rotation, config, { profession });
  };

  const ready = run([wait(9000)], [], 0);
  assert.equal(ready.planningState.profession.lifeForce.value, 4);
  const suppressed = run([cast(ID.REAPERS_SHROUD), wait(4000)]);
  const enabled = run([cast(ID.REAPERS_SHROUD), wait(4000)], [TRAIT.SIGNETS_OF_SUFFERING]);
  assert.equal(
    enabled.planningState.profession.lifeForce.value - suppressed.planningState.profession.lifeForce.value,
    4
  );
  const lich = run([cast(ID.LICH_FORM), wait(4000)], [TRAIT.SIGNETS_OF_SUFFERING]);
  assert.equal(lich.planningState.profession.activeShroud, 'lich');
  assert.deepEqual(lich.warnings, []);
  assert.equal(lich.planningState.profession.lifeForce.value, 50);
});

test('Eternal Life resumes at its original boundary after a shroud interval', () => {
  const config = { ...base, initialResource: 10, selectedTraitIds: [TRAIT.ETERNAL_LIFE] };
  const during = simulate([cast(ID.REAPERS_SHROUD), wait(1500)], config);
  assert.equal(observedRuntime(during).profession.core.passiveNextAt['eternal-life'], 2);
  const rotation = [cast(ID.REAPERS_SHROUD), wait(1500), cast(ID.EXIT_REAPERS_SHROUD), wait(500)];
  const result = simulate(rotation, config);
  assert.equal(result.planningState.profession.activeShroud, '');
  assert.equal(result.planningState.profession.lifeForce.value, during.planningState.profession.lifeForce.value + 3);
});

test('Vampirism passive impacts obey the observation window and share score execution', () => {
  const config = { ...base, selectedSkills: ['Signet of Vampirism'] };
  assert.equal(simulate([wait(2960)], config).totalDamage, 0);
  const result = simulate([wait(3000)], config);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 1);
  assert.equal(simulate([wait(3000)], config, { output: 'score' }).totalDamage, result.totalDamage);
});

test('allied siphon cadence starts once at an explicit combat marker', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE], allies: { count: 2, strikesPerSecond: 2 } };
  const rotation = [wait(2000), { type: 'combat-start' }, wait(500)];
  const result = simulate(rotation, config);
  const siphons = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC_PRESENCE
  );
  assert.equal(siphons.length, 2);
  assert.ok(siphons.every((event) => event.at === 2.5));
  assert.equal(simulate(rotation, config, { output: 'score' }).totalDamage, result.totalDamage);
  const inherited = simulate([wait(2500)], config, { combatStartTime: 2 });
  assert.equal(inherited.totalDamage, result.totalDamage);
});

test('delivered Taste for Blood charges are independent and obey the party recipient cap', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.OVERFLOWING_THIRST], allies: { count: 3, strikesPerSecond: 2 } };
  const profession = withChainStep(config, ID.NECROTIC_BITE);
  const rotation = [cast(ID.SUMMON_BONE_MINIONS), cast(ID.NECROTIC_BITE), wait(5000)];
  const result = simulate(rotation, config, { profession });
  const grant = result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === 'taste-for-blood');
  assert.deepEqual(grant.resolvedAudience.companionIds, ['minion:bone-minion:0']);
  const pools = observedRuntime(result).profession.core.tasteForBloodBuffs;
  assert.equal(Object.keys(pools).length, 5);
  assert.ok(Object.values(pools).every((applications) => applications.length === 0));
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.taste-for-blood-grant'),
    false
  );
  assert.equal(simulate(rotation, config, { profession, output: 'score' }).totalDamage, result.totalDamage);
  const missed = simulate([{ ...cast(ID.NECROTIC_BITE), offTarget: true }], config, { profession });
  assert.equal(observedRuntime(missed).profession.core.tasteForBloodBuffs.self[0].stacks, 1);
});

test('zero passive grants cannot advertise an endless affordability retry', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.ETERNAL_LIFE], selectedSkills: ['Signet of Undeath'] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: {
        [TRAIT.ETERNAL_LIFE]: { fields: { lifeForceGain: 0 } },
        [PROFILE.signetOfUndeathPassive]: { fields: { lifeForceGain: 0 } }
      }
    })
  };
  const result = simulate([cast(ID.REAPERS_SHROUD)], config, { profession });
  assert.equal(result.rotationEndTime, 0);
  assert.deepEqual(observedRuntime(result).profession.core.passiveNextAt, {});
  assert.ok(result.warnings.some((warning) => warning.includes('life force')));
});

// Legality is evaluated before any cast reserves recharge, creates a summon, or grants a trait effect.
test('live slot selection and trait replacements reject unavailable commands without state changes', () => {
  const empty = simulate([cast(ID.SUMMON_BONE_MINIONS)], { ...base, selectedSkills: [] });
  assert.deepEqual(empty.planningState.profession.activeMinions, {});
  assert.ok(empty.warnings.some((warning) => warning.includes('not equipped')));
  const equipped = simulate([cast(ID.SUMMON_BONE_MINIONS), cast(ID.PUTRID_EXPLOSION)], {
    ...base,
    selectedSkills: ['Summon Bone Minions']
  });
  assert.deepEqual(equipped.warnings, []);
  assert.equal(equipped.planningState.profession.activeMinions['bone-minion'], 1);
  assert.ok(simulate([cast(ID.DEVOURING_DARKNESS)]).warnings.some((warning) => warning.includes('Lingering Curse')));
  const replacement = simulate([cast(ID.FEAST_OF_CORRUPTION)], { ...base, selectedTraitIds: [TRAIT.LINGERING_CURSE] });
  assert.ok(replacement.warnings.some((warning) => warning.includes('Devouring Darkness replaces')));
  assert.equal(observedRuntime(replacement).cooldowns.size, 0);
});

test('a completed parent arms one exclusive follow-up window and interruption arms nothing', () => {
  const config = { ...base, specialization: 'Core', initialResource: 100 };
  const before = [cast(ID.DEATH_SHROUD), cast(ID.DARK_PATH)];
  const used = simulate([...before, cast(ID.DARK_PURSUIT), cast(ID.DARK_PURSUIT)], config);
  assert.equal(used.warnings.length, 1);
  assert.match(used.warnings[0], /not currently armed/);
  assert.equal(used.planningState.profession.availableFlips[ID.DARK_PURSUIT], undefined);
  const expired = simulate([...before, wait(3000), cast(ID.DARK_PURSUIT)], config);
  assert.equal(expired.planningState.profession.availableFlips[ID.DARK_PURSUIT], undefined);
  assert.ok(expired.warnings.some((warning) => warning.includes('not currently armed')));
  const cancelled = simulate(
    [cast(ID.DEATH_SHROUD), { ...cast(ID.DARK_PATH), interruptAfterMs: 40 }, cast(ID.DARK_PURSUIT)],
    config
  );
  assert.equal(cancelled.planningState.profession.availableFlips[ID.DARK_PURSUIT], undefined);
  assert.ok(cancelled.warnings.some((warning) => warning.includes('not currently armed')));
  const rearmed = simulate(
    [...before, wait(1000), { type: 'cooldown-reset' }, cast(ID.DARK_PATH), wait(2000), cast(ID.DARK_PURSUIT)],
    config
  );
  assert.deepEqual(rearmed.warnings, []);
});

test('Core recharge traits commit modified work for corruption and shroud skills', () => {
  for (const [trait, skillId, entry] of [
    [TRAIT.MASTER_OF_CORRUPTION, ID.CORROSIVE_POISON_CLOUD, false],
    [TRAIT.SINISTER_SHROUD, ID.DOOM, true]
  ]) {
    const config = { ...base, specialization: 'Core', initialResource: 100, selectedTraitIds: [trait] };
    const native = necromancerProfession.runtimeFor(config);
    const skill = native.catalog.skillsById.get(skillId);
    const multiplier = native.catalog.balanceProfilesById.get(trait).rechargeMultiplier;
    const result = simulate([...(entry ? [cast(ID.DEATH_SHROUD)] : []), cast(skillId)], config);
    const expected = result.steps.at(-1).end / 1000 + skill.cooldown * multiplier;
    assert.ok(
      Math.abs(observedRuntime(result).cooldowns.get(skillId) - expected) < 0.000001,
      `${skill.name}: ${observedRuntime(result).cooldowns.get(skillId)} expected ${expected}`
    );
    assert.deepEqual(result.warnings, []);
  }
});

test('heal completion claims Dark Defense and Malicious Swarm once per cooldown, excluding cancelled casts', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.DARK_DEFENSE, TRAIT.MALICIOUS_SWARM] };
  const cancelled = simulate([{ ...cast(ID.WELL_OF_BLOOD), interruptAfterMs: 40 }], config);
  assert.deepEqual(cancelled.planningState.profession.carapaceExpiries, []);
  assert.equal(cancelled.totalDamage, 0);
  const result = simulate([cast(ID.WELL_OF_BLOOD), cast(ID.SUMMON_BLOOD_FIEND)], config);
  assert.equal(result.planningState.profession.carapaceExpiries.length, 10);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === TRAIT.MALICIOUS_SWARM).length,
    1
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.DARK_DEFENSE).length,
    1
  );
  assert.deepEqual(result.warnings, []);
});

test('Transfusion keeps surviving conditions when its strike is removed and requires completion', () => {
  const config = { ...base, initialResource: 100, selectedTraitIds: [TRAIT.TRANSFUSION] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: {
        [TRAIT.TRANSFUSION]: { removeEffects: [{ type: 'strike', name: 'Strike' }] }
      }
    })
  };
  const rotation = [cast(ID.REAPERS_SHROUD), cast(ID.SOUL_SPIRAL)];
  const result = simulate(rotation, config, { profession });
  const effects = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.TRANSFUSION);
  assert.deepEqual(effects.map((event) => event.condition).sort(), ['Chilled', 'Poisoned']);
  const cancelled = simulate([cast(ID.REAPERS_SHROUD), { ...cast(ID.SOUL_SPIRAL), interruptAfterMs: 40 }], config, {
    profession
  });
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.sourceId === TRAIT.TRANSFUSION),
    false
  );
  assert.equal(simulate(rotation, config, { profession, output: 'score' }).totalDamage, result.totalDamage);
});

test('Fear of Death follows accepted fear with one cooldown and cannot fund entry from a miss or late impact', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.FEAR_OF_DEATH] };
  const ordinary = simulate([cast(ID.REAPERS_MARK)]);
  const landed = simulate([cast(ID.REAPERS_MARK)], config);
  assert.equal(landed.planningState.profession.lifeForce.value - ordinary.planningState.profession.lifeForce.value, 15);
  for (const flags of [{ offTarget: true }, { impactDelayMs: 10000 }]) {
    const result = simulate([{ ...cast(ID.REAPERS_MARK), ...flags }, cast(ID.REAPERS_SHROUD)], config);
    assert.equal(result.planningState.profession.lifeForce.value, 0);
    assert.equal(observedRuntime(result).profession.core.fearOfDeathReadyAt, 0);
    assert.ok(result.warnings.some((warning) => warning.includes('life force')));
  }

  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      for (const at of [0.1, 0.2, 4.1, 4.2])
        runtime.emit({
          type: 'control',
          at,
          source: 'necromancer',
          sourceId: ID.REAPERS_MARK,
          skillId: ID.REAPERS_MARK,
          actorType: 'player',
          controlKind: 'fear'
        });
    }
  };
  const repeated = simulate([wait(5000)], config, { profession });
  assert.equal(repeated.planningState.profession.lifeForce.value, 30);
});
