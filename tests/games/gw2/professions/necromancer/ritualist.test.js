import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';

const base = {
  specialization: 'Ritualist',
  initialResource: 100,
  attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, vitality: 1000 }),
  target: { armor: 2597, health: 0, conditions: {} }
};
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const state = (result) => observedRuntime(result).profession.specialization.state;

// Editing a delayed condition cannot remove a sibling condition or stop the spirit's autonomous lifetime.
test('Ritualist opening conditions use selected profiles independently of their sibling attacks', () => {
  for (const [skillId, profileId, removed, retained] of [
    [ID.ANGUISH, PROFILE.anguish, 'Crippled', 'Vulnerability'],
    [ID.WANDERLUST, PROFILE.wanderlust, 'Chilled', 'Weakness']
  ]) {
    const result = run([cast(ID.RITUALISTS_SHROUD), cast(skillId), wait(13000)], {
      balanceProfiles: {
        [profileId]: {
          removeEffects: [{ type: 'condition', name: removed }],
          effects: [{ type: 'condition', name: retained, duration: 9 }]
        }
      }
    });
    assert.deepEqual(result.warnings, []);
    const conditions = result.events.filter((event) => event.type === 'condition' && event.skillId === skillId);
    assert.equal(
      conditions.some((event) => event.condition === removed),
      false
    );
    assert.equal(conditions.find((event) => event.condition === retained).duration, 9);
    assert.ok(
      result.events.some(
        (event) => event.type === 'damage' && event.skillId === skillId && event.actorType === 'summon'
      )
    );
  }
});

// The same compiled native family supplies the live state, traits, and selected effect-removal profiles.
function run(
  rotation,
  { config = base, events = [], balanceProfiles = {}, output, combatStartTime, bondInitialDelay } = {}
) {
  const native = necromancerProfession.runtimeFor(config);
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
        for (const event of events) runtime.effects.emit({ kind: 'packet', event: event });
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
    const skill = necromancerProfession.catalog.skillsById.get(ID.INNERVATE_ANGUISH);
    assert.equal(result.planningState.availability[skill.id].ready, available);
    for (const key of ['core', 'specialization', 'spiritGeneration', 'weaponSpells', 'lifeForceWakeGeneration'])
      assert.equal(key in projection, false);
  }

  // Public collections are detached from the live owner.
  assert.deepEqual(summoned.planningState.profession.activeSpirits, { anguish: true });
  assert.deepEqual(exited.planningState.profession.activeSpirits, {});
  delete summoned.planningState.profession.activeSpirits.anguish;
  assert.ok(state(summoned).activeSpirits.anguish);
});

