import assert from 'node:assert/strict';
import test from 'node:test';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { LUMINARY_BALANCE_PROFILE_IDS as LUM_PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import {
  LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID,
  LUMINARY_INITIAL_STATE_SKILL_IDS as LUM_INITIAL
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as WB_PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as FB_PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as DH_PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { GUARDIAN_SPEAR_EXPIRY } from '#gw2/professions/guardian/core/mechanics/spear.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runGuardian as run } from '#tests/helpers/guardian-simulation.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const core = (result) => observedRuntime(result).profession.core;
const strike = (runtime, at, extra = {}) =>
  runtime.emit({
    type: 'damage',
    source: 'guardian',
    sourceId: ID.ORB_OF_WRATH,
    skillId: ID.ORB_OF_WRATH,
    skillName: 'Orb of Wrath',
    actorType: 'player',
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.scepter',
    activationId: `impact-${at}`,
    at,
    ...extra
  });

const firebrand = { specialization: 'Firebrand' };
const fb = (result) => observedRuntime(result).profession.specialization.state;
const willbender = { specialization: 'Willbender' };
const wb = (result) => observedRuntime(result).profession.specialization.state;

const luminary = { specialization: 'Luminary' };
const lum = (result) => observedRuntime(result).profession.specialization.state;

// These scenarios check live boundaries and ownership independently of saved rotations.
test('Luminary forge owns exact expiry, distinct-weapon recharge, and precombat exits', () => {
  for (const weapons of [[], [ID.DAZZLING_HAMMER], [ID.DAZZLING_HAMMER, ID.LUMINOUS_STAFF]]) {
    const result = run([ID.ENTER_RADIANT_FORGE, ...weapons, ID.EXIT_RADIANT_FORGE], luminary);
    assert.deepEqual(result.warnings, []);
    assert.equal(lum(result).radiantForge, false);
    assert.equal(
      observedRuntime(result).rechargeProgress.get(ID.ENTER_RADIANT_FORGE).work,
      weapons.length <= 1 ? 5 : 10
    );
  }

  const expired = run([ID.ENTER_RADIANT_FORGE, wait(20000)], luminary);
  assert.equal(lum(expired).radiantForge, false);
  assert.equal(observedRuntime(expired).rechargeProgress.get(ID.ENTER_RADIANT_FORGE).startedAt, 20);
  assert.equal(core(expired).availableFlips[ID.EXIT_RADIANT_FORGE], undefined);
  const precombat = run(
    [ID.ENTER_RADIANT_FORGE, wait(20000), { type: 'combat-start' }, ID.ENTER_RADIANT_FORGE],
    luminary
  );
  assert.deepEqual(precombat.warnings, []);
  assert.equal(lum(precombat).radiantForge, true);
  const replacement = run(
    [
      ID.ENTER_RADIANT_FORGE,
      wait(1000),
      ID.EXIT_RADIANT_FORGE,
      { type: 'cooldown-reset' },
      ID.ENTER_RADIANT_FORGE,
      wait(19000)
    ],
    luminary
  );
  assert.equal(lum(replacement).radiantForge, true);
  assert.equal(lum(replacement).radiantForgeEndsAt, 21);
});

test('Luminary equips replace only forge flips and canceled attempts grant no equip rewards', () => {
  const traits = [TRAIT.EMPOWERED_ARMAMENTS, TRAIT.RESPLENDENT_WEAPONRY, TRAIT.RADIANT_ARMAMENTS];
  const canceled = run([ID.ENTER_RADIANT_FORGE, { skillId: ID.DAZZLING_HAMMER, interruptMs: 0 }, wait(100)], {
    ...luminary,
    selectedTraitIds: traits
  });
  assert.deepEqual(lum(canceled).radiantWeaponsUsed, {});
  assert.equal(lum(canceled).empoweredArmamentsUntil, 0);
  assert.equal(core(canceled).availableFlips[ID.SHINING_SPIN], undefined);
  const equipped = run([ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER, ID.LUMINOUS_STAFF, wait(1)], {
    ...luminary,
    selectedTraitIds: traits,
    allies: { count: 2 }
  });
  assert.equal(lum(equipped).radiantWeapon, 'staff');
  assert.equal(core(equipped).availableFlips[ID.SHINING_SPIN], undefined);
  assert.ok(core(equipped).availableFlips[ID.RESTORATIVE_GLOW]);
  assert.ok(lum(equipped).empoweredArmamentsUntil > observedRuntime(equipped).time);
  const boon = equipped.resolvedEvents.find((event) => event.kind === 'alacrity');
  assert.equal(boon.resolvedAudience.alliedPlayerCount, 2);
  assert.ok(observedRuntime(equipped).cooldowns.get(ID.DAZZLING_HAMMER) > observedRuntime(equipped).time);
});

test('an in-flight radiant weapon cannot equip itself after its forge entry is replaced', () => {
  const result = run(
    [
      ID.ENTER_RADIANT_FORGE,
      ID.GLEAMING_BLADE,
      { skillId: ID.EXIT_RADIANT_FORGE, offset: 100 },
      { type: 'cooldown-reset' },
      ID.ENTER_RADIANT_FORGE,
      wait(1500)
    ],
    luminary
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(lum(result).radiantForge, true);
  assert.equal(lum(result).radiantWeapon, '');
  assert.deepEqual(lum(result).radiantWeaponsUsed, {});
  assert.equal(core(result).availableFlips[ID.LUCENT_THRUST], undefined);
});

test('Luminary support bursts retain boons and shared vulnerability without inventing strikes', () => {
  for (const [weapon, kind] of [
    [ID.LUMINOUS_STAFF, 'regeneration'],
    [ID.RADIANT_BULWARK, 'resolution']
  ]) {
    const result = run([ID.ENTER_RADIANT_FORGE, weapon, ID.GLARING_BURST], { ...luminary, allies: { count: 2 } });
    assert.deepEqual(result.warnings, []);
    const boon = result.resolvedEvents.find((event) => event.skillId === ID.GLARING_BURST && event.kind === kind);
    assert.equal(boon.resolvedAudience.alliedPlayerCount, 2);
    assert.ok(result.events.some((event) => event.skillId === ID.GLARING_BURST && event.condition === 'Vulnerability'));
    assert.equal(
      result.resolvedEvents.some((event) => event.skillId === ID.GLARING_BURST && event.type === 'damage'),
      false
    );
  }
});

test('Radiant Armaments reads executed metadata and Courage empowers one sword impact before damage', () => {
  const hit = (result, id) => result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === id);
  const plain = run([ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER], luminary);
  const traited = run([ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER], {
    ...luminary,
    selectedTraitIds: [TRAIT.RADIANT_ARMAMENTS]
  });
  assert.ok(Math.abs(hit(traited, ID.DAZZLING_HAMMER).damage - hit(plain, ID.DAZZLING_HAMMER).damage * 1.07) <= 1);
  const sword = run([ID.ENTER_RADIANT_FORGE, ID.GLEAMING_BLADE], luminary);
  const empowered = run([ID.RADIANT_COURAGE, ID.ENTER_RADIANT_FORGE, ID.GLEAMING_BLADE], luminary);
  assert.ok(Math.abs(hit(empowered, ID.GLEAMING_BLADE).damage - hit(sword, ID.GLEAMING_BLADE).damage * 1.5) <= 1);
  assert.equal(lum(empowered).radiantCourageSwordArmed, false);
  assert.equal(lum(empowered).radiantCourageShieldArmed, true);
});

test('Radiant Justice is claimed at hammer impact and retains missed activation ownership', () => {
  const plain = run([ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER], luminary);
  const impact = plain.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.DAZZLING_HAMMER
  ).at;
  for (const before of [true, false]) {
    const result = run(
      [
        ID.ENTER_RADIANT_FORGE,
        ID.DAZZLING_HAMMER,
        { skillId: ID.RADIANT_JUSTICE, offset: impact * 1000 + (before ? -40 : 20) },
        wait(1000)
      ],
      luminary
    );
    const extra = result.resolvedEvents.find((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact');
    assert.equal(Boolean(extra), before);
    assert.equal(lum(result).radiantJusticeArmed, !before);
    if (extra)
      assert.equal(
        extra.activationId,
        result.events.find((event) => event.type === 'action' && event.skillId === ID.DAZZLING_HAMMER).activationId
      );
  }

  const missed = run(
    [ID.RADIANT_JUSTICE, ID.ENTER_RADIANT_FORGE, { skillId: ID.DAZZLING_HAMMER, offTarget: true }, wait(1000)],
    luminary
  );
  assert.equal(lum(missed).radiantJusticeArmed, false);
  assert.equal(
    missed.resolvedEvents.some((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact'),
    false
  );
});

test('Luminary weapon rewards reduce actual virtue work and Master-at-Arms resets matching weapons', () => {
  const result = run([ID.RADIANT_JUSTICE, ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER, wait(1)], {
    ...luminary,
    selectedTraitIds: [TRAIT.ILLUMINATING_INSPIRATION]
  });
  const ordinary = run([ID.RADIANT_JUSTICE, ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER, wait(1)], luminary);
  const remaining = (result) => {
    const runtime = observedRuntime(result);
    return runtime.cooldownController.remaining(
      runtime.helpers.skillsById.get(ID.RADIANT_JUSTICE),
      runtime.rechargeProgress.get(ID.RADIANT_JUSTICE),
      runtime.time
    );
  };

  assert.ok(Math.abs(remaining(ordinary) - remaining(result) - 4) < 1e-9);
  const reset = run([ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER, ID.RADIANT_JUSTICE], {
    ...luminary,
    selectedTraitIds: [TRAIT.MASTER_AT_ARMS]
  });
  assert.equal(observedRuntime(reset).cooldowns.has(ID.DAZZLING_HAMMER), false);
});

test('Effulgent counts accepted owned hits, excludes its endpoint, and ignores a replaced detonation', () => {
  const result = run([ID.EFFULGENT_STANCE, wait(4000)], luminary, (runtime) => {
    strike(runtime, 0.1, { offTarget: true });
    strike(runtime, 0.2, { actorType: 'summon' });
    strike(runtime, 0.3, { actorType: 'effect', source: 'Sigil' });
    strike(runtime, 0.4);
    strike(runtime, 0.5, { actorType: 'effect' });
    strike(runtime, 4);
  });
  const detonation = result.resolvedEvents.find((event) => event.skillId === ID.EFFULGENT_STANCE_DAMAGE);
  assert.equal(detonation.coefficient, 1.2);
  assert.equal(lum(result).effulgentStacks, 0);
  const replaced = run(
    [ID.EFFULGENT_STANCE, wait(1000), { type: 'cooldown-reset' }, ID.EFFULGENT_STANCE, wait(3000)],
    luminary
  );
  assert.equal(lum(replaced).effulgentActiveUntil, 5);
  assert.equal(
    replaced.resolvedEvents.some((event) => event.skillId === ID.EFFULGENT_STANCE_DAMAGE),
    false
  );
});

test('Luminary auras require actual combos and detonate only for eligible Luminary skills', () => {
  const config = { ...luminary, primaryWeapon: 'Greatsword', selectedTraitIds: [TRAIT.SOVEREIGN_OF_LIGHT] };
  const bare = run([ID.GLEAMING_BLADE], config);
  assert.ok(bare.warnings.length);
  const unbound = run([ID.ENTER_RADIANT_FORGE, ID.GLEAMING_BLADE], luminary);
  assert.equal(lum(unbound).lightAuraUntil, 0);
  const combo = run([ID.ENTER_RADIANT_FORGE, ID.LUMINOUS_STAFF, ID.DAZZLING_HAMMER], luminary);
  assert.ok(lum(combo).lightAuraUntil > observedRuntime(combo).time);
  const detonation = run([LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID, ID.PIERCING_STANCE], config);
  assert.ok(detonation.resolvedEvents.some((event) => event.skillId === ID.SOVEREIGN_OF_LIGHT_DAMAGE));
  assert.equal(lum(detonation).lightAuraUntil, 0);
  const coreLeap = run([LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID, ID.SYMBOL_OF_RESOLUTION, ID.LEAP_OF_FAITH], config);
  assert.equal(
    coreLeap.resolvedEvents.some((event) => event.skillId === ID.SOVEREIGN_OF_LIGHT_DAMAGE),
    false
  );
});

test('Luminary selected component removal preserves independent effects and never creates missing windows', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'luminary-components',
    label: 'Luminary removed components',
    professions: {
      guardian: {
        balanceProfiles: {
          [LUM_PROFILE.forge]: { removeEffects: [{ type: 'buff', all: true }] },
          [LUM_PROFILE.lightAura]: { removeEffects: [{ type: 'buff', all: true }] },
          [LUM_PROFILE.effulgentStance]: { removeEffects: [{ type: 'strike', all: true }] }
        }
      }
    }
  });
  const result = run(
    [ID.ENTER_RADIANT_FORGE, ID.EFFULGENT_STANCE, wait(4000)],
    { ...luminary, patchId: 'luminary-components' },
    (runtime) => {
      for (let i = 1; i <= 10; i++) strike(runtime, i / 10);
    },
    patched
  );
  assert.equal(lum(result).radiantForge, false);
  assert.equal(lum(result).lightAuraUntil, 0);
  assert.equal(lum(result).effulgentStacks, 0);
  assert.ok(result.events.some((event) => event.type === 'control' && event.skillId === ID.EFFULGENT_STANCE_DAMAGE));
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.EFFULGENT_STANCE_DAMAGE),
    false
  );
});

