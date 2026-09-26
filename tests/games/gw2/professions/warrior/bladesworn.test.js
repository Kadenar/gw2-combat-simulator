import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { dragonChargeReleaseProjection } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/charge-release.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Exercise the registered family with one live Core and specialization owner.
function run(rotation, overrides = {}, source = warriorProfession, output = 'detailed') {
  const config = {
    specialization: 'Bladesworn',
    primaryWeapon: 'Axe',
    initialResource: 0,
    selectedTraitIds: [],
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 },
    ...overrides
  };
  return observeGw2Runtime({ profession: source.runtimeFor(config), config, rotation, output });
}

const wait = (durationMs) => ({ type: 'wait', durationMs });
const combat = { type: 'combat-start' };
const slash = (charges, extra = {}) => ({ skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: charges, ...extra });
const state = (result) => observedRuntime(result).profession.specialization.state;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('Flow waits for accepted combat and preserves the absolute 40 ms cadence', () => {
  close(state(run([wait(1000), combat])).flow, 0);
  close(state(run([wait(39), combat, wait(1)])).flow, 0.08);
  close(state(run([wait(40), combat])).flow, 0);
  close(state(run([wait(40), combat, wait(40)])).flow, 0.08);
  close(state(run([combat, wait(119)])).flow, 0.16);
  close(state(run([combat, wait(120)])).flow, 0.24);
});

test('precombat control leaves base Flow inactive in execution and presentation until the marker', () => {
  // The control notification is observable during preparation, but cannot start base Flow recovery.
  const result = run(['Kick', wait(1000), combat], { selectedSkills: ['Kick'] });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'control' && event.at < result.combatStartTime),
    true
  );
  close(state(result).flow, 0);
  for (const [atSeconds, value] of [
    [result.combatStartTime - 0.001, '0 stacks'],
    [result.combatStartTime, '1 stack']
  ]) {
    const display = warriorProfession.ui.rotationStateSnapshot({
      specialization: 'Bladesworn',
      professionState: result.planningState.profession,
      atSeconds,
      result
    });
    assert.equal(display.find((item) => item.id === 'positive-flow').value, value);
  }
});

test('Flow Stabilizer requires preexisting Fury and overlapping windows add independently', () => {
  const config = { selectedSkills: ['Flow Stabilizer'] };
  close(state(run(['Flow Stabilizer'], config)).flow, 0);
  close(state(run(['Flow Stabilizer'], { ...config, boons: { fury: true } })).flow, 15);
  const result = run(['Flow Stabilizer', wait(1000), 'Flow Stabilizer', wait(1000), combat], config);
  assert.deepEqual(result.warnings, []);
  close(state(result).flow, 27);
  assert.equal(state(result).flowStabilizerWindows.length, 2);
});

test('Positive Flow works before combat and grants its final tick before its window expires', () => {
  const config = { selectedSkills: ['Flow Stabilizer'] };
  for (const duration of [8000, 8040]) {
    const result = run(['Flow Stabilizer', wait(duration), combat], config);
    assert.deepEqual(result.warnings, []);
    close(state(result).flow, 32);
    assert.deepEqual(state(result).flowStabilizerWindows, []);
  }

  const offGrid = run([wait(1), 'Flow Stabilizer', wait(8039), combat], config);
  close(state(offGrid).flow, 32.16);
});

test('Bladesworn redirects trait and signet grants while ordinary hits produce no Flow', () => {
  const bare = run(['Chop']);
  const trained = run(['Chop'], { selectedTraitIds: [TRAIT.AXE_MASTERY], stats: { power: 2000, precision: 4000 } });
  const critical = run(['Chop'], { stats: { power: 2000, precision: 4000 } });
  assert.deepEqual(bare.warnings, []);
  const owner = observedRuntime(bare);
  close(state(bare).flow, (Math.floor(owner.time * 25) - Math.floor(owner.firstHitTime * 25)) * 0.08);
  close(state(trained).flow - state(critical).flow, 2);
  const signet = run([combat, wait(3000)], { selectedSkills: ['Signet of Rage'] });
  close(state(signet).flow, 8);
  assert.equal(signet.planningState.profession.adrenaline, 0);
  assert.equal(signet.planningState.profession.maximumAdrenaline, 0);
});