test('Nightmare consumes only accepted recipient hits and cannot trigger itself', () => {
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

// One accepted strike can spend Nightmare directly and through Splinter, but the chain must stop there.
test('Splinter triggers Nightmare in one direction and rejected effects spend no charges', () => {
  const result = run([cast(ID.NIGHTMARE_WEAPON), cast(ID.SPLINTER_WEAPON), wait(1000)], {
    events: [
      hit(0.75),
      hit(1, { actorType: 'effect' }),
      hit(1.1, { actorType: 'effect', sourceId: ID.SPLINTER_WEAPON, offTarget: true })
    ]
  });
  assert.equal(state(result).weaponSpells.nightmare.recipients.player.charges, 3);
  assert.equal(state(result).weaponSpells.splinter.recipients.player.charges, 4);
  assert.deepEqual(
    spellDamage(result, ID.NIGHTMARE_WEAPON).map((event) => event.triggeredBy),
    ['Necrotic Grasp', 'Splinter Weapon']
  );
  assert.equal(spellDamage(result, ID.SPLINTER_WEAPON).length, 1);
  assert.deepEqual(result.warnings, []);
});

// Allied Splinter retains its trigger attribution while consuming the caster's separate Nightmare grant.
test('ally-triggered Splinter consumes caster Nightmare charges without reusing allied charges', () => {
  const config = { ...base, allies: { count: 1, strikesPerSecond: 1 } };
  const result = run([cast(ID.NIGHTMARE_WEAPON), cast(ID.SPLINTER_WEAPON), wait(1200)], {
    config,
    combatStartTime: 0
  });
  const grants = state(result).weaponSpells;
  assert.equal(grants.nightmare.recipients.player.charges, 4);
  assert.equal(grants.nightmare.recipients['ally:1'].charges, 2);
  assert.equal(grants.splinter.recipients.player.charges, 5);
  assert.equal(grants.splinter.recipients['ally:1'].charges, 2);
  // The two charge owners remain separate rows even though both damage packets were triggered by the ally.
  const nightmareRows = skillBreakdownRows(result).filter((row) => row.sourceId === ID.NIGHTMARE_WEAPON);
  assert.deepEqual(nightmareRows.map((row) => [row.name, row.hits]).sort(), [
    ['Nightmare Weapon (Personal)', 1],
    ['Nightmare Weapon (Shared)', 1]
  ]);
  assert.equal(
    nightmareRows.reduce((sum, row) => sum + row.total, 0),
    spellDamage(result, ID.NIGHTMARE_WEAPON).reduce((sum, event) => sum + event.damage, 0)
  );
  assert.equal(
    spellDamage(result, ID.NIGHTMARE_WEAPON).find((event) => event.triggeredBy === 'Splinter Weapon').metadata
      .triggeredByAlly,
    1
  );
  assert.deepEqual(result.warnings, []);
});

test('allied opportunities consume independent finite grants on the actual strike cadence and ICD', () => {
  const config = { ...base, allies: { count: 2, strikesPerSecond: 10 } };
  const result = run([cast(ID.SPLINTER_WEAPON), wait(1200)], { config, combatStartTime: 0 });
  const grants = state(result).weaponSpells.splinter.recipients;
  assert.equal(grants.player.charges, 5);
  assert.equal(grants['ally:1'].charges, 0);
  assert.equal(grants['ally:2'].charges, 0);
  const allied = spellDamage(result, ID.SPLINTER_WEAPON).filter((event) => event.metadata.triggeredByAlly === 1);
  const cooldown = necromancerProfession
    .runtimeFor(config)
    .catalog.balanceProfilesById.get(PROFILE.splinterWeaponProc).internalCooldown;
  assert.ok(allied.every((event, index) => index === 0 || event.at - allied[index - 1].at > cooldown));
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 6);
  assert.equal(
    run([cast(ID.SPLINTER_WEAPON), wait(1200)], { config, output: 'score', combatStartTime: 0 }).totalDamage,
    result.totalDamage
  );
});

test('weapon spell replacement retains allied cadence and the old expiry cannot clear the new grant', () => {
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
    [5, 10]
  );
  assert.equal(state(result).weaponSpells.nightmare.recipients['ally:1'].charges, 1);
  assert.equal(state(result).weaponSpells.nightmare.generation, 2);
  const expired = run([...rotation, wait(700)], { config, combatStartTime: 0 });
  assert.deepEqual(state(expired).weaponSpells, {});
  assert.equal(spellDamage(expired, ID.NIGHTMARE_WEAPON).length, 2);
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

// Preparing a weapon spell cannot advance its allied attack countdown or extend the finite grant's lifetime.
test('precombat weapon spells start allied countdowns at combat entry and retain their expiry', () => {
  for (const skillId of [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON]) {
    for (const interval of [1, 0.52]) {
      const config = { ...base, allies: { count: 1, strikesPerSecond: 1 / interval } };
      const result = run([cast(skillId), wait(4000)], { config, combatStartTime: 2 });
      const allied = spellDamage(result, skillId).filter((event) => event.metadata?.triggeredByAlly);
      assert.equal(allied[0].at, 2 + interval);
      assert.deepEqual(result.warnings, []);
    }

    const expired = run([cast(skillId), wait(12000)], {
      config: { ...base, allies: { count: 1, strikesPerSecond: 1 } },
      combatStartTime: 10
    });
    assert.equal(spellDamage(expired, skillId).length, 0);
    assert.deepEqual(state(expired).weaponSpells, {});
  }
});

// Explicit markers anchor engagement, while implicit allied strikes can initiate combat themselves.
test('weapon spell allied opportunities follow engagement independently of DPS reporting', () => {
  const config = { ...base, allies: { count: 1, strikesPerSecond: 1 / 0.52 } };
  const marker = run([cast(ID.NIGHTMARE_WEAPON), wait(2000), { type: 'combat-start' }, wait(1200)], { config });
  const implicit = run([cast(ID.NIGHTMARE_WEAPON), wait(3000)], { config, events: [hit(2)] });
  const firstAlly = (result) =>
    spellDamage(result, ID.NIGHTMARE_WEAPON).find((event) => event.metadata?.triggeredByAlly);
  assert.ok(Math.abs(firstAlly(marker).at - marker.combatStartTime - 0.52) < 1e-6);
  assert.equal(firstAlly(implicit).at, 0.52);
  assert.equal(implicit.combatStartTime, firstAlly(implicit).at);
  assert.equal(state(marker).weaponSpells.nightmare.recipients['ally:1'].charges, 1);
  assert.equal(state(implicit).weaponSpells.nightmare.recipients['ally:1'].charges, 0);
  for (const result of [marker, implicit]) assert.deepEqual(result.warnings, []);
});

test('weapon spell recipients are selected at grant time and Wielders Boon changes their charge count', () => {
  const rotation = [cast(ID.SUMMON_BONE_MINIONS), cast(ID.NIGHTMARE_WEAPON)];
  const config = { ...base, allies: { count: 3, strikesPerSecond: 1 }, selectedTraitIds: [TRAIT.WIELDERS_BOON] };
  const result = run(rotation, { config, combatStartTime: 10 });
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
  assert.ok(
    observedRuntime(result).combat.activeBuffStacks('necromancer-painful-bond', observedRuntime(result).time, 1) === 0
  );
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
  assert.deepEqual(Object.keys(state(result).activeSpirits), ['anguish']);
  assert.equal(state(result).activeSpirits.anguish.generation, 2);
  assert.equal(state(result).soulTwistingAvailable, false);
  assert.ok(observedRuntime(result).cooldownController.readyAt(ID.ANGUISH) > result.planningState.atSeconds);
  assert.equal(result.planningState.profession.lifeForce.value, 56.64);
  assert.deepEqual(result.warnings, []);
  const interrupted = run([cast(ID.RITUALISTS_SHROUD), { ...cast(ID.ANGUISH), interruptAfterMs: 100 }], { config });
  assert.deepEqual(state(interrupted).activeSpirits, {});
  assert.equal(state(interrupted).soulTwistingAvailable, true);
  assert.equal(interrupted.planningState.profession.lifeForce.value, 39.64);
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
  assert.deepEqual(Object.keys(state(living).activeSpirits), ['anguish']);
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

// A commanded attack can make a spirit busy after its autonomous animation starts but before its impact arrives.
test('busy spirits suppress an in-flight autonomous impact without shifting later attacks', () => {
  const resources = necromancerProfession.catalog.balanceProfilesById.get(PROFILE.resources);
  const opening = [cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), wait(resources.initialDelay * 1000 + 40)];
  const baseline = run([...opening, wait(resources.pulseInterval * 2000)]);
  const commanded = run([...opening, cast(ID.SUMMON_SPIRITS), wait(resources.pulseInterval * 2000)]);
  const autos = (result) => result.resolvedEvents.filter((event) => event.metadata?.spiritAttackType === 'autoattack');
  const baselineAutos = autos(baseline);
  const commandedAt = commanded.steps.find((step) => step.skillId === ID.SUMMON_SPIRITS).start / 1000;
  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(commanded.warnings, []);
  assert.ok(commandedAt > state(baseline).spiritAutoAnchorAt);
  assert.ok(commandedAt < baselineAutos[0].at);
  assert.ok(baselineAutos.length > 1);
  assert.deepEqual(
    autos(commanded).map((event) => event.at),
    baselineAutos.slice(1).map((event) => event.at)
  );
  assert.equal(state(commanded).spiritAutoAnchorAt, state(baseline).spiritAutoAnchorAt);
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
  assert.deepEqual(Object.keys(state(result).activeSpirits), ['anguish', 'wanderlust']);
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

// An unusable allied cadence must not allocate native charges; player and companion grants still exist.
for (const skillId of [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON]) {
  test(`weapon spell ${skillId} rejects allied charge creation at zero strike rate`, () => {
    const result = run([cast(ID.SUMMON_BONE_MINIONS), cast(skillId)], {
      config: { ...base, allies: { count: 3, strikesPerSecond: 0 } }
    });
    const spell = skillId === ID.NIGHTMARE_WEAPON ? 'nightmare' : 'splinter';
    const recipients = state(result).weaponSpells[spell].recipients;
    assert.deepEqual(Object.keys(recipients).sort(), ['minion:bone-minion:0', 'player']);
    assert.ok(Object.values(recipients).every(({ charges }) => charges > 0));
    assert.deepEqual(observedRuntime(result).alliedStrikeController.pendingEffects(), []);
  });
}

// Resilient Weapon is defensive: allied state and chart windows exist even when no allied strikes can occur.
for (const strikesPerSecond of [0, 2]) {
  test(`Resilient Weapon retains allied effect windows at ${strikesPerSecond} strikes per second`, () => {
    const result = run([cast(ID.RESILIENT_WEAPON), wait(1000)], {
      config: { ...base, allies: { count: 4, strikesPerSecond }, selectedTraitIds: [TRAIT.WIELDERS_BOON] }
    });
    const recipients = state(result).weaponSpells.resilient.recipients;
    assert.deepEqual(Object.keys(recipients).sort(), ['ally:1', 'ally:2', 'ally:3', 'ally:4', 'player']);
    for (const recipient of ['ally:1', 'ally:2', 'ally:3', 'ally:4']) {
      const grant = recipients[recipient];
      assert.equal(grant.charges, recipients.player.charges);
      const effect = result.planningState.effects.find(
        (entry) => entry.kind === 'resilient-weapon' && entry.recipient === recipient
      );
      assert.deepEqual(effect.windows, [{ stacks: grant.charges, expiresAt: grant.expiresAt }]);
      const track = result.effectReport.tracks.find(
        (entry) => entry.kind === 'resilient-weapon' && entry.recipient === recipient
      );
      assert.ok(track.segments.some((segment) => segment.count > 0));
      assert.equal(track.terminal.count, grant.charges);
    }

    assert.deepEqual(
      observedRuntime(result)
        .queue.pending()
        .filter((event) => event.type === 'runtime.allied-strike'),
      []
    );
    assert.deepEqual(result.warnings, []);
  });
}