test('Luminary imported durations and live state agree in score and detailed modes', () => {
  const rotation = [
    { skillId: LUM_INITIAL.empoweredArmaments, initialStateDurationMs: 1000 },
    ID.EFFULGENT_STANCE,
    ID.ENTER_RADIANT_FORGE,
    ID.DAZZLING_HAMMER,
    ID.GLARING_BURST,
    wait(4000)
  ];
  const detailed = run(rotation, luminary);
  const score = run(rotation, luminary, () => {}, guardianProfession, 'score');
  assert.deepEqual(detailed.warnings, []);
  assert.deepEqual(lum(score), lum(detailed));
  assert.equal(score.dps, detailed.dps);
  assert.equal(lum(detailed).empoweredArmamentsUntil, 1);
  assert.equal(
    detailed.events.some(
      (event) => event.type.startsWith('guardian.radiant-forge-') || event.type.startsWith('guardian.effulgent-')
    ),
    false
  );
});

test('Willbender counts accepted player and Air impacts through the inclusive virtue boundary', () => {
  const result = run([wait(1100)], willbender, (runtime) => {
    const state = runtime.profession.specialization.state;
    for (const virtue of ['justice', 'resolve', 'courage']) {
      state[`${virtue}Until`] = 1;
      state.virtueHitCounts[virtue] = 4;
    }

    strike(runtime, 0.2, { offTarget: true });
    strike(runtime, 0.3, { actorType: 'summon' });
    strike(runtime, 0.4, { actorType: 'effect', sourceId: 'sigil.fire' });
    strike(runtime, 1, { actorType: 'effect', sourceId: 'sigil.air' });
    strike(runtime, 1.000001);
  });
  assert.equal(wb(result).triggeredVirtueEffects, 3);
  assert.deepEqual(wb(result).virtueHitCounts, { justice: 0, resolve: 0, courage: 0 });
  assert.equal(core(result).justiceActiveBurns, 1);
  assert.equal(wb(result).lethalTempoStacks, 3);
  const unarmed = run([wait(1)], willbender, (runtime) => strike(runtime, 0));
  assert.equal(wb(unarmed).triggeredVirtueEffects, 0);
  assert.deepEqual(wb(unarmed).virtueHitCounts, { justice: 0, resolve: 0, courage: 0 });
});

test('Willbender reopening preserves partial progress and records one live activation window', () => {
  const result = run([wait(1000), ID.RUSHING_JUSTICE], willbender, (runtime) => {
    const state = runtime.profession.specialization.state;
    state.justiceUntil = 0.1;
    state.virtueHitCounts.justice = 4;
  });
  assert.equal(wb(result).triggeredVirtueEffects, 1);
  assert.equal(wb(result).virtueHitCounts.justice, 0);
  const window = result.resolvedEvents.find((event) => event.kind === 'willbender-justice');
  const [application] = boonApplicationsAt(result.events, 'willbender-justice', window.at);
  assert.equal(wb(result).justiceUntil, application.expiresAt);
  assert.equal(
    result.events.some((event) => event.type.startsWith('guardian.willbender-virtue-')),
    false
  );
});

test('Willbender same-virtue trails overlap while a different virtue retires pending prior pulses', () => {
  const overlapping = run([ID.FLOWING_RESOLVE, ID.FLOWING_RESOLVE, wait(3000)], willbender);
  const fields = overlapping.resolvedEvents.filter((event) => event.type === 'damage' && event.willbenderFlames);
  assert.equal(new Set(fields.map((event) => event.activationId)).size, 2);
  assert.equal(wb(overlapping).flameGeneration, 1);
  const switched = run([ID.FLOWING_RESOLVE, wait(500), ID.RUSHING_JUSTICE, wait(3000)], willbender);
  const old = switched.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.WILLBENDER_FLAMES
  );
  assert.deepEqual(
    old.map((event) => event.at),
    [1]
  );
  assert.equal(wb(switched).flameGeneration, 2);
  assert.deepEqual(switched.warnings, []);
});

test('Willbender canceled activations preserve existing fields and cannot create virtue windows', () => {
  const result = run(
    [ID.FLOWING_RESOLVE, { type: 'cast', skillId: ID.RUSHING_JUSTICE, interruptAfterMs: 1 }, wait(5000)],
    willbender
  );
  assert.equal(wb(result).justiceUntil, 0);
  assert.equal(wb(result).flameVirtue, 'resolve');
  assert.equal(wb(result).flameGeneration, 1);
  assert.equal(
    result.resolvedEvents.some((event) => event.skillId === ID.WILLBENDER_FLAMES_ID_62618),
    false
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillId === ID.WILLBENDER_FLAMES && event.at === 5
    )
  );
});

test('Willbender Searing Pact follows accepted flame pulses and preserves their separate activation', () => {
  for (const offTarget of [false, true]) {
    const result = run([{ type: 'cast', skillId: ID.FLOWING_RESOLVE, offTarget }, wait(1600)], {
      ...willbender,
      selectedTraitIds: [TRAIT.SEARING_PACT]
    });
    const burns = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.sourceId === TRAIT.SEARING_PACT
    );
    assert.equal(burns.length, offTarget ? 0 : 2);
    assert.ok(burns.every((event) => event.activationId === `${result.steps[0].activationId}:flames`));
    assert.equal(wb(result).virtueHitCounts.resolve, offTarget ? 0 : 2);
  }
});