test('Flow caps use the selected profile and detailed and score runs share the same resource owner', () => {
  const patched = withPatchPreview(warriorProfession, {
    id: 'flow-cap',
    label: 'Flow cap',
    professions: {
      warrior: { balanceProfiles: { [PROFILE.resources]: { fields: { maximumStacks: { from: 100, to: 7 } } } } }
    }
  });
  for (const output of ['detailed', 'score']) {
    const result = run([combat, wait(1000)], { initialResource: 100, patchId: 'flow-cap' }, patched, output);
    close(state(result).flow, 7);
    assert.equal(state(result).maximumFlow, 7);
  }
});

test('removing Positive Flow suppresses regeneration independently of the conditional instant grant', () => {
  const patched = withPatchPreview(warriorProfession, {
    id: 'flow-removed',
    label: 'Positive Flow removed',
    professions: { warrior: { skills: { [ID.FLOW_STABILIZER]: { removeEffects: [{ type: 'buff' }] } } } }
  });
  const result = run(
    ['Flow Stabilizer', wait(1000), combat],
    { patchId: 'flow-removed', selectedSkills: ['Flow Stabilizer'], boons: { fury: true } },
    patched
  );
  assert.deepEqual(result.warnings, []);
  close(state(result).flow, 15);
  assert.deepEqual(state(result).flowStabilizerWindows, []);
});

test('Gunsaber transitions share recharge, reset chains, and retain the configured weapon set', () => {
  const result = run(['Chop', 'Unsheathe Gunsaber', 'Swift Cut', 'Sheathe Gunsaber', 'Unsheathe Gunsaber']);
  assert.deepEqual(result.warnings, []);
  const owner = observedRuntime(result);
  const swaps = result.events.filter((event) => event.type === 'sigil_swap');
  assert.equal(swaps.length, 3);
  close(swaps[1].at - swaps[0].at, 5);
  close(swaps[2].at - swaps[1].at, 5);
  assert.equal(owner.activeWeaponSet, 1);
  assert.equal(state(result).gunsaberActive, true);
  assert.deepEqual(owner.profession.core.autoattackChains, {});
  assert.equal(owner.cooldowns.get(ID.UNSHEATHE_GUNSABER), owner.cooldowns.get(ID.SHEATHE_GUNSABER));
});

test('Gunsaber gates standard weapons, ordinary swaps, weapon bursts, and unavailable bundle actions', () => {
  for (const rotation of [
    ['Swift Cut'],
    ['Sheathe Gunsaber'],
    ['Unsheathe Gunsaber', 'Chop'],
    ['Unsheathe Gunsaber', 'Unsheathe Gunsaber'],
    ['Swap Weapons'],
    ['Eviscerate'],
    [{ skillId: ID.DRAGON_SLASH_FORCE }]
  ]) {
    const result = run(rotation);
    assert.equal(result.warnings.length, 1, rotation.join(', '));
    assert.ok(!result.warnings[0].includes('Unknown skill'));
    assert.equal(observedRuntime(result).activeWeaponSet, 1);
  }
});

test('Sharp as the Wind resolves either action identity before chain checks and records the selected skill', () => {
  for (const sharp of [false, true]) {
    const result = run(
      [
        'Unsheathe Gunsaber',
        { skillId: ID.SWIFT_CUT },
        { skillId: ID.SHARP_STEEL_DIVIDE },
        { skillId: ID.EXPLOSIVE_THRUST }
      ],
      { selectedTraitIds: sharp ? [TRAIT.SHARP_AS_THE_WIND] : [] }
    );
    assert.deepEqual(result.warnings, []);
    const expected = sharp
      ? [ID.SHARP_SWIFT_CUT, ID.SHARP_STEEL_DIVIDE, ID.SHARP_EXPLOSIVE_THRUST]
      : [ID.SWIFT_CUT, ID.STEEL_DIVIDE, ID.EXPLOSIVE_THRUST];
    assert.deepEqual(
      observedRuntime(result)
        .steps.filter((step) => expected.includes(step.skillId))
        .map((step) => step.skillId),
      expected
    );
    assert.deepEqual(observedRuntime(result).profession.core.autoattackChains, {});
  }
});

