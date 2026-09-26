import assert from 'node:assert/strict';
import test from 'node:test';
import { observeGw2Runtime, runtimeFor } from '#tests/helpers/live-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

const base = {
  specialization: 'Ritualist',
  initialResource: 100,
  stats: { power: 1000, precision: 1000, vitality: 1000 },
  target: { armor: 2597, health: 0, conditions: {} }
};
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const state = (result) => runtimeFor(result).profession.specialization.state;

// The same compiled native family supplies the live state, traits, and selected effect-removal profiles.
function run(
  rotation,
  { config = base, events = [], balanceProfiles = {}, output, combatStartTime, bondInitialDelay } = {}
) {
  const native = necromancerProfession.liveRuntimeFor(config);
  let catalog = applyBalanceProfilePatch(native.catalog, { balanceProfiles });
  // Timing is not a user patch field; this fixture also exercises the runtime's valid zero-delay profile contract.
  if (bondInitialDelay != null) {
    const profiles = catalog.balanceProfiles.map((profile) =>
      profile.id === PROFILE.painfulBond ? { ...profile, initialDelay: bondInitialDelay } : profile
    );
    catalog = {
      ...catalog,
      balanceProfiles: profiles,
      balanceProfilesById: new Map(profiles.map((profile) => [profile.id, profile])),
      balanceProfilesByName: new Map(profiles.map((profile) => [profile.name, profile]))
    };
  }

  return observeGw2Runtime({
    profession: {
      ...native,
      catalog,
      initialize(runtime) {
        native.initialize(runtime);
        for (const event of events) runtime.emit(event);
      }
    },
    config,
    rotation,
    output,
    combatStartTime
  });
}

const hit = (at, extra = {}) => ({
  type: 'damage',
  at,
  source: 'necromancer',
  sourceId: ID.NECROTIC_GRASP,
  skillId: ID.NECROTIC_GRASP,
  skillName: 'Necrotic Grasp',
  actorType: 'player',
  coefficient: 1,
  weaponStrengthProfileId: 'weapon.staff',
  ...extra
});
const bond = (at, duration, extra = {}) => ({
  type: 'necromancer.painful-bond',
  at,
  source: 'Spirit',
  sourceId: ID.ANGUISH,
  actorType: 'effect',
  mode: 'apply',
  duration,
  ...extra
});
const spellDamage = (result, id) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.source === 'Weapon Spell' && event.sourceId === id
  );
const bondDamage = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === 'ritualist.painful-bond');

test('the Ritualist palette reads detached live spirit availability without exposing autonomous bookkeeping', () => {
  const rotation = [cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH)];
  const summoned = run(rotation);
  const exited = run([...rotation, cast(ID.EXIT_RITUALISTS_SHROUD)]);
  for (const [result, available] of [
    [summoned, true],
    [exited, false]
  ]) {
    const projection = result.planningState.profession;
    const context = { specialization: 'Ritualist', professionState: projection, time: result.planningState.atSeconds };
    const skill = necromancerProfession.catalog.skillsById.get(ID.INNERVATE_ANGUISH);
    assert.equal(necromancerProfession.ui.paletteSkillAvailability(context, skill).available, available);
    for (const key of ['core', 'specialization', 'spiritGenerations', 'weaponSpells', 'lifeForceWakeGeneration'])
      assert.equal(key in projection, false);
  }

  // Public collections are detached from the live owner and from the combat boundary.
  summoned.planningState.profession.activeSpirits.anguish = 0;
  assert.ok(state(summoned).activeSpirits.anguish);
  assert.ok(summoned.combatState.profession.activeSpirits.anguish);
});

test('weapon spells consume only accepted recipient hits and their derived damage cannot recurse', () => {
  const result = run([cast(ID.NIGHTMARE_WEAPON), wait(1000)], {
    events: [hit(0.25, { offTarget: true }), hit(0.5), hit(0.75)]
  });
  assert.equal(state(result).weaponSpells.nightmare.recipients.player.charges, 3);
  assert.equal(spellDamage(result, ID.NIGHTMARE_WEAPON).length, 2);
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.weapon-spell'),
    false
  );
  const cancelled = run([{ ...cast(ID.NIGHTMARE_WEAPON), interruptAfterMs: 100 }]);
  assert.deepEqual(state(cancelled).weaponSpells, {});
  assert.deepEqual(result.warnings, []);
});