test('Restorative Virtues carries earned base work through an in-flight weapon cast and a later Alacrity grant', () => {
  const runCast = (traited) =>
    run(
      [ID.CHAINS_OF_LIGHT],
      { ...willbender, selectedTraitIds: traited ? [TRAIT.RESTORATIVE_VIRTUES] : [] },
      (runtime) => {
        const state = runtime.profession.specialization.state;
        state.justiceUntil = 10;
        state.virtueHitCounts.justice = 4;
        strike(runtime, 0.1);
        boon(runtime, 'alacrity', 0.2, 5);
      }
    );
  const plain = runCast(false),
    reduced = runCast(true);
  const work = (result) => observedRuntime(result).rechargeProgress.get(ID.CHAINS_OF_LIGHT).work;
  assert.ok(Math.abs(work(plain) - work(reduced) - 0.28) < 1e-9);
  assert.deepEqual(wb(reduced).pendingWeaponCooldownReduction, {});
  assert.deepEqual(wb(reduced).weaponCastRecharge, {});
});

test('Restorative Virtues reduces only the currently equipped weapon cooldowns', () => {
  const result = run([wait(1000)], { ...willbender, selectedTraitIds: [TRAIT.RESTORATIVE_VIRTUES] }, (runtime) => {
    const state = runtime.profession.specialization.state;
    state.justiceUntil = 2;
    state.virtueHitCounts.justice = 4;
    for (const id of [ID.CHAINS_OF_LIGHT, ID.SYMBOL_OF_BLADES])
      runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(id), 0, 2);
    strike(runtime, 1);
  });
  assert.equal(observedRuntime(result).cooldowns.get(ID.CHAINS_OF_LIGHT), 1.376);
  assert.equal(observedRuntime(result).cooldowns.get(ID.SYMBOL_OF_BLADES), 1.6);
});

test('Willbender Repose belongs to a completed Flash Combo and expires without touching a later occurrence', () => {
  const full = run([ID.FLASH_COMBO], willbender);
  assert.ok(core(full).availableFlips[ID.REPOSE]);
  const canceled = run([{ type: 'cast', skillId: ID.FLASH_COMBO, interruptAfterMs: 1 }], willbender);
  assert.equal(core(canceled).availableFlips[ID.REPOSE], undefined);
  const used = run([ID.FLASH_COMBO, ID.REPOSE], willbender);
  assert.equal(core(used).availableFlips[ID.REPOSE], undefined);
  const expired = run([ID.FLASH_COMBO, wait(6000), ID.REPOSE], willbender);
  assert.equal(expired.steps.at(-1).invalid, true);
  const replaced = run(
    [ID.FLASH_COMBO, wait(1000), { type: 'cooldown-reset' }, ID.FLASH_COMBO, wait(5000)],
    willbender
  );
  assert.ok(core(replaced).availableFlips[ID.REPOSE]);
});

test('removed Willbender window components preserve independent fields and activation boons', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'willbender-window',
    label: 'No Justice window',
    professions: {
      guardian: {
        balanceProfiles: { [WB_PROFILE.virtueWindows]: { removeEffects: [{ type: 'buff', name: 'justice' }] } }
      }
    }
  });
  const result = run(
    [ID.RUSHING_JUSTICE, wait(3000)],
    { ...willbender, patchId: 'willbender-window', selectedTraitIds: [TRAIT.HOLY_RECKONING] },
    () => {},
    patched
  );
  assert.equal(wb(result).justiceUntil, 0);
  assert.equal(wb(result).triggeredVirtueEffects, 0);
  assert.equal(wb(result).lethalTempoStacks, 1);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.willbenderFlames));
  assert.ok(result.resolvedEvents.some((event) => event.kind === 'fury'));
  assert.equal(
    result.resolvedEvents.some((event) => event.kind === 'might' && event.sourceId === TRAIT.HOLY_RECKONING),
    false
  );
});

test('Willbender Phoenix Protocol shares only with Battle Presence and score mode preserves virtue execution', () => {
  for (const sharing of [false, true]) {
    const config = {
      ...willbender,
      allies: { count: 4, strikesPerSecond: 1 },
      selectedTraitIds: [TRAIT.PHOENIX_PROTOCOL, ...(sharing ? [TRAIT.BATTLE_PRESENCE] : [])]
    };
    const rotation = [ID.FLOWING_RESOLVE, wait(6000)];
    const detailed = run(rotation, config),
      score = run(rotation, config, () => {}, guardianProfession, 'score');
    assert.equal(detailed.dps, score.dps);
    assert.deepEqual(wb(detailed), wb(score));
    const alacrity = detailed.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'alacrity');
    assert.ok(alacrity.length >= 2);
    assert.ok(alacrity.every((event) => event.resolvedAudience.alliedPlayerCount === (sharing ? 4 : 0)));
    assert.deepEqual(detailed.warnings, []);
  }
});

test('Firebrand pages recover before retrying a cast and zero pages leave the tome open', () => {
  const result = run([ID.TOME_OF_JUSTICE, ID.SEARING_SPELL], { ...firebrand, initialTomePages: 0 });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[1].start, 8000);
  assert.equal(fb(result).tomePages.value, 0);
  assert.equal(fb(result).activeTome, 'justice');
  const archivist = run([], { ...firebrand, selectedTraitIds: [TRAIT.ARCHIVIST_OF_WHISPERS] });
  assert.equal(fb(archivist).tomePages.maximum, 8);
  assert.equal(fb(archivist).tomePages.value, 8);
});

test('Firebrand page refunds survive concurrent stow while canceled pages spend and count nothing', () => {
  const opening = [ID.TOME_OF_JUSTICE, ID.IGNITING_BURST, ID.HEATED_REBUKE];
  const result = run(
    [...opening, ID.SEARING_SPELL, { type: 'cast', skillId: ID.STOW_TOME, concurrentOffsetMs: 0 }],
    firebrand
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(fb(result).tomePages.value, 3);
  assert.equal(fb(result).activeTome, '');
  assert.equal(fb(result).swiftScholarCount, 0);
  const canceled = run([...opening, { type: 'cast', skillId: ID.SEARING_SPELL, interruptAfterMs: 1 }], firebrand);
  assert.equal(fb(canceled).tomePages.value, 3);
  assert.equal(fb(canceled).swiftScholarCount, 2);
});

test('Firebrand dormant reopening preserves its deadline and grants activation benefits only once', () => {
  const result = run([ID.TOME_OF_JUSTICE, ID.STOW_TOME, wait(1000), ID.TOME_OF_JUSTICE], firebrand);
  assert.deepEqual(result.warnings, []);
  assert.equal(fb(result).tomeDormantReadyAt.justice, 20);
  assert.equal(core(result).virtueReadyAt.justice, 20);
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'quickness').length, 1);
});

test('Firebrand page exhaustion waits on the selected recovery policy and disabled recovery denies finitely', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'no-pages',
    label: 'No page regeneration',
    professions: {
      guardian: { balanceProfiles: { [FB_PROFILE.resources]: { fields: { pulseInterval: { from: 8, to: 0 } } } } }
    }
  });
  const result = run(
    [ID.TOME_OF_JUSTICE, ID.SEARING_SPELL],
    { ...firebrand, initialTomePages: 0, patchId: 'no-pages' },
    () => {},
    patched
  );
  assert.equal(result.steps[1].invalid, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /tome pages/);
  assert.equal(result.rotationEndTime, 0);
});

test('Firebrand normal and final mantra charges share lockout and automatically rearm after root recharge', () => {
  const result = run([ID.FLAME_RUSH, ID.FLAME_RUSH, ID.FLAME_SURGE, ID.FLAME_RUSH], firebrand);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[2].start, 1600);
  assert.equal(result.steps[3].start, 17600);
  assert.equal(observedRuntime(result).ammo.get(ID.FLAME_RUSH).charges, 2);
  assert.ok(core(result).availableFlips[ID.FLAME_RUSH]);
  assert.equal(core(result).availableFlips[ID.FLAME_SURGE], undefined);
});

test('Firebrand individual mantra recovery replaces the final variant without consuming it', () => {
  const result = run([ID.FLAME_RUSH, ID.FLAME_RUSH, wait(10000)], firebrand);
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).ammo.get(ID.FLAME_RUSH).charges, 2);
  assert.ok(core(result).availableFlips[ID.FLAME_RUSH]);
  assert.equal(core(result).availableFlips[ID.FLAME_SURGE], undefined);
});

test('Firebrand explicit recharge resets invalidate pending mantra wakes and restore the prepared pool', () => {
  const result = run(
    [ID.FLAME_RUSH, ID.FLAME_RUSH, ID.FLAME_SURGE, { type: 'cooldown-reset' }, wait(25000)],
    firebrand
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).ammo.get(ID.FLAME_RUSH).charges, 3);
  assert.ok(core(result).availableFlips[ID.FLAME_RUSH]);
  assert.equal(observedRuntime(result).cooldowns.has(ID.MANTRA_OF_FLAME), false);
});