test('Gunsaber entry traits respect actual combat and explicit precombat does not consume their cooldown', () => {
  for (const trait of [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND, TRAIT.RIVERS_FLOW]) {
    const result = run(['Unsheathe Gunsaber', combat], { selectedTraitIds: [trait] });
    assert.equal(state(result).gunsaberSwapTraitReadyAt, 0);
    assert.equal(state(result).traitPositiveFlowUntil, 0);
  }

  const idle = run(['Unsheathe Gunsaber'], { selectedTraitIds: [TRAIT.UNSEEN_SWORD] });
  assert.equal(idle.totalDamage, 0);
  const active = run([combat, 'Unsheathe Gunsaber', wait(5000)], { selectedTraitIds: [TRAIT.UNSEEN_SWORD] });
  assert.deepEqual(active.warnings, []);
  assert.ok(active.resolvedEvents.some((event) => event.sourceId === TRAIT.UNSEEN_SWORD && event.type === 'damage'));
  close(state(active).flow, 30);
  assert.equal(state(active).traitPositiveFlowUntil, 0);
});

test('Gunsaber entry grants the selected party boon and resets Martial Cadence without ordinary swap rewards', () => {
  const result = run([combat, 'Unsheathe Gunsaber', wait(1000), 'Sheathe Gunsaber'], {
    allies: { count: 4 },
    selectedTraitIds: [TRAIT.RIVERS_FLOW, TRAIT.MARTIAL_CADENCE, TRAIT.VERSATILE_RAGE, TRAIT.FURIOUS_BURST]
  });
  assert.deepEqual(result.warnings, []);
  const might = result.events.find(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.RIVERS_FLOW && event.kind === 'might'
  );
  assert.equal(might.resolvedAudience.includesSelf, true);
  assert.equal(might.resolvedAudience.alliedPlayerCount, 4);
  close(state(result).flow, 30);
  close(observedRuntime(result).profession.core.soldierFocusReadyAt, 5);
  assert.equal(
    result.events.some((event) => event.sourceId === TRAIT.FURIOUS_BURST),
    false
  );
});

test('removed Gunsaber entry components keep their other effects independent', () => {
  for (const removed of ['strike', 'buff']) {
    const patched = withPatchPreview(warriorProfession, {
      id: `entry-${removed}`,
      label: 'Entry component removal',
      professions: { warrior: { balanceProfiles: { [TRAIT.UNSEEN_SWORD]: { removeEffects: [{ type: removed }] } } } }
    });
    const result = run(
      [combat, 'Unsheathe Gunsaber', wait(1000)],
      { patchId: `entry-${removed}`, selectedTraitIds: [TRAIT.UNSEEN_SWORD] },
      patched
    );
    assert.deepEqual(result.warnings, []);
    close(state(result).flow, removed === 'strike' ? 6 : 2);
    assert.equal(result.totalDamage > 0, removed !== 'strike');
    assert.equal(state(result).gunsaberSwapTraitReadyAt, 4);
  }
});

test('Gunsaber entry cooldown is exclusive and a later accepted entry refreshes the existing Flow window', () => {
  const patched = withPatchPreview(warriorProfession, {
    id: 'instant-gunsaber',
    label: 'Instant Gunsaber recharge',
    professions: {
      warrior: {
        skills: {
          [ID.UNSHEATHE_GUNSABER]: { fields: { cooldown: { from: 5, to: 0 } } },
          [ID.SHEATHE_GUNSABER]: { fields: { cooldown: { from: 5, to: 0 } } }
        }
      }
    }
  });
  const config = { patchId: 'instant-gunsaber', selectedTraitIds: [TRAIT.UNSEEN_SWORD] };
  const rotation = [combat, 'Unsheathe Gunsaber', wait(4000), 'Sheathe Gunsaber', 'Unsheathe Gunsaber'];
  const boundary = run(rotation, config, patched);
  assert.deepEqual(boundary.warnings, []);
  assert.equal(state(boundary).traitPositiveFlowUntil, 5);
  const later = run([...rotation, wait(40), 'Sheathe Gunsaber', 'Unsheathe Gunsaber'], config, patched);
  assert.deepEqual(later.warnings, []);
  close(state(later).traitPositiveFlowUntil, 9.04);
  assert.equal(state(later).traitPositiveFlowStartedAt, 0);
});

