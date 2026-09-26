import assert from 'node:assert/strict';
import test from 'node:test';
import { revenantProfession, revenantCatalog } from '#gw2/professions/revenant/profession.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import { revenantEnduranceRate } from '#gw2/professions/revenant/core/hooks.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { REVENANT_TEST_CONFIG as baseConfig, revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';

const simulate = createObservedProfessionSimulator(revenantProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const core = (result) => observedRuntime(result).profession.core;
const specialization = (result) => observedRuntime(result).profession.specialization.state;
const alacrityAt = (at, duration) => (runtime) =>
  runtime.emit({
    type: 'buff',
    kind: 'alacrity',
    at,
    duration,
    stacks: 1,
    source: 'fixture',
    sourceId: 'fixture',
    actorType: 'player'
  });

// Invoking a legend always has a 10 second recharge; Alacrity during that recharge does not shorten it.
test('legend swap recharge ignores Alacrity in the runtime and palette', () => {
  const rotation = ['__combat_start', 'Swap Legends', wait(8500)];
  const planned = runRevenant(rotation, {}, { initialize: alacrityAt(2, 4) });
  const swap = revenantCatalog.skillsById.get(SKILL.SWAP_LEGENDS);
  const projected = planned.planningState;
  assert.equal(projected.cooldowns[swap.name].readyAt, 10000);
  assert.deepEqual(
    revenantProfession.ui.paletteSkillAvailability(
      { time: projected.atSeconds, professionState: projected.profession, cooldowns: projected.cooldowns },
      swap
    ),
    { available: false, message: 'Legend swap is recharging', retryAt: 10 }
  );
  const next = runRevenant([...rotation, 'Swap Legends'], {}, { initialize: alacrityAt(2, 4) });
  assert.deepEqual(next.warnings, []);
  assert.equal(next.events.findLast((event) => event.type === 'action').at, 10);
});

// A child consumed during the channel must not make the parent's later expiry claim another activation.
test('Imperial Guard expiry retains its cast identity after early consumption', () => {
  const config = { primaryWeapon: 'Greatsword', initialEnergy: 100 };
  const rotation = ['Imperial Guard', 'True Strike', { type: 'cooldown-reset' }, 'Imperial Guard', wait(3500)];
  const result = simulate('Vindicator', rotation, config);
  assert.deepEqual(result.warnings, []);
  // The first channel's expiry falls inside the second window and must not clear the newer follow-up.
  assert.ok(core(result).availableFlips[SKILL.TRUE_STRIKE]);
  const guards = result.events.filter((event) => event.type === 'action' && event.name === 'Imperial Guard');
  assert.equal(core(result).availableFlips[SKILL.TRUE_STRIKE].identity, guards[1].activationId);
});

// These minimal casts exercise commit ownership without pinning animation thresholds or saved rotations.
for (const [spec, name, legend, config = {}] of [
  ['Core', 'Enchanted Daggers', LEGEND.ASSASSIN],
  ['Core', 'Ancient Echo', LEGEND.ASSASSIN],
  ['Core', 'Embrace the Darkness', LEGEND.DEMON],
  ['Core', 'Abyssal Raze', LEGEND.ASSASSIN, { weaponSet1Primary: 'Spear' }],
  ['Renegade', "Razorclaw's Rage", LEGEND.RENEGADE],
  ['Conduit', 'Beguiling Haze', LEGEND.ENTITY],
  ['Conduit', 'Twin Moon Sweep', LEGEND.ENTITY],
  ['Vindicator', 'Dodge Jump', LEGEND.ASSASSIN]
]) {
  test(`Canceled ${name} does not commit its effect package`, () => {
    const result = simulate(spec, ['__combat_start', { name, interruptAfterMs: 100 }, wait(2000)], {
      ...config,
      selectedLegends: [legend, legend === LEGEND.ASSASSIN ? LEGEND.DEMON : LEGEND.ASSASSIN],
      startingLegend: legend
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.events.find((event) => event.type === 'action' && event.name === name).cancelled, true);
    assert.equal(
      result.events.some((event) => ['damage', 'condition', 'buff'].includes(event.type)),
      false
    );
    const state = result.planningState.profession;
    assert.equal(state.enchantedDaggers.charges, 0);
    assert.equal(state.razorclawsRage.charges, 0);
    assert.equal(state.bandTogetherReady, false);
    assert.equal(state.beguilingHazeCharges, 0);
    assert.equal(state.crushingAbyss.length, 0);
    assert.equal(state.activeUpkeeps.length, 0);
    if (name === 'Ancient Echo') assert.equal(state.energy.value, 50 + result.rotationEndTime * 5);
    if (name === 'Twin Moon Sweep') assert.equal(state.affinity, 0);
    if (name === 'Dodge Jump') assert.equal(state.endurance, 50 + result.rotationEndTime * 5);
    if (name === 'Beguiling Haze') assert.equal(specialization(result).beguilingHazeRecharge, null);
  });
}

// Charge owners spend only on landed eligible player strikes, with strict activation, cooldown, and expiry bounds.
for (const [name, skillId, cooldown] of [
  ['Enchanted Daggers', SKILL.ENCHANTED_DAGGERS, 0.52],
  ['Razorclaw without ICD', SKILL.RAZORCLAWS_RAGE, 0],
  ['Razorclaw with patched ICD', SKILL.RAZORCLAWS_RAGE, 0.5]
]) {
  test(`${name} preserves replacement grants, eligibility, strict expiry, and cooldown boundaries`, () => {
    const daggers = skillId === SKILL.ENCHANTED_DAGGERS;
    const skill = revenantCatalog.skillsById.get(skillId);
    const buff = skill.effects.find((effect) => effect.type === 'buff');
    const procId = RENEGADE_PROFILE_IDS.razorclawsRageProc;
    const owner = (runtime) => (daggers ? runtime.profession.core : runtime.profession.specialization.state);
    const key = daggers ? 'enchantedDaggers' : 'razorclawsRage';
    const scenario = (seed, hits, untilMs) =>
      runRevenant(
        [wait(untilMs)],
        { specialization: 'Renegade', selectedLegends: [LEGEND.ASSASSIN, LEGEND.RENEGADE] },
        {
          catalog: daggers ? undefined : (catalog) => withSkill(catalog, procId, { cooldown }),
          initialize(runtime) {
            owner(runtime)[key] = seed;
            for (const hit of hits) runtime.emit(hit);
          }
        }
      );
    const derived = (result) =>
      result.events.filter(
        (event) =>
          event.source === 'revenant' &&
          (daggers ? event.type === 'damage' && event.skillId === skillId : event.condition === 'Bleeding')
      );

    const bounded = scenario(
      { charges: buff.stacks, expiresAt: 1 + buff.duration, readyAt: 1 },
      [
        ...[{ actorType: 'effect' }, { coefficient: 0 }, { skillId }].map((fields) => revenantHit(1.1, fields)),
        revenantHit(0.9),
        revenantHit(1),
        revenantHit(1.1),
        revenantHit(1.1 + cooldown),
        revenantHit(1.101 + cooldown)
      ],
      3000
    );
    const runtime = observedRuntime(bounded);
    assert.equal(owner(runtime)[key].charges, buff.stacks - 2, 'only two eligible hits clear their gates');
    const packets = derived(bounded);
    assert.equal(packets.length, 2);
    assert.equal(packets[0].at, Number((1.1 + (daggers ? cooldown : 0)).toFixed(6)));
    const cause = bounded.events.find(
      (event) =>
        event.type === 'damage' &&
        event.at === 1.1 &&
        event.skillId === SKILL.PHASE_TRAVERSAL &&
        event.coefficient === 1 &&
        event.actorType === 'player'
    );
    assert.equal(packets[0].causalOrder, cause.causalOrder ?? cause.eventOrder);
    if (daggers) assert.equal(packets[0].hitIndex, 1);

    const expired = scenario(
      { charges: buff.stacks, expiresAt: 3 + buff.duration, readyAt: 3 },
      [revenantHit(3 + buff.duration)],
      (4 + buff.duration) * 1000
    );
    assert.equal(owner(observedRuntime(expired))[key].charges, buff.stacks, 'exact expiry cannot consume');
    const exhausted = scenario({ charges: 1, expiresAt: 100, readyAt: 0 }, [revenantHit(50), revenantHit(60)], 61000);
    assert.equal(owner(observedRuntime(exhausted))[key].charges, 0, 'exhausted grants cannot underflow');
    assert.equal(derived(exhausted).length, 1);
  });
}

test("Razorclaw's Rage arms its charges and assumed allies' Bleeding at completion", () => {
  const result = simulate('Renegade', ["Razorclaw's Rage", wait(3000)], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    allies: { count: 2, strikesPerSecond: 2 }
  });
  assert.deepEqual(result.warnings, []);
  const buff = revenantCatalog.skillsById.get(SKILL.RAZORCLAWS_RAGE).effects.find((effect) => effect.type === 'buff');
  const completion = result.events.find((event) => event.type === 'action' && event.name === "Razorclaw's Rage").endsAt;
  assert.deepEqual(specialization(result).razorclawsRage, {
    charges: buff.stacks,
    expiresAt: completion + buff.duration,
    readyAt: completion
  });
  assert.ok(result.events.some((event) => event.metadata?.triggeredByAlly));
});

test('Razorclaw rejects a missing proc and keeps charges when its bleed is removed', () => {
  // A missing declaration is invalid content, while an explicit removal leaves the charge for no packet to spend.
  const procId = RENEGADE_PROFILE_IDS.razorclawsRageProc;
  const run = (catalog) =>
    runRevenant(
      [wait(2000)],
      { specialization: 'Renegade' },
      {
        catalog,
        initialize(runtime) {
          runtime.profession.specialization.state.razorclawsRage = { charges: 2, expiresAt: 10, readyAt: 0 };
          runtime.emit(revenantHit(1));
        }
      }
    );
  assert.throws(() => run((catalog) => withSkill(catalog, procId, null)), /Missing Razorclaw's Rage proc declaration/);
  const removed = run((catalog) =>
    applySkillPatch(catalog, { skills: { [procId]: { removeEffects: [{ type: 'condition', name: 'Bleeding' }] } } })
  );
  assert.deepEqual(specialization(removed).razorclawsRage, { charges: 2, expiresAt: 10, readyAt: 0 });
  assert.equal(
    removed.events.some((event) => event.condition === 'Bleeding'),
    false
  );
});

test('Battle Scars rejects overflow and consumes newest before longest-lived', () => {
  const vulnerability = (at, stacks) => ({
    type: 'condition',
    at,
    condition: 'Vulnerability',
    stacks,
    duration: 10,
    source: 'fixture',
    sourceId: 'fixture',
    skillName: 'Fixture',
    actorType: 'player'
  });
  // A heal completing at three seconds grants Battle Scarred; later accepted Vulnerability grants Dance of Death.
  const scars = (untilMs) =>
    core(
      runRevenant(
        untilMs <= 2640 ? [wait(untilMs)] : [wait(2640), 'Enchanted Daggers', wait(untilMs - 3000)],
        { selectedTraitIds: [TRAIT.BATTLE_SCARRED, TRAIT.DANCE_OF_DEATH] },
        {
          initialize(runtime) {
            runtime.profession.core.battleScars = [30, 10];
            for (const event of [revenantHit(2), vulnerability(4, 100), vulnerability(5, 1), revenantHit(14)])
              runtime.emit(event);
          }
        }
      )
    ).battleScars;
  assert.deepEqual(scars(2500), [30]);
  const healed = scars(3000);
  assert.ok(healed.length > 1);
  assert.ok(healed.slice(1).every((expiresAt) => expiresAt === 13));
  const cap = revenantCatalog.balanceProfilesById.get(REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars).maximumStacks;
  const full = scars(4500);
  assert.equal(full.length, cap);
  assert.deepEqual(scars(5500), full, 'overflow cannot replace or refresh retained scars');
  assert.deepEqual(scars(14500), [], 'exact expiry removes newer grants before consuming the oldest survivor');
});

test('Thrill of Combat catches up on its original cadence while capped grants remain rejected', () => {
  const profileId = REVENANT_CORE_BALANCE_PROFILE_IDS.battleScars;
  // Without the siphon the catch-up hits cannot also consume the scars they grant.
  const withoutSiphon = (catalog) =>
    applyBalanceProfilePatch(catalog, {
      balanceProfiles: { [profileId]: { removeEffects: [{ type: 'strike', name: 'Battle Scars — Life Siphon' }] } }
    });
  const run = (untilMs) =>
    core(
      runRevenant(
        ['__combat_start', wait(untilMs)],
        { selectedTraitIds: [TRAIT.THRILL_OF_COMBAT] },
        {
          catalog: (catalog) => withProfile(withoutSiphon(catalog), profileId, { maximumStacks: 2 }),
          initialize: (runtime) => [3, 12].forEach((at) => runtime.emit(revenantHit(at)))
        }
      )
    );
  const first = run(3500);
  assert.deepEqual(first.battleScars, [11, 12]);
  assert.equal(first.nextThrillOfCombatAt, 4);
  const second = run(12500);
  assert.deepEqual(second.battleScars, [21, 22]);
  assert.equal(second.nextThrillOfCombatAt, 13);
});

test('Core strike reactions keep upkeep, trait, and dagger order with the original cause', () => {
  // One landed strike exercises every Core reaction while each derived packet retains the strike's causal place.
  const result = runRevenant(
    [wait(2000)],
    {
      selectedTraitIds: [TRAIT.VICIOUS_REPRISAL, TRAIT.EXPOSE_DEFENSES],
      boons: { resolution: true },
      initialEnergy: 100
    },
    {
      initialize(runtime) {
        const state = runtime.profession.core;
        state.activeUpkeeps.push({
          skillId: SKILL.IMPOSSIBLE_ODDS,
          upkeepCost: 0,
          startsAt: 0,
          empoweredNextPulse: false
        });
        state.battleScars = [10];
        state.enchantedDaggers = { charges: 2, expiresAt: 10, readyAt: 0 };
        runtime.emit(
          revenantHit(1, { skillId: SKILL.PHASE_SMASH, sourceId: SKILL.PHASE_SMASH, skillName: 'Phase Smash' })
        );
      }
    }
  );
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === SKILL.PHASE_SMASH);
  const derived = result.events
    .filter(
      (event) =>
        event !== strike && (event.causalOrder ?? event.eventOrder) === (strike.causalOrder ?? strike.eventOrder)
    )
    .sort((left, right) => left.eventOrder - right.eventOrder);
  assert.deepEqual(
    derived.map((event) => event.sourceId),
    [
      SKILL.IMPOSSIBLE_ODDS,
      'revenant.battle-scars',
      TRAIT.VICIOUS_REPRISAL,
      TRAIT.EXPOSE_DEFENSES,
      SKILL.ENCHANTED_DAGGERS
    ]
  );
  assert.equal(core(result).battleScars.length, 0);
  assert.equal(core(result).enchantedDaggers.charges, 1);
});

// Release cooldowns belong to the upkeep parent and use its release-specific duration with recharge modifiers.
test('upkeep manual release cooldowns scale with Alacrity', () => {
  for (const [spec, legend, parentName, releaseName, cooldown] of [
    ['Core', LEGEND.ASSASSIN, 'Impossible Odds', 'Relinquish Power', 1],
    ['Core', LEGEND.CENTAUR, 'Protective Solace', 'Diminish Solace', 5],
    ['Renegade', LEGEND.RENEGADE, "Soulcleave's Summit", 'Dismiss Lieutenant Soulcleave', 3]
  ]) {
    for (const alacrity of [false, true]) {
      const result = simulate(spec, [parentName, wait(1000), releaseName, parentName], {
        selectedLegends: [legend, LEGEND.DEMON],
        startingLegend: legend,
        initialEnergy: 100,
        boons: { alacrity }
      });
      const release = result.steps.find((step) => step.skill === releaseName);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.steps.at(-1).start, release.end + (cooldown / (alacrity ? 1.25 : 1)) * 1000);
    }
  }
});