test('Firebrand mantra recharge wakes ignore transient Alacrity and preserve later charge spends', () => {
  const result = run([ID.FLAME_RUSH, ID.FLAME_RUSH, ID.FLAME_SURGE, ID.FLAME_RUSH, wait(1100)], firebrand, (runtime) =>
    boon(runtime, 'alacrity', 5, 4)
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[3].start, 17600);
  assert.equal(observedRuntime(result).ammo.get(ID.FLAME_RUSH).charges, 2);
});

test('Firebrand Ashes grants at application, ignores misses, and preserves hit lineage at inclusive expiry', () => {
  const seen = [];
  const result = run([ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, wait(11000)], firebrand, (runtime) => {
    strike(runtime, 0.2);
    strike(runtime, 0.6, { offTarget: true });
    strike(runtime, 0.7, { actorType: 'summon' });
    strike(runtime, 1);
    strike(runtime, 1.1);
    strike(runtime, 10.56);
    const apply = runtime.applyCondition;
    runtime.applyCondition = (event) => {
      if (event.sourceId === 'guardian.ashes-of-the-just') seen.push([event.at, event.activationId]);
      return apply(event);
    };
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(seen, [
    [1, 'impact-1'],
    [10.56, 'impact-10.56']
  ]);
  assert.equal(fb(result).ashes.charges, 0);
  const canceled = run(
    [ID.TOME_OF_JUSTICE, { type: 'cast', skillId: ID.ASHES_OF_THE_JUST, interruptAfterMs: 1 }, wait(1000)],
    firebrand
  );
  assert.equal(fb(canceled).ashes.charges, 0);
  assert.equal(fb(canceled).tomePages.value, 5);
  assert.equal(
    canceled.resolvedEvents.some((event) => event.kind === 'ashes-of-the-just'),
    false
  );
});

test('Firebrand Quickfire refresh preserves charges past an older expiry and excludes ineligible recipients', () => {
  const result = run([wait(11000)], { ...firebrand, selectedTraitIds: [TRAIT.QUICKFIRE] }, (runtime) => {
    boon(runtime, 'quickness', 0, 1, { audience: { recipients: 'self' } });
    boon(runtime, 'quickness', 8, 1, { audience: { recipients: 'self' } });
    strike(runtime, 10.5);
  });
  assert.equal(fb(result).ashes.charges, 1);
  assert.equal(fb(result).ashes.expiresAt, 18);
  const rejected = run([wait(1000)], { ...firebrand, selectedTraitIds: [TRAIT.QUICKFIRE] }, (runtime) =>
    boon(runtime, 'quickness', 0, 1, { audience: { recipients: 'summons', affectsSelf: false } })
  );
  assert.equal(fb(rejected).quickfireReadyAt, 0);
  assert.equal(fb(rejected).ashes.charges, 0);
});

test('Firebrand axe and disable traits react to accepted player outcomes only', () => {
  const result = run(
    [wait(1000)],
    { ...firebrand, selectedTraitIds: [TRAIT.UNRELENTING_CRITICISM, TRAIT.STOIC_DEMEANOR] },
    (runtime) => {
      strike(runtime, 0.1, { skillId: ID.BLAZING_EDGE, offTarget: true });
      strike(runtime, 0.2, { skillId: ID.BLAZING_EDGE, actorType: 'summon' });
      strike(runtime, 0.3, { skillId: ID.BLAZING_EDGE });
      for (const [at, actorType, offTarget] of [
        [0.4, 'player', true],
        [0.5, 'summon', false],
        [0.6, 'player', false]
      ])
        runtime.emit({
          type: 'control',
          at,
          actorType,
          offTarget,
          source: 'fixture',
          sourceId: 'control',
          controlKind: 'daze',
          activationId: `control-${at}`
        });
    }
  );
  const bleeds = result.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Bleeding');
  assert.deepEqual(
    bleeds.map((event) => event.activationId),
    ['impact-0.3']
  );
  const resistance = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'resistance');
  assert.deepEqual(
    resistance.map((event) => event.activationId),
    ['control-0.6']
  );
});

test('Firebrand Renewed Focus restores the current page pool and dormancy only on full completion', () => {
  for (const interrupted of [false, true]) {
    const result = run(
      [
        ID.TOME_OF_JUSTICE,
        ID.SEARING_SPELL,
        ID.STOW_TOME,
        { type: 'cast', skillId: ID.RENEWED_FOCUS, ...(interrupted ? { interruptAfterMs: 1 } : {}) }
      ],
      firebrand
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(fb(result).tomePages.value, interrupted ? 4 : 5);
    assert.equal(fb(result).tomeDormantReadyAt.justice, interrupted ? 20 : result.rotationEndTime);
  }
});

test('Firebrand detailed and score modes share pages, mantra charges, and Ashes execution', () => {
  const rotation = [
    ID.TOME_OF_JUSTICE,
    ID.ASHES_OF_THE_JUST,
    ID.SEARING_SPELL,
    ID.STOW_TOME,
    ID.FLAME_RUSH,
    ID.FLAME_RUSH,
    ID.FLAME_SURGE,
    wait(12000)
  ];
  const config = { ...firebrand, selectedTraitIds: [TRAIT.QUICKFIRE, TRAIT.WEIGHTY_TERMS] };
  const detailed = run(rotation, config),
    score = run(rotation, config, () => {}, guardianProfession, 'score');
  assert.equal(score.dps, detailed.dps);
  assert.deepEqual(fb(score), fb(detailed));
  assert.deepEqual(score.warnings, []);
});

test('removed Firebrand components preserve independent page grants and Might without claiming disabled procs', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'firebrand-components',
    label: 'Firebrand component removal',
    professions: {
      guardian: {
        balanceProfiles: {
          [FB_PROFILE.ashes]: { removeEffects: [{ type: 'condition', all: true }] },
          [FB_PROFILE.weightyTerms]: { removeEffects: [{ type: 'condition', all: true }] },
          [FB_PROFILE.stalwartSpeed]: { removeEffects: [{ type: 'boon', all: true }] }
        }
      }
    }
  });
  const result = run(
    [ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, ID.STOW_TOME, ID.FLAME_RUSH, ID.FLAME_RUSH, ID.FLAME_SURGE],
    {
      ...firebrand,
      patchId: 'firebrand-components',
      initialTomePages: 1,
      selectedTraitIds: [TRAIT.QUICKFIRE, TRAIT.WEIGHTY_TERMS, TRAIT.STALWART_SPEED]
    },
    () => {},
    patched
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(fb(result).tomePages.value, 2);
  assert.equal(fb(result).ashes.charges, 0);
  assert.equal(fb(result).quickfireReadyAt, 0);
  assert.equal(fb(result).stalwartSpeedReadyAt, 0);
  assert.ok(result.resolvedEvents.some((event) => event.kind === 'might' && event.skillId === ID.ASHES_OF_THE_JUST));
  assert.equal(
    result.resolvedEvents.some((event) => event.condition === 'Slow'),
    false
  );
});

test('Core Justice counts accepted player hits and excludes missed, precombat, summon, and gear packets', () => {
  const result = run([wait(1000), { type: 'combat-start' }, wait(1000)], {}, (runtime) => {
    strike(runtime, 0.5);
    strike(runtime, 1, { offTarget: true });
    strike(runtime, 1, { actorType: 'summon', summonOwner: 'fixture' });
    strike(runtime, 1, { source: 'Sigil', actorType: 'effect' });
    for (const at of [1.1, 1.2, 1.3, 1.4, 1.5]) strike(runtime, at);
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).justicePassiveBurns, 1);
  assert.equal(core(result).justiceHitCount, 0);
  assert.equal(core(result).justiceActiveBurns, 0);
});

test('Justice activation arms one surviving hit and disables the passive without replay events', () => {
  const result = run(
    [ID.JUSTICE, wait(1000)],
    { selectedTraitIds: [TRAIT.INSPIRED_VIRTUE], allies: { count: 2 } },
    (runtime) => {
      strike(runtime, 0.1, { offTarget: true });
      for (const at of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) strike(runtime, at);
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).justiceActiveBurns, 1);
  assert.equal(core(result).justicePassiveBurns, 0);
  assert.equal(core(result).justiceHitCount, 0);
  assert.equal(core(result).justiceActiveArmed, false);
  assert.equal(
    result.resolvedEvents.find((event) => event.sourceId === 'guardian.justice-active').activationId,
    'impact-0.2'
  );
  const might = result.events.find((event) => event.sourceId === TRAIT.INSPIRED_VIRTUE);
  assert.equal(might.kind, 'might');
  assert.equal(might.resolvedAudience.alliedPlayerCount, 2);
  assert.equal(might.activationId, result.steps[0].activationId);
  assert.equal(
    result.events.some((event) => event.type === 'guardian.virtue-activated'),
    false
  );
});

test('Renewed Focus restores real virtue recharge only after a completed cast', () => {
  for (const interrupted of [false, true]) {
    const result = run(
      [
        ID.JUSTICE,
        interrupted ? { skillId: ID.RENEWED_FOCUS, interruptAfterMs: 100 } : ID.RENEWED_FOCUS,
        ...(!interrupted ? [ID.JUSTICE] : [])
      ],
      { selectedTraitIds: [TRAIT.INSPIRED_VIRTUE] }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.events.filter((event) => event.sourceId === TRAIT.INSPIRED_VIRTUE).length, interrupted ? 1 : 2);
    const owner = observedRuntime(result);
    assert.equal(owner.rechargeProgress.get(ID.JUSTICE).startedAt, interrupted ? 0 : owner.time);
  }
});