test('Dragon Trigger spends entry Flow once and owns actual charge ticks without starting recharge', () => {
  const result = run(['Dragon Trigger', wait(480), combat], { initialResource: 25 });
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).gunsaberActive, true);
  assert.equal(state(result).dragonTriggerActive, true);
  assert.equal(state(result).dragonCharges, 2);
  close(state(result).flow, 5);
  close(state(result).dragonTriggerFlowSpent, 5);
  assert.equal(observedRuntime(result).cooldowns.has(ID.DRAGON_TRIGGER), false);
  const ticks = result.events.filter((event) => event.reason === 'dragon trigger charge');
  assert.deepEqual(
    ticks.map((event) => [event.at, event.flowSpent]),
    [
      [0.24, 0],
      [0.48, 5]
    ]
  );
  assert.equal(
    observedRuntime(result).cooldowns.get(ID.UNSHEATHE_GUNSABER),
    observedRuntime(result).cooldowns.get(ID.SHEATHE_GUNSABER)
  );
  const insufficient = run(['Dragon Trigger'], { initialResource: 14 });
  assert.ok(insufficient.warnings[0].includes('15 flow'));
  assert.equal(state(insufficient).gunsaberActive, false);
  assert.equal(state(insufficient).flow, 14);
});

test('a stalled charge waits for actual Positive Flow and a slash releases at the first affordable tick', () => {
  const result = run(['Dragon Trigger', wait(480), 'Flow Stabilizer', slash(2), combat], {
    initialResource: 15,
    selectedSkills: ['Flow Stabilizer']
  });
  assert.deepEqual(result.warnings, []);
  const release = result.events.find(
    (event) => event.reason === 'profession mechanic' && event.resource === 'dragon charges'
  );
  close(release.at, 1.92);
  close(release.flowSpent, 5);
  assert.equal(release.chargesReached, 2);
  assert.ok(result.events.some((event) => event.reason === 'dragon trigger charge' && !event.granted));
  assert.equal(state(result).dragonTriggerActive, false);
  assert.ok(observedRuntime(result).cooldowns.get(ID.DRAGON_TRIGGER) > release.at);
});

test('Dragon Trigger admits its exact deadline then expires autonomously and stale ticks cannot revive it', () => {
  const patched = withPatchPreview(warriorProfession, {
    id: 'short-trigger',
    label: 'Short charge deadline',
    professions: {
      warrior: { balanceProfiles: { [PROFILE.dragonTrigger]: { fields: { cooldown: { from: 30, to: 0.48 } } } } }
    }
  });
  const config = { patchId: 'short-trigger', initialResource: 20 };
  const released = run(['Dragon Trigger', slash(2), combat], config, patched);
  assert.deepEqual(released.warnings, []);
  close(released.events.find((event) => event.reason === 'profession mechanic').at, 0.48);
  const expired = run(['Dragon Trigger', wait(481), combat], config, patched);
  assert.equal(state(expired).dragonTriggerActive, false);
  assert.equal(state(expired).dragonCharges, 0);
  assert.equal(state(expired).nextDragonChargeAt, 0);
  assert.equal(observedRuntime(expired).rechargeProgress.get(ID.DRAGON_TRIGGER).startedAt, 0.48);
  const stalled = run(['Dragon Trigger', slash(3), combat], config, patched);
  assert.ok(stalled.warnings.some((warning) => warning.includes('reached 2')));
});

test('cast-bar skills exit charging at acceptance, while instant skills retain the active charge window', () => {
  const instant = run(['Dragon Trigger', 'Flow Stabilizer', wait(480), combat], {
    initialResource: 30,
    selectedSkills: ['Flow Stabilizer']
  });
  assert.deepEqual(instant.warnings, []);
  assert.equal(state(instant).dragonTriggerActive, true);
  assert.equal(state(instant).dragonCharges, 2);
  const exited = run(
    ['Dragon Trigger', wait(240), { name: 'Combat Stimulant', interruptAfterMs: 1 }, wait(500), combat],
    {
      initialResource: 30,
      selectedSkills: ['Combat Stimulant']
    }
  );
  assert.deepEqual(exited.warnings, []);
  assert.equal(state(exited).dragonTriggerActive, false);
  close(state(exited).flow, 15);
  assert.equal(exited.events.filter((event) => event.reason === 'dragon trigger charge').length, 1);
  close(observedRuntime(exited).rechargeProgress.get(ID.DRAGON_TRIGGER).startedAt, 0.24);
});