// Exhaustion starts a distinct parent cooldown at starvation, independent of the later observation endpoint.
test('upkeep starvation cooldowns scale with Alacrity', () => {
  for (const alacrity of [false, true]) {
    const result = simulate('Core', ['Impossible Odds', wait(2000)], { initialEnergy: 6, boons: { alacrity } });
    assert.deepEqual(result.warnings, []);
    // Five Energy remains after activation; the six-per-second drain against five regeneration empties it at one second.
    assert.equal(observedRuntime(result).cooldowns.get(SKILL.IMPOSSIBLE_ODDS), 1 + 4 / (alacrity ? 1.25 : 1));
    assert.deepEqual(result.planningState.profession.activeUpkeeps, []);
  }
});

test('Diminish Solace stops upkeep drain, retires its follow-up, and starts the parent cooldown', () => {
  const config = { selectedLegends: [LEGEND.CENTAUR, LEGEND.ASSASSIN], startingLegend: LEGEND.CENTAUR };
  const rotation = ['__combat_start', 'Protective Solace', wait(1000), 'Diminish Solace'];
  const released = simulate('Core', rotation, config);
  const recovered = simulate('Core', [...rotation, wait(2000)], config);
  assert.deepEqual(recovered.warnings, []);
  assert.deepEqual(recovered.planningState.profession.activeUpkeeps, []);
  assert.equal(recovered.planningState.profession.availableFlips[SKILL.DIMINISH_SOLACE], undefined);
  assert.equal(recovered.planningState.profession.energy.value - released.planningState.profession.energy.value, 10);
  assert.equal(observedRuntime(released).cooldowns.get(SKILL.PROTECTIVE_SOLACE), 6);
  const unavailable = simulate('Core', ['Diminish Solace'], config);
  assert.match(unavailable.warnings.join('\n'), /activate the matching upkeep/);
});