test('allied opportunities consume independent finite grants on the actual strike cadence and ICD', () => {
  const config = { ...base, allies: { count: 2, strikesPerSecond: 10 } };
  const result = run([cast(ID.SPLINTER_WEAPON), wait(1200)], { config, combatStartTime: 0 });
  const grants = state(result).weaponSpells.splinter.recipients;
  assert.equal(grants.player.charges, 5);
  assert.equal(grants['ally:1'].charges, 0);
  assert.equal(grants['ally:2'].charges, 0);
  assert.deepEqual(
    spellDamage(result, ID.SPLINTER_WEAPON)
      .filter((event) => event.metadata.triggeredByAlly === 1)
      .map((event) => event.at),
    [0.34, 0.74, 1.14]
  );
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 6);
  assert.equal(
    run([cast(ID.SPLINTER_WEAPON), wait(1200)], { config, output: 'score', combatStartTime: 0 }).totalDamage,
    result.totalDamage
  );
});

test('weapon spell replacement cancels old opportunities and the old expiry cannot clear the new grant', () => {
  const config = { ...base, allies: { count: 1, strikesPerSecond: 0.2 } };
  const rotation = [
    cast(ID.NIGHTMARE_WEAPON),
    wait(460),
    { type: 'cooldown-reset' },
    cast(ID.NIGHTMARE_WEAPON),
    wait(9300)
  ];
  const result = run(rotation, { config, combatStartTime: 0 });
  assert.deepEqual(
    spellDamage(result, ID.NIGHTMARE_WEAPON).map((event) => event.at),
    [5.94]
  );
  assert.equal(state(result).weaponSpells.nightmare.recipients['ally:1'].charges, 2);
  assert.equal(state(result).weaponSpells.nightmare.generation, 2);
  const expired = run([...rotation, wait(700)], { config, combatStartTime: 0 });
  assert.deepEqual(state(expired).weaponSpells, {});
  assert.equal(spellDamage(expired, ID.NIGHTMARE_WEAPON).length, 1);
});

test('explicit precombat and target death cannot spend allied weapon spell charges', () => {
  const config = { ...base, allies: { count: 1, strikesPerSecond: 1 } };
  const rotation = [cast(ID.NIGHTMARE_WEAPON), wait(2000)];
  assert.equal(
    state(run(rotation, { config, combatStartTime: 3 })).weaponSpells.nightmare.recipients['ally:1'].charges,
    3
  );
  const dead = run([cast(ID.NIGHTMARE_WEAPON), wait(2000)], {
    config: { ...config, target: { ...base.target, health: 1 } },
    combatStartTime: 0,
    events: [hit(0.5)]
  });
  assert.equal(dead.deathTime, 0.5);
  assert.equal(state(dead).weaponSpells.nightmare.recipients['ally:1'].charges, 3);
});

test('weapon spell recipients are selected at grant time and Wielders Boon changes their charge count', () => {
  const rotation = [cast(ID.SUMMON_BONE_MINIONS), cast(ID.NIGHTMARE_WEAPON)];
  const config = { ...base, allies: { count: 3, strikesPerSecond: 0 }, selectedTraitIds: [TRAIT.WIELDERS_BOON] };
  const result = run(rotation, { config });
  const grants = state(result).weaponSpells.nightmare.recipients;
  assert.deepEqual(Object.keys(grants).sort(), ['ally:1', 'ally:2', 'ally:3', 'minion:bone-minion:0', 'player']);
  assert.ok(Object.values(grants).every((grant) => grant.charges === 5));
  assert.deepEqual(result.warnings, []);
});

test('removed weapon spell strikes preserve independent Nightmare conditions and wholly removed procs spend nothing', () => {
  const config = { ...base, allies: { count: 1, strikesPerSecond: 1 } };
  const balanceProfiles = {
    [PROFILE.nightmareWeaponProc]: { removeEffects: [{ type: 'strike', name: 'Strike' }] },
    [PROFILE.splinterWeaponProc]: { removeEffects: [{ type: 'strike', name: 'Strike' }] }
  };
  const result = run([cast(ID.NIGHTMARE_WEAPON), cast(ID.SPLINTER_WEAPON), wait(1000)], {
    config,
    balanceProfiles,
    events: [hit(0.75)],
    combatStartTime: 0
  });
  assert.equal(spellDamage(result, ID.NIGHTMARE_WEAPON).length, 0);
  assert.equal(state(result).weaponSpells.nightmare.recipients.player.charges, 4);
  assert.equal(state(result).weaponSpells.nightmare.recipients['ally:1'].charges, 2);
  assert.equal(state(result).weaponSpells.splinter.recipients.player.charges, 5);
  assert.equal(state(result).weaponSpells.splinter.recipients['ally:1'].charges, 3);
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'condition' && event.sourceId === ID.NIGHTMARE_WEAPON)
  );
});