test('Dragon Slash captures its tier and refunds only charge Flow after successful completion', () => {
  const config = { initialResource: 100, selectedTraitIds: [TRAIT.BURST_MASTERY, TRAIT.BERSERKERS_POWER] };
  const result = run([combat, 'Dragon Trigger', slash(10)], config);
  assert.deepEqual(result.warnings, []);
  const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.DRAGON_SLASH_FORCE);
  assert.equal(hit.metadata.warriorAdrenalineSpent, 30);
  assert.equal(hit.metadata.warriorBurstTier, 3);
  const power = result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.BERSERKERS_POWER);
  assert.equal(power.length, 1);
  assert.equal(power[0].stacks, 4);
  assert.ok(power[0].at > hit.at);
  const bare = run([combat, 'Dragon Trigger', slash(10)], { initialResource: 100 });
  close(state(result).flow - state(bare).flow, 9);
  const canceled = run([combat, 'Dragon Trigger', slash(2, { interruptAfterMs: 1 })], config);
  assert.deepEqual(canceled.warnings, []);
  assert.equal(canceled.totalDamage, 0);
  assert.equal(state(canceled).dragonTriggerActive, false);
  assert.equal(
    canceled.events.some(
      (event) => event.sourceId === TRAIT.BURST_MASTERY || event.sourceId === TRAIT.BERSERKERS_POWER
    ),
    false
  );
  close(state(canceled).flow, 100 - 15 - 5 + 0.48 * 2);
});

test('Daring Dragon changes actual charge cost/cap and completion boons while Sharp Slash keeps condition ownership', () => {
  const result = run([combat, 'Dragon Trigger', slash(10)], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DARING_DRAGON, TRAIT.SHARP_AS_THE_WIND, TRAIT.DRAGONSCALE_DEFENSE],
    allies: { count: 4 }
  });
  assert.deepEqual(result.warnings, []);
  const release = result.events.find((event) => event.reason === 'profession mechanic');
  assert.equal(release.chargesReached, 5);
  assert.equal(release.flowSpent, 40);
  const slashHit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.SHARP_DRAGON_SLASH_FORCE
  );
  assert.equal(slashHit.metadata.warriorAdrenalineSpent, 20);
  const burning = result.events.filter(
    (event) => event.type === 'condition' && event.skillId === ID.SHARP_DRAGON_SLASH_FORCE
  );
  assert.ok(burning.length > 0);
  assert.ok(burning.every((event) => event.actorType === 'player'));
  const alacrity = result.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.DARING_DRAGON);
  assert.equal(alacrity.resolvedAudience.alliedPlayerCount, 4);
  assert.ok(result.events.some((event) => event.type === 'buff' && event.sourceId === TRAIT.DRAGONSCALE_DEFENSE));
  for (const offTarget of [false, true]) {
    const controlled = run([combat, 'Dragon Trigger', slash(1, { offTarget })], {
      initialResource: 100,
      selectedTraitIds: [TRAIT.UNYIELDING_DRAGON]
    });
    assert.deepEqual(controlled.warnings, []);
    assert.equal(
      controlled.events.some(
        (event) => event.type === 'control' && !event.offTarget && event.sourceId === TRAIT.UNYIELDING_DRAGON
      ),
      !offTarget
    );
  }
});

test('Tactical Reload restores existing ammunition and doubles charges only for the next Dragon Trigger entry', () => {
  const result = run(['Flow Stabilizer', 'Tactical Reload', 'Dragon Trigger', slash(10), combat], {
    initialResource: 100,
    selectedSkills: ['Flow Stabilizer', 'Tactical Reload']
  });
  assert.deepEqual(result.warnings, []);
  const ammo = observedRuntime(result).ammo.get(ID.FLOW_STABILIZER);
  assert.equal(ammo.charges, ammo.maximum);
  assert.equal(state(result).tacticalReloadUntil, 0);
  const ticks = result.events.filter((event) => event.reason === 'dragon trigger charge');
  assert.deepEqual(
    ticks.map((event) => event.value),
    [2, 4, 6, 8, 10]
  );
  assert.equal(result.events.find((event) => event.reason === 'profession mechanic').flowSpent, 20);
});