test('Both Vindicator dodge inputs apply the selected landing conditions and boons once', () => {
  for (const name of ['Dodge', 'Dodge Jump']) {
    for (const [trait, expected] of [
      [TRAIT.FORERUNNER_OF_DEATH, [['Vulnerability', 5, 10]]],
      [
        TRAIT.VASSALS_OF_THE_EMPIRE,
        [
          ['might', 5, 15],
          ['protection', 1, 7.5]
        ]
      ],
      [TRAIT.SAINT_OF_ZU_HELTZER, [['alacrity', 1, 6]]]
    ]) {
      const result = simulate('Vindicator', [name], {
        selectedTraitIds: [trait],
        stats: { concentration: 750 },
        allies: { count: 4 }
      });
      assert.deepEqual(result.warnings, []);
      for (const [kind, stacks, duration] of expected) {
        const applications = result.events.filter((event) => event.kind === kind || event.condition === kind);
        assert.equal(applications.length, 1, `${name}: ${kind}`);
        assert.equal(applications[0].stacks, stacks);
        assert.equal(applications[0].duration, duration);
        if (kind === 'alacrity') assert.equal(applications[0].resolvedAudience.alliedPlayerCount, 4);
      }

      if (trait === TRAIT.FORERUNNER_OF_DEATH) {
        const strike = result.events.find((event) => event.type === 'damage');
        const buff = result.events.find((event) => event.kind === 'forerunner-of-death');
        assert.equal(strike.forerunnerOfDeathActive, false);
        assert.ok(strike.eventOrder < buff.eventOrder);
      }
    }
  }
});