test('Justice armed during post-death planning cannot be consumed by a rejected later hit', () => {
  const result = run([wait(1100), ID.JUSTICE, wait(900)], { target: { armor: 2597, health: 1 } }, (runtime) => {
    strike(runtime, 1);
    strike(runtime, 2);
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).justiceActiveArmed, true);
  assert.equal(core(result).justiceActiveBurns, 0);
  assert.equal(core(result).justiceHitCount, 1);
});

test('permanent Alacrity readies the Core passive on the same action tick as its virtue', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'short-justice',
    label: 'Short Justice',
    professions: {
      guardian: {
        skills: {
          [ID.JUSTICE]: {
            fields: { cooldown: { from: guardianProfession.catalog.skillsById.get(ID.JUSTICE).cooldown, to: 12 } }
          }
        }
      }
    }
  });
  const result = run(
    [ID.JUSTICE, wait(11000)],
    { patchId: 'short-justice' },
    (runtime) => {
      runtime.emit({
        type: 'buff',
        kind: 'alacrity',
        at: 2,
        duration: 4.08,
        stacks: 1,
        source: 'fixture',
        sourceId: 'fixture',
        actorType: 'player'
      });
      strike(runtime, 0.1);
      strike(runtime, 9.59);
      strike(runtime, 9.6);
    },
    patched
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).justiceActiveBurns, 1);
  assert.equal(core(result).justiceHitCount, 1);
  assert.equal(core(result).virtueReadyAt.justice, 9.6);
});

test('removed Justice packets cannot arm an active charge or advance the passive counter', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'no-justice',
    label: 'No Justice',
    professions: {
      guardian: { balanceProfiles: { [PROFILE.justice]: { removeEffects: [{ type: 'condition', all: true }] } } }
    }
  });
  for (const rotation of [[wait(1000)], [ID.JUSTICE, wait(1000)]]) {
    const result = run(
      rotation,
      { patchId: 'no-justice' },
      (runtime) => {
        for (const at of [0.1, 0.2, 0.3, 0.4, 0.5]) strike(runtime, at);
      },
      patched
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(core(result).justiceActiveArmed, false);
    assert.equal(core(result).justiceActiveBurns, 0);
    assert.equal(core(result).justicePassiveBurns, 0);
    assert.equal(core(result).justiceHitCount, 0);
  }
});

test('Guardian weapon follow-ups expire autonomously and committed replacements survive obsolete wakes', () => {
  const opened = run([ID.ZEALOTS_FLAME], { secondaryWeapon: 'Torch' });
  assert.deepEqual(opened.warnings, []);
  const window = core(opened).availableFlips[ID.ZEALOTS_FIRE];
  assert.equal(window.expiresAt - window.availableAt, 3);
  const expired = run([ID.ZEALOTS_FLAME, wait(3000)], { secondaryWeapon: 'Torch' });
  assert.deepEqual(core(expired).availableFlips, {});
  const replaced = run(
    [ID.ZEALOTS_FLAME, ID.ZEALOTS_FIRE, 'Orb of Wrath', { type: 'cooldown-reset' }, ID.ZEALOTS_FLAME, wait(2500)],
    { secondaryWeapon: 'Torch' }
  );
  assert.deepEqual(replaced.warnings, []);
  assert.ok(core(replaced).availableFlips[ID.ZEALOTS_FIRE].identity > window.identity);
  assert.ok(observedRuntime(replaced).time >= window.expiresAt);
  assert.ok(core(replaced).availableFlips[ID.ZEALOTS_FIRE].expiresAt > observedRuntime(replaced).time);
});

test('Guardian flip cancellation and Banish recharge resets follow successful commitment', () => {
  const canceled = run([{ skillId: ID.BINDING_BLADE, interruptAfterMs: 1 }], { primaryWeapon: 'Greatsword' });
  assert.deepEqual(canceled.warnings, []);
  assert.deepEqual(core(canceled).availableFlips, {});
  const reset = run([ID.MIGHTY_BLOW, ID.BANISH], { primaryWeapon: 'Hammer' });
  assert.deepEqual(reset.warnings, []);
  assert.equal(observedRuntime(reset).cooldowns.has(ID.MIGHTY_BLOW), false);
  const denied = run([ID.PULL], { primaryWeapon: 'Greatsword' });
  assert.ok(denied.warnings.some((warning) => warning.includes('not currently armed')));
});

test('native Guardian detailed and score modes share virtue state and outcomes', () => {
  const initialize = (runtime) => {
    for (const at of [0.1, 0.2, 0.3]) strike(runtime, at);
  };

  const config = { selectedTraitIds: [TRAIT.PERMEATING_WRATH] };
  const detailed = run([wait(2000)], config, initialize);
  const score = run([wait(2000)], config, initialize, guardianProfession, 'score');
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.equal(core(score).justicePassiveBurns, 1);
  assert.equal(core(score).justiceHitCount, core(detailed).justiceHitCount);
});

// Seed a real window and its expiry to isolate capture, consumption, and delayed impacts from a setup rotation.
function illuminate(runtime, expiresAt, symbol = false) {
  if (symbol) runtime.profession.core.spearLuminanceUntil = expiresAt;
  else {
    runtime.profession.core.spearIlluminatedArmed = true;
    runtime.profession.core.spearIlluminatedUntil = expiresAt;
  }

  runtime.schedule(GUARDIAN_SPEAR_EXPIRY, expiresAt, { symbol, expiresAt }, undefined, -220);
}

test('spear captures illumination before expiry and enhances existing impacts without creating extra hits', () => {
  const result = run([ID.GLEAMING_DISC, wait(2000)], { primaryWeapon: 'Spear' }, (runtime) => illuminate(runtime, 0.1));
  assert.deepEqual(result.warnings, []);
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.GLEAMING_DISC);
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [1.5, 2.25]
  );
  assert.ok(hits.every((event) => event.activationId === result.steps[0].activationId));
  assert.ok(core(result).spearIlluminatedUntil > observedRuntime(result).time);
  const expired = run([wait(100), ID.GLEAMING_DISC, wait(2000)], { primaryWeapon: 'Spear' }, (runtime) =>
    illuminate(runtime, 0.1)
  );
  assert.deepEqual(
    expired.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === ID.GLEAMING_DISC)
      .map((event) => event.coefficient),
    [1.5, 1.5]
  );
});

test('spear expiry runs during waits and a refreshed window survives the old wake', () => {
  const result = run([ID.HELIO_RUSH, wait(500)], { primaryWeapon: 'Spear' }, (runtime) => illuminate(runtime, 0.5));
  assert.deepEqual(result.warnings, []);
  assert.ok(observedRuntime(result).time > 0.5);
  assert.equal(core(result).spearIlluminatedArmed, true);
  const expired = run([ID.HELIO_RUSH, wait(7000)], { primaryWeapon: 'Spear' });
  assert.equal(core(expired).spearIlluminatedArmed, false);
  assert.equal(core(expired).spearIlluminatedUntil, 0);
  const symbol = run([ID.SYMBOL_OF_LUMINANCE, wait(7000)], { primaryWeapon: 'Spear' });
  assert.equal(core(symbol).spearLuminanceUntil, 0);
});

test('an uncommitted spear attempt preserves its charge and creates no illuminated volley', () => {
  const result = run(
    [{ skillId: ID.SOLAR_STORM, interruptAfterMs: 1 }, wait(2000)],
    { primaryWeapon: 'Spear' },
    (runtime) => illuminate(runtime, 5)
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).spearIlluminatedUntil, 5);
  assert.equal(core(result).spearIlluminatedArmed, true);
  assert.equal(
    result.resolvedEvents.some((event) => event.skillId === ID.SOLAR_STORM && event.type === 'damage'),
    false
  );
  assert.equal(
    result.events.some((event) => event.name === 'Illuminated'),
    false
  );
});

test('committed illuminated projectiles retain their activation after a weapon swap and window expiry', () => {
  const config = { primaryWeapon: 'Spear', weaponSet2Primary: 'Scepter' };
  const result = run([ID.SOLAR_STORM, 'Swap Weapons', wait(2500)], config, (runtime) => illuminate(runtime, 0.1));
  assert.deepEqual(result.warnings, []);
  const extra = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && /Solar Storm — [45]th Strike/.test(event.name)
  );
  assert.deepEqual(
    extra.map((event) => event.coefficient),
    [0.6, 0.3]
  );
  assert.ok(extra.every((event) => event.activationId === result.steps[0].activationId));
  assert.equal(observedRuntime(result).activeWeaponSet, 2);
});