test('Dragonspike resets exit recharge and an old expiry cannot close a replacement charge window', () => {
  const result = run(['Dragon Trigger', slash(1), 'Dragonspike Mine', 'Dragon Trigger', wait(28500), combat], {
    initialResource: 100,
    selectedSkills: ['Dragonspike Mine']
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).dragonTriggerActive, true);
  assert.equal(state(result).dragonCharges, 10);
  const entries = result.events.filter((event) => event.reason === 'dragon trigger entry');
  assert.equal(entries.length, 2);
  assert.equal(state(result).dragonTriggerEventActivationId, entries[1].activationId);
  assert.ok(observedRuntime(result).time > entries[0].deadline);
  assert.ok(observedRuntime(result).time < entries[1].deadline);
  assert.equal(observedRuntime(result).cooldowns.has(ID.DRAGON_TRIGGER), false);
});

test('Tactical Reload can be consumed exactly at expiry and closes before a later entry', () => {
  for (const [delay, expected] of [
    [10000, 2],
    [10001, 1]
  ]) {
    const result = run(['Tactical Reload', wait(delay), 'Dragon Trigger', wait(240), combat], {
      initialResource: 100,
      selectedSkills: ['Tactical Reload']
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(state(result).dragonCharges, expected);
    assert.equal(state(result).tacticalReloadUntil, 0);
  }
});

test('Artillery Slash spends captured rounds once and successful ammunition traits use the same count', () => {
  for (const sharp of [false, true]) {
    const result = run(['Unsheathe Gunsaber', 'Artillery Slash'], {
      selectedTraitIds: [TRAIT.FIERCE_AS_FIRE, ...(sharp ? [TRAIT.SHARP_AS_THE_WIND] : [])]
    });
    assert.deepEqual(result.warnings, []);
    const id = sharp ? ID.SHARP_ARTILLERY_SLASH : ID.ARTILLERY_SLASH;
    assert.equal(observedRuntime(result).ammo.get(id).charges, 0);
    const grant = result.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.FIERCE_AS_FIRE);
    assert.equal(grant.stacks, 2);
    assert.equal(
      result.events.find((event) => event.type === 'control' && event.skillId === id).controlKind,
      sharp ? 'stun' : 'daze'
    );
  }

  const canceled = run(['Unsheathe Gunsaber', { name: 'Artillery Slash', interruptAfterMs: 1 }], {
    selectedTraitIds: [TRAIT.FIERCE_AS_FIRE]
  });
  assert.deepEqual(canceled.warnings, []);
  assert.equal(observedRuntime(canceled).ammo.get(ID.ARTILLERY_SLASH).charges, 0);
  assert.equal(canceled.totalDamage, 0);
  assert.equal(
    canceled.events.some((event) => event.sourceId === TRAIT.FIERCE_AS_FIRE),
    false
  );
  const roar = run(["Dragon's Roar"], { secondaryWeapon: 'Pistol', selectedTraitIds: [TRAIT.FIERCE_AS_FIRE] });
  assert.deepEqual(roar.warnings, []);
  assert.equal(
    roar.events.find((event) => event.type === 'buff' && event.sourceId === TRAIT.FIERCE_AS_FIRE).stacks,
    observedRuntime(roar).ammo.get(ID.DRAGONS_ROAR).maximum
  );
});

test('Lush Forest reduces current-bar recharge only and preserves the normal Artillery exclusion', () => {
  for (const gunsaber of [false, true]) {
    const rotation = ['Cyclone Axe', ...(gunsaber ? ['Unsheathe Gunsaber'] : []), 'Flow Stabilizer'];
    const config = { selectedSkills: ['Flow Stabilizer'] };
    const bare = run(rotation, config);
    const trained = run(rotation, { ...config, selectedTraitIds: [TRAIT.LUSH_FOREST] });
    assert.deepEqual(trained.warnings, []);
    close(
      observedRuntime(bare).cooldowns.get(ID.CYCLONE_AXE) - observedRuntime(trained).cooldowns.get(ID.CYCLONE_AXE),
      gunsaber ? 0 : 0.75
    );
  }

  const excluded = run(['Unsheathe Gunsaber', 'Artillery Slash'], { selectedTraitIds: [TRAIT.LUSH_FOREST] });
  assert.equal(
    excluded.procSteps.some((proc) => proc.skill === 'Lush Forest'),
    false
  );
});

test('cartridges activate on the queue, upgrade once, and expire without another action', () => {
  const config = { selectedSkills: ['Overcharged Cartridges'] };
  const once = run(['Overcharged Cartridges'], config);
  assert.deepEqual(once.warnings, []);
  const first = state(once).overchargedCartridgeWindows[0];
  assert.equal(first.supercharged, false);
  assert.ok(first.startedAt > 0);
  assert.ok(first.startedAt < once.rotationEndTime);
  const twice = run(['Overcharged Cartridges', 'Overcharged Cartridges'], config);
  const upgraded = state(twice).overchargedCartridgeWindows.at(-1);
  assert.equal(upgraded.supercharged, true);
  const thrice = run(
    ['Overcharged Cartridges', 'Overcharged Cartridges', { type: 'cooldown-reset' }, 'Overcharged Cartridges'],
    config
  );
  assert.equal(state(thrice).overchargedCartridgeWindows.at(-1).expiresAt, upgraded.expiresAt);
  const expired = run(['Overcharged Cartridges', wait(9000)], config);
  assert.deepEqual(state(expired).overchargedCartridgeWindows, []);
  const canceled = run([{ name: 'Overcharged Cartridges', interruptAfterMs: 1 }, wait(1000)], config);
  assert.deepEqual(state(canceled).overchargedCartridgeWindows, []);
});

test('only accepted explosions apply cartridge Burning and extend Guns and Glory after the triggering damage', () => {
  const config = { selectedSkills: ['Overcharged Cartridges'], selectedTraitIds: [TRAIT.GUNS_AND_GLORY] };
  const result = run(['Overcharged Cartridges', 'Unsheathe Gunsaber', 'Artillery Slash'], config);
  assert.deepEqual(result.warnings, []);
  assert.ok(state(result).gunsAndGloryUntil > observedRuntime(result).time);
  const burning = result.events.find(
    (event) => event.type === 'condition' && event.sourceId === ID.OVERCHARGED_CARTRIDGES
  );
  assert.equal(burning.ownerActorType, 'player');
  assert.equal(burning.actorType, 'effect');
  const bare = run(['Overcharged Cartridges', 'Unsheathe Gunsaber', 'Artillery Slash'], {
    selectedSkills: ['Overcharged Cartridges']
  });
  close(
    result.resolvedEvents.find((event) => event.type === 'damage').damage,
    bare.resolvedEvents.find((event) => event.type === 'damage').damage
  );
  const missed = run(
    ['Overcharged Cartridges', 'Unsheathe Gunsaber', { name: 'Artillery Slash', offTarget: true }],
    config
  );
  assert.equal(state(missed).gunsAndGloryUntil, 0);
  assert.equal(
    missed.events.some((event) => event.type === 'condition' && event.sourceId === ID.OVERCHARGED_CARTRIDGES),
    false
  );
  const expired = run(['Unsheathe Gunsaber', 'Artillery Slash', wait(13000)], config);
  assert.equal(state(expired).gunsAndGloryUntil, 0);
});

test('cartridge component removal separates its bonus and Burning and a removed upgrade preserves the old occurrence', () => {
  for (const removed of ['condition', 'buff']) {
    const patched = withPatchPreview(warriorProfession, {
      id: `cartridge-${removed}`,
      label: 'Cartridge removal',
      professions: {
        warrior: {
          balanceProfiles: { [PROFILE.overchargedCartridges]: { removeEffects: [{ type: removed, all: true }] } }
        }
      }
    });
    const config = { patchId: `cartridge-${removed}`, selectedSkills: ['Overcharged Cartridges'] };
    const result = run(['Overcharged Cartridges', 'Unsheathe Gunsaber', 'Artillery Slash'], config, patched);
    assert.deepEqual(result.warnings, []);
    assert.equal(state(result).overchargedCartridgeWindows.length > 0, removed === 'condition');
    assert.equal(
      result.events.some((event) => event.type === 'condition' && event.sourceId === ID.OVERCHARGED_CARTRIDGES),
      false
    );
    const bare = run([wait(600), 'Unsheathe Gunsaber', 'Artillery Slash']);
    const damage = (value) =>
      value.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ARTILLERY_SLASH).damage;
    assert.ok(Math.abs(damage(result) - damage(bare) * (removed === 'condition' ? 1.15 : 1)) <= 1);
  }

  const patched = withPatchPreview(warriorProfession, {
    id: 'upgrade-removed',
    label: 'Upgrade removed',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.overchargedCartridges]: { removeEffects: [{ type: 'buff', name: 'supercharged-cartridges' }] }
        }
      }
    }
  });
  const result = run(
    ['Overcharged Cartridges', 'Overcharged Cartridges', 'Unsheathe Gunsaber', 'Artillery Slash'],
    { patchId: 'upgrade-removed', selectedSkills: ['Overcharged Cartridges'] },
    patched
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).overchargedCartridgeWindows.length, 1);
  assert.equal(state(result).overchargedCartridgeWindows[0].supercharged, false);
  assert.equal(
    result.events.some((event) => event.type === 'condition' && event.sourceId === ID.OVERCHARGED_CARTRIDGES),
    true
  );
});