test('In-combat invocations grant Fury and trigger Incensed Response without an internal cooldown', () => {
  const config = { selectedTraitIds: [TRAIT.INVOKERS_RAGE, TRAIT.INCENSED_RESPONSE] };
  const result = simulate(
    'Core',
    ['__combat_start', 'Swap Legends', { type: 'cooldown-reset' }, 'Swap Legends'],
    config
  );
  assert.deepEqual(result.warnings, []);
  const fury = result.events.filter((event) => event.kind === 'fury');
  const might = result.events.filter((event) => event.sourceId === TRAIT.INCENSED_RESPONSE);
  assert.equal(fury.length, 2);
  assert.equal(might.length, 2);
  assert.equal(fury[0].duration, 5);
  assert.equal(might[0].stacks, 5);
  assert.equal(might[0].duration, 8);
  const precast = simulate('Core', ['Swap Legends', '__combat_start'], config);
  assert.equal(
    precast.events.some((event) => event.type === 'buff'),
    false
  );
});

test('Fury reactions respect recipients, source ownership, combat gating, and boon duration', () => {
  const fury = {
    type: 'buff',
    kind: 'fury',
    at: 1,
    duration: 5,
    stacks: 1,
    source: 'fixture',
    sourceId: 'fixture',
    actorType: 'player'
  };
  for (const [event, combatStartTime, might, vigor] of [
    [fury, 0, 1, 1],
    [fury, 2, 0, 1],
    [{ ...fury, actorType: 'environment' }, 0, 0, 1],
    [{ ...fury, audience: { recipients: 'party', affectsSelf: false } }, 0, 0, 0],
    [{ ...fury, audience: { recipients: 'summons', affectsSelf: false } }, 0, 0, 0]
  ]) {
    const result = runRevenant(
      [wait(3000)],
      { specialization: 'Renegade', selectedTraitIds: [TRAIT.INCENSED_RESPONSE, TRAIT.BRUTAL_MOMENTUM] },
      { combatStartTime, initialize: (runtime) => runtime.emit(event) }
    );
    const trigger = result.events.find((emitted) => emitted.sourceId === 'fixture');
    const derived = result.events.filter((emitted) => emitted.sourceId !== 'fixture' && emitted.type === 'buff');
    assert.equal(derived.filter((emitted) => emitted.kind === 'might').length, might);
    assert.equal(derived.filter((emitted) => emitted.kind === 'vigor').length, vigor);
    assert.ok(derived.every((emitted) => emitted.causalOrder === (trigger.causalOrder ?? trigger.eventOrder)));
  }

  const result = simulate('Renegade', ['__combat_start', 'Riposting Shadows'], {
    selectedTraitIds: [TRAIT.INCENSED_RESPONSE, TRAIT.BRUTAL_MOMENTUM],
    stats: { concentration: 750 }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.find((event) => event.sourceId === TRAIT.INCENSED_RESPONSE).duration, 12);
  assert.equal(result.events.find((event) => event.sourceId === TRAIT.BRUTAL_MOMENTUM).duration, 9);
});

test('Enduring Recovery adds to Vigor and funds the next dodge in Core and Vindicator', () => {
  for (const spec of ['Core', 'Vindicator']) {
    for (const [traits, vigor, rate, readyAt] of [
      [[], false, 5, 10],
      [[TRAIT.ENDURING_RECOVERY], false, 6.25, 8],
      [[TRAIT.ENDURING_RECOVERY], true, 8.75, 5.72]
    ]) {
      const result = runRevenant(['Dodge'], {
        specialization: spec,
        selectedTraitIds: traits,
        boons: { vigor },
        initialEndurance: 0
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(revenantEnduranceRate(observedRuntime(result), vigor), rate);
      assert.equal(result.steps[0].start, readyAt * 1000);
    }

    const result = simulate(spec, ['Dodge', 'Dodge', 'Dodge'], { selectedTraitIds: [TRAIT.ENDURING_RECOVERY] });
    assert.deepEqual(result.warnings, []);
    const dodges = result.steps.filter((step) => step.skillId === SKILL.DODGE);
    assert.equal(dodges.length, 3);
    assert.equal(dodges[2].start, 8000);
  }
});

test('Brutal Momentum Vigor stops increasing recovery when its self boon expires', () => {
  const fury = {
    type: 'buff',
    kind: 'fury',
    at: 0,
    duration: 1,
    stacks: 1,
    source: 'fixture',
    sourceId: 'fixture',
    actorType: 'player'
  };
  const run = (untilMs) =>
    runRevenant(
      [wait(untilMs)],
      { specialization: 'Renegade', selectedTraitIds: [TRAIT.BRUTAL_MOMENTUM], initialEndurance: 0 },
      { initialize: (runtime) => runtime.emit(fury) }
    );
  const probe = run(1000);
  const vigor = probe.events.find((event) => event.kind === 'vigor');
  const covered = core(run(vigor.duration * 1000));
  assert.equal(covered.endurance, vigor.duration * 7.5);
  assert.equal(core(run((vigor.duration + 2) * 1000)).endurance, vigor.duration * 7.5 + 10);
});

test('Brutal Momentum only rearms after its Vigor internal cooldown expires', () => {
  // Repeated Fury, including the exact blocked deadline, must not extend Vigor.
  const result = runRevenant(
    [wait(9000)],
    { specialization: 'Renegade', selectedTraitIds: [TRAIT.BRUTAL_MOMENTUM] },
    {
      initialize: (runtime) =>
        [0, 1, 8, 8.01].forEach((at) =>
          runtime.emit({
            type: 'buff',
            kind: 'fury',
            at,
            duration: 1,
            stacks: 1,
            source: 'fixture',
            sourceId: 'fixture',
            actorType: 'player'
          })
        )
    }
  );
  assert.deepEqual(
    result.events.filter((event) => event.kind === 'vigor').map((event) => event.at),
    [0, 8.01]
  );
});