test('spear filler preserves an armed charge and removed grant components cannot restore it', () => {
  const filler = run([ID.DAYBREAKING_SLASH], { primaryWeapon: 'Spear' }, (runtime) => illuminate(runtime, 5));
  assert.deepEqual(filler.warnings, []);
  assert.equal(core(filler).spearIlluminatedUntil, 5);
  const patched = withPatchPreview(guardianProfession, {
    id: 'no-illumination-grants',
    label: 'No illumination grants',
    professions: {
      guardian: { balanceProfiles: { [PROFILE.spearLuminance]: { removeEffects: [{ type: 'buff', all: true }] } } }
    }
  });
  for (const symbol of [false, true]) {
    const result = run(
      [ID.HELIO_RUSH],
      { primaryWeapon: 'Spear', patchId: 'no-illumination-grants' },
      (runtime) => {
        illuminate(runtime, 5);
        if (symbol) illuminate(runtime, 5, true);
      },
      patched
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(core(result).spearIlluminatedArmed, symbol);
    assert.equal(core(result).spearIlluminatedUntil, symbol ? 5 : 0);
  }
});

test('spear selects remaining projectile components and shares its execution in score mode', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'remaining-illuminated-projectile',
    label: 'Remaining illuminated projectile',
    professions: {
      guardian: {
        balanceProfiles: {
          [PROFILE.spearSolarStorm]: { removeEffects: [{ type: 'strike', name: 'Fourth projectile' }] }
        }
      }
    }
  });
  const rotation = [ID.SOLAR_STORM, wait(2500)];
  const config = { primaryWeapon: 'Spear', patchId: 'remaining-illuminated-projectile' };
  const initialize = (runtime) => illuminate(runtime, 0.1);
  const detailed = run(rotation, config, initialize, patched);
  const score = run(rotation, config, initialize, patched, 'score');
  assert.deepEqual(detailed.warnings, []);
  assert.deepEqual(score.warnings, []);
  const extra = detailed.resolvedEvents.filter(
    (event) => event.type === 'damage' && /Solar Storm — [45]th Strike/.test(event.name)
  );
  assert.deepEqual(
    extra.map((event) => [event.name, event.coefficient]),
    [['Solar Storm — 5th Strike', 0.3]]
  );
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.equal(core(score).spearIlluminatedUntil, core(detailed).spearIlluminatedUntil);
});

const boon = (runtime, kind, at, duration, extra = {}) =>
  runtime.emit({
    type: 'buff',
    kind,
    at,
    duration,
    stacks: 1,
    actorType: 'player',
    source: 'fixture',
    sourceId: 'fixture',
    activationId: `${kind}-${at}`,
    ...extra
  });

test('symbol traits claim only accepted player impacts and retain delayed impact attribution', () => {
  const result = run(
    [wait(1000)],
    { selectedTraitIds: [TRAIT.SYMBOLIC_AVENGER, TRAIT.SYMBOLIC_EXPOSURE] },
    (runtime) => {
      strike(runtime, 0.1, { isSymbol: true, offTarget: true });
      strike(runtime, 0.2, { isSymbol: true, actorType: 'summon' });
      strike(runtime, 0.3, { isSymbol: true, actorType: 'effect' });
      strike(runtime, 0.4, { isSymbol: true });
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).symbolicAvengerExpirations.length, 1);
  const exposure = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.SYMBOLIC_EXPOSURE);
  assert.equal(exposure.length, 1);
  assert.equal(exposure[0].activationId, 'impact-0.4');
  assert.equal(exposure[0].at, 0.4);
});

test('Symbolic Avenger expires every independent stack during waits after its earliest wake', () => {
  const initialize = (runtime) => {
    strike(runtime, 0.1, { isSymbol: true });
    strike(runtime, 0.5, { isSymbol: true });
  };

  const config = { selectedTraitIds: [TRAIT.SYMBOLIC_AVENGER] };
  const partial = run([wait(15100)], config, initialize);
  assert.deepEqual(core(partial).symbolicAvengerExpirations, [15.5]);
  const expired = run([wait(15500)], config, initialize);
  assert.deepEqual(core(expired).symbolicAvengerExpirations, []);
});

test("Zealot's Resolution excludes the threshold-crossing hit and gives its child symbol one activation", () => {
  const config = { selectedTraitIds: [TRAIT.ZEALOTS_RESOLUTION], target: { health: 10000, armor: 2597 } };
  const runHits = (times) =>
    run([wait(500)], config, (runtime) => {
      for (const at of times) strike(runtime, at, { flatDamage: 2600 });
    });
  const crossing = runHits([0.1]);
  assert.equal(
    crossing.events.some((event) => event.skillId === ID.LESSER_SYMBOL_OF_RESOLUTION),
    false
  );
  const triggered = runHits([0.1, 0.2]);
  assert.deepEqual(triggered.warnings, []);
  const child = triggered.events.filter(
    (event) => event.skillId === ID.LESSER_SYMBOL_OF_RESOLUTION && ['damage', 'buff'].includes(event.type)
  );
  assert.ok(child.length > 0);
  assert.ok(child.every((event) => event.at === 0.2));
  assert.ok(child.every((event) => event.activationId === child[0].activationId));
  assert.notEqual(child[0].activationId, 'impact-0.2');
  assert.equal(core(triggered).zealotsResolutionReadyAt, 30.2);
});

test('Righteous Instincts extends one cadence and rejects stale ticks after a new Resolution window', () => {
  const result = run(
    [wait(4000)],
    { selectedTraitIds: [TRAIT.RIGHTEOUS_INSTINCTS], allies: { count: 2 } },
    (runtime) => {
      boon(runtime, 'resolution', 0, 5, { audience: { recipients: 'party', affectsSelf: false } });
      boon(runtime, 'resolution', 0.1, 1.1);
      boon(runtime, 'resolution', 0.8, 1);
      boon(runtime, 'resolution', 2.5, 1.1);
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'buff' && event.sourceId === TRAIT.RIGHTEOUS_INSTINCTS)
      .map((event) => event.at),
    [0.1, 1.1, 2.1, 2.5, 3.5]
  );
  assert.equal(core(result).resolutionUntil, 0);
});

test('Righteous Instincts respects the shared Resolution duration cap and extension records', () => {
  const result = run([wait(32000)], { selectedTraitIds: [TRAIT.RIGHTEOUS_INSTINCTS] }, (runtime) => {
    boon(runtime, 'resolution', 0, 100);
    boon(runtime, 'resolution', 0.5, 100);
    runtime.emit({
      type: 'boon_extension',
      kind: 'resolution',
      at: 29,
      duration: 1,
      source: 'fixture',
      sourceId: 'fixture',
      actorType: 'player'
    });
  });
  assert.deepEqual(result.warnings, []);
  const times = result.events
    .filter((event) => event.type === 'buff' && event.sourceId === TRAIT.RIGHTEOUS_INSTINCTS)
    .map((event) => event.at);
  assert.equal(times.at(-1), 31);
  assert.equal(new Set(times).size, times.length);
  assert.equal(core(result).resolutionUntil, 0);
});

test('heal traits commit independently, retain party scope, and sample later boon pulses at application', () => {
  const config = {
    selectedTraitIds: [TRAIT.HEALERS_RESOLUTION, TRAIT.PROTECTORS_RESTORATION, TRAIT.VIRTUE_OF_RESOLUTION],
    weaponSet2Primary: 'Scepter',
    sigilSets: [{}, { boonDurationBonus: 20 }],
    allies: { count: 2 }
  };
  const canceled = run([{ skillId: ID.SHELTER, interruptAfterMs: 1 }, wait(3000)], config);
  assert.equal(core(canceled).healersResolutionReadyAt, 0);
  assert.equal(core(canceled).protectorsRestorationReadyAt, 0);
  const committed = run([ID.SHELTER, 'Swap Weapons', wait(2000)], config);
  assert.deepEqual(committed.warnings, []);
  assert.ok(core(committed).healersResolutionReadyAt > 0);
  assert.ok(core(committed).protectorsRestorationReadyAt > 0);
  const protection = committed.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.skillId === ID.LESSER_SYMBOL_OF_PROTECTION
  );
  assert.ok(protection.length > 1);
  assert.ok(protection.every((event) => event.resolvedAudience.alliedPlayerCount === 2));
  assert.equal(new Set(protection.map((event) => event.activationId)).size, 1);
  assert.notEqual(protection[0].activationId, committed.steps[0].activationId);
  assert.ok(protection.at(-1).duration > protection[0].duration);
  const resolution = committed.resolvedEvents.find(
    (event) => event.sourceId === TRAIT.HEALERS_RESOLUTION && event.type === 'buff'
  );
  const profile = guardianProfession.catalog.balanceProfilesById.get(PROFILE.healersResolution);
  assert.equal(resolution.duration, profile.effects.find((effect) => effect.type === 'boon').duration * 1.25);
});

test('Furious Focus claims symbol recharge once for a ready Justice activation', () => {
  const result = run([ID.JUSTICE, ID.RENEWED_FOCUS, ID.JUSTICE, wait(2000)], {
    selectedTraitIds: [TRAIT.FURIOUS_FOCUS]
  });
  assert.deepEqual(result.warnings, []);
  const pulses = result.events.filter(
    (event) => event.type === 'damage' && event.skillId === ID.LESSER_SYMBOL_OF_BLADES
  );
  assert.ok(pulses.length > 1);
  assert.equal(new Set(pulses.map((event) => event.activationId)).size, 1);
  assert.equal(core(result).furiousFocusRecharge.startedAt, 0);
  assert.notEqual(pulses[0].activationId, result.steps[0].activationId);
});

test('Symbol of Ignition claims independent projectile and nonprojectile cooldowns from accepted impacts', () => {
  const result = run([wait(1000)], {}, (runtime) => {
    runtime.profession.core.symbolIgnitionStartsAt = 0;
    runtime.profession.core.symbolIgnitionUntil = 0.98;
    strike(runtime, 0.5, { offTarget: true });
    strike(runtime, 0.5);
    strike(runtime, 0.5, { projectile: true });
    strike(runtime, 0.74);
    strike(runtime, 0.740001);
    strike(runtime, 0.98, { projectile: true });
    strike(runtime, 0.980001, { projectile: true });
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.skillId === ID.SYMBOL_OF_IGNITION)
      .map((event) => event.at),
    [0.5, 0.5, 0.740001, 0.98]
  );
});