test('committed reloads survive early release and restore ammo only at their retained completion', () => {
  const skill = warriorProfession
    .runtimeFor({ specialization: 'Bladesworn' })
    .catalog.skillsById.get(ID.TACTICAL_RELOAD);
  const release = (Number(skill.interruptCommitMs) + Number(skill.castTimeMs)) / 2;
  const result = run(
    [
      'Flow Stabilizer',
      { name: 'Tactical Reload', interruptAfterMs: release },
      wait(Number(skill.castTimeMs) - release),
      'Dragon Trigger',
      wait(240),
      combat
    ],
    {
      initialResource: 100,
      selectedSkills: ['Flow Stabilizer', 'Tactical Reload']
    }
  );
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.TACTICAL_RELOAD);
  const reloaded = result.events.find((event) => event.type === 'buff' && event.kind === 'tactical-reload');
  assert.ok(action.endsAt < action.fullEndsAt);
  assert.equal(reloaded.at, action.fullEndsAt);
  assert.equal(state(result).dragonCharges, 2);
  const ammo = observedRuntime(result).ammo.get(ID.FLOW_STABILIZER);
  assert.equal(ammo.charges, ammo.maximum);
});

test('release choices use native charge outcomes and disable unreachable levels without future Flow assumptions', () => {
  const config = { initialResource: 25, selectedTraitIds: [TRAIT.DARING_DRAGON] };
  const preview = (command) => run(['Dragon Trigger', ...(command ? [command] : [])], config);
  const skill = warriorProfession
    .runtimeFor({ specialization: 'Bladesworn' })
    .catalog.skillsById.get(ID.DRAGON_SLASH_FORCE);
  const projection = dragonChargeReleaseProjection({ skill, preview });
  assert.deepEqual(
    projection.rows.map((row) => row.charges),
    [1, 2, 3, 4, 5]
  );
  assert.equal(projection.rows[0].flowAfter, 10);
  assert.equal(projection.rows[1].flowAfter, 0);
  assert.equal(projection.rows[2].disabled, true);
  assert.ok(projection.rows[2].reason.includes('reached 2'));
  assert.ok(
    projection.rows
      .filter((row) => !row.disabled)
      .every((row) => Number.isFinite(row.at) && Number.isFinite(row.coefficient))
  );
});