test('Painful Bond duration stacks without duplicate pulses and preserves cadence across inactive gaps', () => {
  const result = run([wait(4100)], { events: [bond(0, 1), bond(0.5, 1), bond(3, 1)] });
  assert.deepEqual(
    bondDamage(result).map((event) => event.at),
    [0.004, 1.004, 3.004]
  );
  assert.equal(state(result).painfulBondUntil, 0);
  assert.equal(state(result).painfulBondPulseAnchorAt, 0.004);
  const boundary = run([wait(2100)], {
    events: [bond(0, 1), bond(1, 1)],
    bondInitialDelay: 0
  });
  assert.deepEqual(
    bondDamage(boundary).map((event) => event.at),
    [0]
  );
});

test('Painful Bond honors a zero initial delay, removed output, target gates, and the observation end', () => {
  assert.deepEqual(
    bondDamage(run([wait(1500)], { events: [bond(0, 2)], bondInitialDelay: 0 })).map((event) => event.at),
    [0, 1]
  );
  assert.equal(
    run([wait(2000)], {
      events: [bond(0, 1)],
      balanceProfiles: { [PROFILE.painfulBond]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } }
    }).totalDamage,
    0
  );
  assert.equal(run([wait(2000)], { events: [bond(0, 1, { offTarget: true })] }).totalDamage, 0);
  assert.equal(run([wait(2000)], { combatStartTime: 3, events: [bond(0, 1)] }).totalDamage, 0);
});

test('spirit creation commits once and Soul Twisting refunds only the first completed summon', () => {
  const config = { ...base, initialResource: 40, selectedTraitIds: [TRAIT.SOUL_TWISTING, TRAIT.BOON_OF_CREATION] };
  const result = run([cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), cast(ID.ANGUISH)], { config });
  assert.deepEqual(state(result).activeSpirits, { anguish: true });
  assert.equal(state(result).spiritGenerations.anguish, 2);
  assert.equal(state(result).soulTwistingAvailable, false);
  assert.ok(runtimeFor(result).cooldowns.get(ID.ANGUISH) > result.planningState.atSeconds);
  assert.equal(result.planningState.profession.lifeForce.value, 56.64);
  assert.deepEqual(result.warnings, []);
  const interrupted = run([cast(ID.RITUALISTS_SHROUD), { ...cast(ID.ANGUISH), interruptAfterMs: 100 }], { config });
  assert.deepEqual(state(interrupted).activeSpirits, {});
  assert.equal(state(interrupted).soulTwistingAvailable, true);
  assert.equal(interrupted.planningState.profession.lifeForce.value, 39.7);
});

// Cancelling only the aftercast keeps the summon; the declared commit point, not full completion, owns that decision.
test('spirit summons honor the declared commit point when the aftercast is cancelled', () => {
  const commitMs = necromancerProfession.catalog.skillsById.get(ID.ANGUISH).interruptCommitMs;
  assert.ok(commitMs > 0);
  for (const [interruptAfterMs, summoned] of [
    [commitMs, true],
    [commitMs - 40, false]
  ]) {
    const result = run([cast(ID.RITUALISTS_SHROUD), { ...cast(ID.ANGUISH), interruptAfterMs }, wait(3000)]);
    assert.deepEqual(result.warnings, []);
    assert.equal(state(result).activeSpirits.anguish === true, summoned, String(interruptAfterMs));
    assert.equal(
      result.events.some((event) => event.type === 'damage' && event.metadata?.spiritAttackType === 'initial'),
      summoned
    );
  }
});

test('exit preserves committed attacks while autonomous spirit work ends on exit or Lingering depletion', () => {
  const rotation = [cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), cast(ID.EXIT_RITUALISTS_SHROUD), wait(5000)];
  const exited = run(rotation);
  assert.deepEqual(state(exited).activeSpirits, {});
  assert.ok(exited.resolvedEvents.some((event) => event.type === 'damage' && event.source === 'Spirit'));
  assert.equal(
    exited.resolvedEvents.some((event) => event.type === 'damage' && event.actorType === 'summon'),
    false
  );
  const config = { ...base, initialResource: 12, selectedTraitIds: [TRAIT.LINGERING_SPIRITS] };
  const living = run(rotation.slice(0, 3), { config });
  assert.deepEqual(state(living).activeSpirits, { anguish: true });
  assert.equal(living.planningState.profession.lifeForce.rate, -3);
  const depleted = run([...rotation, cast(ID.INNERVATE_ANGUISH)], { config });
  assert.deepEqual(state(depleted).activeSpirits, {});
  assert.equal(depleted.planningState.profession.lifeForce.value, 0);
  assert.equal(depleted.planningState.profession.lifeForce.rate, 0);
  assert.equal(depleted.steps.at(-1).invalid, true);
});