test('committed ignition placement owns the field and cancellation cannot open its reaction window', () => {
  for (const canceled of [false, true]) {
    const result = run([canceled ? { skillId: ID.SYMBOL_OF_IGNITION, interruptAfterMs: 1 } : ID.SYMBOL_OF_IGNITION], {
      primaryWeapon: 'Pistol'
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(core(result).symbolIgnitionUntil > 0, !canceled);
    assert.equal(
      result.events.some((event) => event.type === 'combo_field'),
      !canceled
    );
  }
});

test('Writ and Consecration extensions keep cast ownership and do not survive an uncommitted attempt', () => {
  for (const [skill, trait, weapon] of [
    [ID.SYMBOL_OF_FAITH, TRAIT.WRIT_OF_PERSISTENCE, 'Mace'],
    [ID.PURGING_FLAMES, TRAIT.MASTER_OF_CONSECRATIONS, 'Scepter']
  ]) {
    const config = { primaryWeapon: weapon, selectedTraitIds: [trait] };
    const canceled = run([{ skillId: skill, interruptAfterMs: 1 }, wait(8000)], config);
    assert.equal(
      canceled.events.some((event) => event.type === 'combo_field'),
      false
    );
    assert.equal(
      canceled.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === skill),
      false
    );
    const result = run([skill, wait(8000)], config);
    assert.deepEqual(result.warnings, []);
    const field = result.events.find((event) => event.type === 'combo_field');
    const baseDuration = guardianProfession.catalog.skillsById.get(skill).comboFields[0].duration;
    assert.equal(
      field.expiresAt - field.at,
      trait === TRAIT.WRIT_OF_PERSISTENCE ? baseDuration + 2 : baseDuration * 1.4
    );
    const later = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === skill && event.at > field.at + baseDuration
    );
    assert.ok(later.length > 0);
    assert.ok(later.every((event) => event.activationId === result.steps[0].activationId));
  }
});

test('Furious Focus ignores transient Alacrity and keeps its exclusive deadline across rotation cooldown resets', () => {
  const result = run(
    [ID.JUSTICE, wait(8000), { type: 'cooldown-reset' }, ID.JUSTICE, wait(40), { type: 'cooldown-reset' }, ID.JUSTICE],
    { selectedTraitIds: [TRAIT.FURIOUS_FOCUS] },
    (runtime) => boon(runtime, 'alacrity', 1, 4)
  );
  assert.deepEqual(result.warnings, []);
  const starts = result.events.filter(
    (event) => event.type === 'damage' && event.skillId === ID.LESSER_SYMBOL_OF_BLADES && event.hitIndex === 1
  );
  assert.deepEqual(
    starts.map((event) => event.at),
    [0, 8.04]
  );
  assert.equal(core(result).furiousFocusRecharge.startedAt, 8.04);
});

test('removed trait components neither claim heal cooldowns nor start recurring Might work', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'removed-guardian-traits',
    label: 'Removed Guardian traits',
    professions: {
      guardian: {
        balanceProfiles: {
          [PROFILE.healersResolution]: { removeEffects: [{ type: 'boon', all: true }] },
          [PROFILE.protectorsRestoration]: {
            removeEffects: [
              { type: 'strike', all: true },
              { type: 'boon', all: true }
            ]
          },
          [PROFILE.righteousInstincts]: { removeEffects: [{ type: 'boon', all: true }] }
        }
      }
    }
  });
  const result = run(
    [ID.SHELTER, wait(3000)],
    {
      patchId: 'removed-guardian-traits',
      selectedTraitIds: [TRAIT.HEALERS_RESOLUTION, TRAIT.PROTECTORS_RESTORATION, TRAIT.RIGHTEOUS_INSTINCTS]
    },
    (runtime) => boon(runtime, 'resolution', 0, 2),
    patched
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(core(result).healersResolutionReadyAt, 0);
  assert.equal(core(result).protectorsRestorationReadyAt, 0);
  assert.equal(
    result.events.some((event) => event.sourceId === TRAIT.RIGHTEOUS_INSTINCTS),
    false
  );
  assert.equal(core(result).resolutionUntil, 0);
});

test('Guardian trait execution agrees between score and detailed output', () => {
  const config = {
    selectedTraitIds: [
      TRAIT.FURIOUS_FOCUS,
      TRAIT.SYMBOLIC_AVENGER,
      TRAIT.SYMBOLIC_EXPOSURE,
      TRAIT.VIRTUE_OF_RESOLUTION,
      TRAIT.RIGHTEOUS_INSTINCTS
    ]
  };
  const rotation = [ID.JUSTICE, wait(6000)];
  const detailed = run(rotation, config);
  const score = run(rotation, config, () => {}, guardianProfession, 'score');
  assert.deepEqual(detailed.warnings, []);
  assert.deepEqual(score.warnings, []);
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.deepEqual(core(score).symbolicAvengerExpirations, core(detailed).symbolicAvengerExpirations);
  assert.equal(core(score).justiceHitCount, core(detailed).justiceHitCount);
});

test('missed Symbol of Resolution pulses still grant self boons without target-hit trait rewards', () => {
  const result = run([{ skillId: ID.SYMBOL_OF_RESOLUTION, offTarget: true }, wait(2000)], {
    primaryWeapon: 'Greatsword',
    selectedTraitIds: [TRAIT.VIRTUE_OF_RESOLUTION, TRAIT.SYMBOLIC_EXPOSURE, TRAIT.SYMBOLIC_AVENGER]
  });
  assert.deepEqual(result.warnings, []);
  const resolution = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'resolution');
  assert.ok(resolution.length > 0);
  assert.ok(
    resolution.every((event) => event.duration === 1.25 && event.activationId === result.steps[0].activationId)
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === TRAIT.SYMBOLIC_EXPOSURE),
    false
  );
  assert.deepEqual(core(result).symbolicAvengerExpirations, []);
});

const dragonhunter = { specialization: 'Dragonhunter' };
const dh = (result) => observedRuntime(result).profession.specialization.state;

test('Dragonhunter misses cannot attach a tether or arm Verdict, while commitment still disables the passive', () => {
  const result = run([{ skillId: ID.SPEAR_OF_JUSTICE, offTarget: true }, wait(2000)], dragonhunter);
  assert.deepEqual(result.warnings, []);
  assert.equal(dh(result).tetherUntil, 0);
  assert.equal(core(result).availableFlips[ID.HUNTERS_VERDICT], undefined);
  assert.ok(core(result).virtueReadyAt.justice > observedRuntime(result).time);
  assert.equal(
    result.resolvedEvents.some((event) => event.name === 'Spear of Justice — Active Burning'),
    false
  );
});

test('Dragonhunter tether waits for a delayed impact and its burn retains the spear activation', () => {
  const rotation = [{ skillId: ID.SPEAR_OF_JUSTICE, impactDelayMs: 1000 }];
  const before = run(rotation, dragonhunter);
  assert.equal(dh(before).tetherUntil, 0);
  assert.equal(core(before).availableFlips[ID.HUNTERS_VERDICT], undefined);
  const after = run([...rotation, wait(1500)], dragonhunter);
  assert.deepEqual(after.warnings, []);
  const hit = after.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.SPEAR_OF_JUSTICE);
  const burn = after.resolvedEvents.find((event) => event.name === 'Spear of Justice — Active Burning');
  assert.equal(burn.at, hit.at);
  assert.equal(burn.activationId, hit.activationId);
  assert.equal(dh(after).tetherUntil, hit.at + 6);
  assert.equal(core(after).availableFlips[ID.HUNTERS_VERDICT].expiresAt, dh(after).tetherUntil);
});

test('Verdict consumes its occurrence and stops subsequent tether work', () => {
  const result = run([ID.SPEAR_OF_JUSTICE, ID.HUNTERS_VERDICT, wait(3000)], dragonhunter);
  assert.deepEqual(result.warnings, []);
  const verdict = result.steps.find((step) => step.skillId === ID.HUNTERS_VERDICT);
  const burns = result.resolvedEvents.filter((event) => event.name === 'Spear of Justice — Active Burning');
  assert.ok(burns.length > 0);
  assert.ok(burns.every((event) => event.at <= verdict.end / 1000));
  assert.equal(core(result).availableFlips[ID.HUNTERS_VERDICT], undefined);
  assert.equal(dh(result).tetherUntil, 0);
});

test('Dragonhunter tether expiry and replacement invalidate old burns and flip wakes', () => {
  const expired = run([ID.SPEAR_OF_JUSTICE, wait(7000)], dragonhunter);
  assert.deepEqual(expired.warnings, []);
  assert.equal(dh(expired).tetherUntil, 0);
  assert.equal(core(expired).availableFlips[ID.HUNTERS_VERDICT], undefined);
  const replaced = run(
    [ID.SPEAR_OF_JUSTICE, wait(1000), { type: 'cooldown-reset' }, ID.SPEAR_OF_JUSTICE, wait(4800)],
    dragonhunter
  );
  assert.deepEqual(replaced.warnings, []);
  const spearSteps = replaced.steps.filter((step) => step.skillId === ID.SPEAR_OF_JUSTICE);
  const newest = spearSteps.at(-1);
  assert.equal(dh(replaced).tetherActivationId, newest.activationId);
  assert.ok(dh(replaced).tetherUntil > observedRuntime(replaced).time);
  const later = replaced.resolvedEvents.filter(
    (event) => event.name === 'Spear of Justice — Active Burning' && event.at > newest.end / 1000
  );
  assert.ok(later.length > 0);
  assert.ok(later.every((event) => event.activationId === newest.activationId));
  assert.ok(core(replaced).availableFlips[ID.HUNTERS_VERDICT]);
});