test('release choices honor insertion-time charges, actual regeneration, and the trait-selected skill coefficient', () => {
  const skill = warriorProfession
    .runtimeFor({ specialization: 'Bladesworn' })
    .catalog.skillsById.get(ID.DRAGON_SLASH_FORCE);
  const projection = dragonChargeReleaseProjection({
    skill,
    preview: (command) =>
      run(['Dragon Trigger', wait(480), 'Flow Stabilizer', ...(command ? [command] : [])], {
        initialResource: 15,
        selectedSkills: ['Flow Stabilizer'],
        selectedTraitIds: [TRAIT.SHARP_AS_THE_WIND]
      })
  });
  close(projection.rows[0].at, 0.48);
  // Sharp's entry supplies its own Positive Flow alongside Flow Stabilizer.
  close(projection.rows[1].at, 0.96);
  assert.equal(projection.rows[1].coefficient, 3);
  const held = dragonChargeReleaseProjection({
    skill,
    preview: (command) => run(['Dragon Trigger', wait(2400), ...(command ? [command] : [])], { initialResource: 100 })
  });
  assert.deepEqual(
    held.rows.map((row) => row.charges),
    [10]
  );
  close(held.rows[0].at, 2.4);
  const closed = dragonChargeReleaseProjection({
    skill,
    preview: () =>
      run(['Dragon Trigger', 'Combat Stimulant'], { initialResource: 100, selectedSkills: ['Combat Stimulant'] })
  });
  assert.deepEqual(closed.rows, []);
});