test('replacement cancels a prior spirit generation without resetting the shared autonomous cadence', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.SOUL_TWISTING] };
  const result = run([cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), wait(7600), cast(ID.ANGUISH), wait(4500)], {
    config
  });
  const attacks = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.metadata?.spiritAttackType === 'autoattack'
  );
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].activationId.startsWith('cast:3:'), true);
  assert.equal(attacks[0].at, 12.76);
  assert.equal(state(result).spiritAutoAnchorAt, 7.92);
});

test('Summon Spirits checks its initial window and busy state before an autonomous attack can start', () => {
  const immediate = run([cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), cast(ID.SUMMON_SPIRITS), wait(1500)]);
  assert.equal(
    immediate.events.some((event) => event.metadata?.spiritAttackType === 'summon-spirits'),
    false
  );
  const result = run([cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), wait(7200), cast(ID.SUMMON_SPIRITS), wait(1800)]);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.metadata?.spiritAttackType === 'summon-spirits'
    )
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.metadata?.spiritAttackType === 'autoattack'),
    false
  );
  assert.deepEqual(result.warnings, []);
});

test('Innervate requires its live spirit and grants life force once even when hostile output misses', () => {
  assert.equal(run([cast(ID.INNERVATE_ANGUISH)]).steps[0].invalid, true);
  const config = { ...base, initialResource: 50 };
  const rotation = [cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), { ...cast(ID.INNERVATE_ANGUISH), offTarget: true }];
  const result = run(rotation, { config });
  assert.equal(result.planningState.profession.lifeForce.value, 58.32);
  assert.ok(result.resolvedEvents.some((event) => event.kind === 'might' && event.skillId === ID.INNERVATE_ANGUISH));
  assert.equal(
    run([...rotation.slice(0, 2), cast(ID.INNERVATE_ANGUISH)], { config }).planningState.profession.lifeForce.value,
    58.32
  );
});

test('creature traits observe actual Core minion and staggered horror creation with independent strike multipliers', () => {
  const config = { ...base, initialResource: 0, selectedTraitIds: [TRAIT.BOON_OF_CREATION, TRAIT.EXPLOSIVE_GROWTH] };
  const minions = run([cast(ID.SUMMON_BONE_MINIONS)], { config });
  assert.equal(minions.planningState.profession.lifeForce.value, 20);
  assert.equal(
    minions.resolvedEvents.filter((event) => event.sourceId === TRAIT.EXPLOSIVE_GROWTH && event.type === 'damage')
      .length,
    1
  );
  const horrors = run([cast(ID.LICH_FORM), cast(ID.SUMMON_MADNESS)], { config });
  assert.equal(horrors.planningState.profession.lifeForce.value, 10);
  const later = run([cast(ID.LICH_FORM), cast(ID.SUMMON_MADNESS), wait(1000)], { config });
  assert.ok(later.planningState.profession.lifeForce.value > 10);
  const rotation = [cast(ID.SUMMON_SHADOW_FIEND), wait(3000)];
  const normal = run(rotation);
  const stronger = run(rotation, { config: { ...base, selectedTraitIds: [TRAIT.SPIRITS_STRENGTH] } });
  assert.equal(stronger.totalDamage, normal.totalDamage * 1.5);
});

test('removed initial spirit attacks preserve the creature and independent effects without backdating live state', () => {
  const balanceProfiles = {
    [PROFILE.anguish]: { removeEffects: [{ type: 'strike', name: 'Anguish Initial Barrage' }] },
    [PROFILE.wanderlust]: { removeEffects: [{ type: 'strike', name: 'Wanderlust Initial Swing' }] }
  };
  const result = run([cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), cast(ID.WANDERLUST), wait(5000)], {
    balanceProfiles
  });
  assert.deepEqual(state(result).activeSpirits, { anguish: true, wanderlust: true });
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === 'ritualist.painful-bond'),
    false
  );
  assert.ok(result.resolvedEvents.some((event) => event.name === 'Spirit of Wanderlust - Initial Attack'));
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.state'),
    false
  );
});

test('Essence Blast snapshots the activation-time spirit count and uses the equipped weapon', () => {
  const config = { ...base, primaryWeapon: 'Staff' };
  const result = run([cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), cast(ID.ESSENCE_BLAST)], { config });
  const blast = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ESSENCE_BLAST);
  assert.equal(blast.metadata.activeSpirits, 1);
  assert.equal(blast.weaponStrengthProfileId, 'weapon.staff');
  assert.equal(blast.skillWeapon, 'Staff');
  assert.deepEqual(result.warnings, []);
});