test('Dragonhunter Furious Focus lands before tether amplification and preserves one activation through later pulses', () => {
  const config = {
    ...dragonhunter,
    selectedTraitIds: [TRAIT.FURIOUS_FOCUS, TRAIT.BIG_GAME_HUNTER, TRAIT.INSPIRED_VIRTUE]
  };
  const result = run([ID.SPEAR_OF_JUSTICE, wait(2000)], config);
  assert.deepEqual(result.warnings, []);
  const pulses = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.LESSER_SYMBOL_OF_BLADES
  );
  const spear = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.SPEAR_OF_JUSTICE);
  assert.ok(pulses[0].at < spear.at);
  assert.equal(new Set(pulses.map((event) => event.activationId)).size, 1);
  assert.ok(pulses[1].damage > pulses[0].damage);
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.INSPIRED_VIRTUE).length,
    1
  );
  const canceled = run([{ skillId: ID.SPEAR_OF_JUSTICE, interruptAfterMs: 1 }, wait(2000)], config);
  assert.equal(
    canceled.events.some((event) => event.skillId === ID.LESSER_SYMBOL_OF_BLADES),
    false
  );
  assert.equal(dh(canceled).tetherUntil, 0);
});

test('Dragonhunter passive Courage preserves its cadence while actual recharge suppresses pulses', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'fast-courage',
    label: 'Fast Courage',
    professions: {
      guardian: {
        skills: {
          [ID.SHIELD_OF_COURAGE]: {
            fields: {
              cooldown: { from: guardianProfession.catalog.skillsById.get(ID.SHIELD_OF_COURAGE).cooldown, to: 3 }
            }
          }
        },
        balanceProfiles: { [DH_PROFILE.passiveCourage]: { fields: { pulseInterval: { from: 40, to: 1 } } } }
      }
    }
  });
  const result = run(
    [wait(100), ID.SHIELD_OF_COURAGE, wait(5000)],
    { ...dragonhunter, patchId: 'fast-courage' },
    () => {},
    patched
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events.filter((event) => event.name === 'Shield of Courage — Passive Aegis').map((event) => event.at),
    [0, 3, 4, 5]
  );
});

test('Dragonhunter control traits exclude summon controls and retain accepted control attribution', () => {
  const result = run(
    [wait(2000)],
    { ...dragonhunter, selectedTraitIds: [TRAIT.DULLED_SENSES, TRAIT.HEAVY_LIGHT] },
    (runtime) => {
      for (const [at, actorType] of [
        [0.1, 'summon'],
        [0.2, 'player'],
        [0.2, 'player'],
        [1.2, 'player'],
        [1.200001, 'player']
      ])
        runtime.emit({
          type: 'control',
          controlKind: 'pull',
          at,
          actorType,
          source: 'fixture',
          sourceId: 'fixture',
          activationId: `control-${at}`
        });
    }
  );
  assert.deepEqual(result.warnings, []);
  const stability = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.HEAVY_LIGHT
  );
  assert.deepEqual(
    stability.map((event) => event.at),
    [0.2, 1.200001]
  );
  assert.equal(stability[0].activationId, 'control-0.2');
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === TRAIT.DULLED_SENSES && event.at === 0.1),
    false
  );
});

test('Dragonhunter trap and elite completion traits reject canceled attempts and preserve selected grants', () => {
  const config = {
    ...dragonhunter,
    initialEndurance: 0,
    selectedTraitIds: [TRAIT.HUNTERS_PREMONITION, TRAIT.HUNTERS_DETERMINATION]
  };
  const canceled = run([{ skillId: ID.DRAGONS_MAW, interruptAfterMs: 1 }], config);
  assert.equal(core(canceled).endurance, 0);
  assert.equal(
    canceled.events.some((event) => event.kind === 'aegis' && event.skillId === ID.DRAGONS_MAW),
    false
  );
  const complete = run([ID.DRAGONS_MAW], config);
  assert.deepEqual(complete.warnings, []);
  assert.equal(core(complete).endurance, 100);
  const aegis = complete.resolvedEvents.find((event) => event.kind === 'aegis' && event.skillId === ID.DRAGONS_MAW);
  assert.equal(aegis.activationId, complete.steps[0].activationId);
});

test('Dragonhunter passive Justice consumes only accepted hit cycles and Renewed Focus restores it', () => {
  const initialize = (runtime) => {
    for (const at of [0.1, 0.2, 0.3]) strike(runtime, at);
    strike(runtime, 0.4, { offTarget: true });
    strike(runtime, 0.5, { actorType: 'summon' });
  };

  const config = { ...dragonhunter, selectedTraitIds: [TRAIT.PERMEATING_WRATH] };
  const passive = run([wait(600)], config, initialize);
  assert.equal(core(passive).justicePassiveBurns, 1);
  const cripple = passive.resolvedEvents.find((event) => event.name === 'Spear of Justice — Passive Crippled');
  assert.equal(cripple.activationId, 'impact-0.3');
  const rotation = [ID.SPEAR_OF_JUSTICE, ID.RENEWED_FOCUS, wait(1000)];
  const refreshEnd = run(rotation, config).steps.find((step) => step.skillId === ID.RENEWED_FOCUS).end / 1000;
  const refreshed = run(rotation, config, (runtime) => {
    for (const offset of [0.1, 0.2, 0.3]) strike(runtime, refreshEnd + offset);
  });
  assert.deepEqual(refreshed.warnings, []);
  assert.equal(core(refreshed).justicePassiveBurns, 1);
  assert.equal(core(refreshed).justiceActiveArmed, false);
});

test('Soaring Devastation uses the selected weapon set and survives removal of its sibling condition', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'soaring-strike-only',
    label: 'Soaring strike only',
    professions: {
      guardian: {
        balanceProfiles: { [DH_PROFILE.soaringDevastation]: { removeEffects: [{ type: 'condition', all: true }] } }
      }
    }
  });
  const result = run(
    ['Swap Weapons', ID.WINGS_OF_RESOLVE],
    {
      ...dragonhunter,
      primaryWeapon: 'Scepter',
      weaponSet2Primary: 'Greatsword',
      selectedTraitIds: [TRAIT.SOARING_DEVASTATION],
      patchId: 'soaring-strike-only'
    },
    () => {},
    patched
  );
  assert.deepEqual(result.warnings, []);
  const impact = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.WINGS_OF_RESOLVE
  );
  assert.equal(impact.skillWeapon, 'Greatsword');
  assert.equal(impact.activationId, result.steps.find((step) => step.skillId === ID.WINGS_OF_RESOLVE).activationId);
  assert.equal(
    result.resolvedEvents.some((event) => event.condition === 'Immobilized'),
    false
  );
});

test('removed Dragonhunter burn and passive packets leave no recurring effects while preserving the tether', () => {
  const patched = withPatchPreview(guardianProfession, {
    id: 'dragonhunter-no-pulses',
    label: 'Dragonhunter no pulses',
    professions: {
      guardian: {
        balanceProfiles: {
          [DH_PROFILE.tether]: { removeEffects: [{ type: 'condition', name: 'Burning' }] },
          [DH_PROFILE.passiveCourage]: { removeEffects: [{ type: 'boon', all: true }] }
        }
      }
    }
  });
  const result = run(
    [ID.SPEAR_OF_JUSTICE, wait(2000)],
    { ...dragonhunter, patchId: 'dragonhunter-no-pulses' },
    () => {},
    patched
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(dh(result).tetherUntil > observedRuntime(result).time);
  assert.equal(
    result.resolvedEvents.some((event) => event.name === 'Spear of Justice — Active Burning'),
    false
  );
  assert.equal(
    result.events.some((event) => event.name === 'Shield of Courage — Passive Aegis'),
    false
  );
});

test('Dragonhunter rejects post-death attachment and shares tether execution in detailed and score modes', () => {
  const killed = run(
    [ID.SPEAR_OF_JUSTICE, wait(1000)],
    { ...dragonhunter, target: { armor: 2597, health: 1 } },
    (runtime) => strike(runtime, 0.1)
  );
  assert.equal(dh(killed).tetherUntil, 0);
  assert.equal(core(killed).availableFlips[ID.HUNTERS_VERDICT], undefined);
  const config = {
    ...dragonhunter,
    selectedTraitIds: [TRAIT.BIG_GAME_HUNTER, TRAIT.FURIOUS_FOCUS, TRAIT.DULLED_SENSES]
  };
  const rotation = [ID.SPEAR_OF_JUSTICE, wait(1500), ID.HUNTERS_VERDICT, wait(1000)];
  const detailed = run(rotation, config);
  const score = run(rotation, config, () => {}, guardianProfession, 'score');
  assert.deepEqual(detailed.warnings, []);
  assert.deepEqual(score.warnings, []);
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.equal(dh(score).tetherUntil, dh(detailed).tetherUntil);
});
