import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { canonicalTime } from '#kernel/core/clock.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative, runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { CONJURE_PICKUP_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { pickUpConjure, captureConjurePickup } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import { armArcaneEcho, completeArcaneEcho } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { weaverHooks } from '#gw2/professions/elementalist/specializations/weaver/hooks.js';
import { elementalistAttunementPolicy } from '#gw2/professions/elementalist/family-state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

test('slot selection admits authored attunement variants and follow-ups before checking their state', () => {
  // Selection equivalence never bypasses the active-attunement gate or admits an unrelated same-name skill.
  const core = createElementalistCoreState({ startAttunement: 'Fire' });
  const context = {
    profession: { core, specialization: { kind: 'Core', state: {} } },
    config: {},
    helpers: elementalistCatalog,
    time: 0
  };
  const fire = elementalistCatalog.skillsById.get(ID.GLYPH_OF_STORMS_FIRE);
  const air = elementalistCatalog.skillsById.get(ID.GLYPH_OF_STORMS_AIR);
  for (const selectedSkillIds of [undefined, [], [fire.id], [air.id]]) {
    context.config.selectedSkillIds = selectedSkillIds;
    const verdict = elementalistCoreAvailability(context, fire);
    assert.equal(verdict.ready, selectedSkillIds?.length !== 0);
    if (!verdict.ready) assert.equal(verdict.code, 'elementalist.not-equipped');
  }

  context.config.selectedSkillIds = [fire.id];
  assert.equal(elementalistCoreAvailability(context, air).code, 'elementalist.attuned-utility');
  assert.equal(elementalistCoreAvailability(context, { ...fire, id: 'unrelated' }).code, 'elementalist.not-equipped');
  context.config.selectedSkillIds = [];
  assert.equal(elementalistCoreAvailability(context, air).code, 'elementalist.not-equipped');

  const root = elementalistCatalog.skillsByName.get('Weave Self');
  const followUp = elementalistCatalog.skillsByName.get('Tailored Victory');
  context.config.selectedSkillIds = [root.id];
  assert.equal(elementalistCoreAvailability(context, followUp).ready, true);
  context.config.selectedSkillIds = [];
  assert.equal(elementalistCoreAvailability(context, followUp).code, 'elementalist.not-equipped');
});

test('only the selected Weaver delegates weapon eligibility and supplies a secondary attunement', () => {
  // An unrelated field addition must not change weapon or same-attunement availability.
  const core = createElementalistCoreState({ startAttunement: 'Fire' });
  const weapon = { id: 'fixture', name: 'Air weapon', type: 'Weapon', attunement: 'Air' };
  for (const kind of ['Core', 'Tempest', 'Catalyst', 'Evoker', 'Weaver']) {
    const context = {
      profession: { core, specialization: { kind, state: { secondaryAttunement: 'Air' } } },
      config: {},
      helpers: elementalistCatalog,
      time: 0
    };
    assert.equal(elementalistCoreAvailability(context, weapon).ready, kind === 'Weaver');
    assert.equal(elementalistAttunementPolicy(context).secondaryAttunement, kind === 'Weaver' ? 'Air' : null);
    if (kind !== 'Weaver') {
      const attunement = elementalistCatalog.skillsByName.get('Fire Attunement');
      assert.equal(elementalistCoreAvailability(context, attunement).code, 'elementalist.same-attunement');
    } else {
      context.profession.specialization.state.secondaryAttunement = null;
      assert.equal(elementalistCoreAvailability(context, weapon).ready, true);
    }
  }
});

test('Weaver runtime and palette share hand eligibility through Unravel and full attunement', () => {
  // Exercise each slot against explicit expected bars; surrounding availability gates stay in their callers.
  for (const [secondary, unravel, expected] of [
    ['Air', false, [['Fire'], ['Fire'], ['Fire+Air', 'Air+Fire'], ['Air'], ['Air']]],
    ['Fire', false, [['Fire'], ['Fire'], ['Fire'], ['Fire'], ['Fire']]],
    ['Air', true, [['Fire'], ['Fire'], ['Fire'], ['Fire'], ['Fire']]]
  ]) {
    const core = createElementalistCoreState({ startAttunement: 'Fire' });
    const state = weaverState.create({ secondaryAttunement: secondary });
    state.unravelUntil = unravel ? 2 : 0;
    const runtime = {
      profession: { core, specialization: { kind: 'Weaver', state } },
      helpers: elementalistCatalog,
      time: 1
    };
    for (let slot = 1; slot <= 5; slot++) {
      for (const attunement of ['Fire', 'Air', 'Water', 'Fire+Air', 'Air+Fire', 'Fire+Water']) {
        const skill = {
          id: 'hand-fixture',
          name: 'Hand fixture',
          type: 'Weapon',
          weapon: 'Sword',
          slot: `Weapon_${slot}`,
          attunement
        };
        const available = expected[slot - 1].includes(attunement);
        assert.equal(weaverHooks.availability(runtime, skill).ready, available);
      }
    }
  }
});

// Isolate the buff and recharge contracts using the same controller as native execution.
function arcaneEchoContext(rate = 1) {
  const context = {
    time: 0,
    profession: { core: createElementalistCoreState() },
    helpers: elementalistCatalog
  };
  context.cooldownController = createCooldownController({
    clock: context,
    rechargeDuration: (skill) => gw2BaseRecharge(skill) / rate,
    rechargeIntervals: (_skill, start, end) => [{ start, end, rate }],
    skillFor: (id) => elementalistCatalog.skillsById.get(id)
  });
  return context;
}

test('Arcane Echo accepts weapon starts through its ten-second deadline and consumes the buff once', () => {
  const echo = elementalistCatalog.skillsByName.get('Arcane Echo');
  const weapon = elementalistCatalog.skillsByName.get('Lightning Strike');
  // A weapon started in the window remains eligible when its completion follows expiry.
  for (const [armed, start, active] of [
    [false, 0, false],
    [true, 0, true],
    [true, 9.999999, true],
    [true, 10, true],
    [true, 10.000001, false]
  ]) {
    const context = arcaneEchoContext();
    context.cooldownController.setReadyAt(weapon.id, 20);
    context.cooldownController.startRecharge(echo, 0);
    if (armed) {
      armArcaneEcho(context, { effectiveEnd: 0 });
      assert.equal(context.profession.core.arcaneEchoUntil, 10);
    }

    context.time = canonicalTime(start + 2);
    const cast = { start, effectiveEnd: context.time, rechargeWork: 5 };
    completeArcaneEcho(context, cast, weapon);
    assert.equal(context.cooldownController.readyAt(weapon.id), active ? canonicalTime(context.time + 1) : 20);
    const expectedEcho = active ? 15 + gw2BaseRecharge(weapon) : 15;
    assert.equal(context.cooldownController.readyAt(echo.id), expectedEcho);
    if (active) {
      assert.equal(context.profession.core.arcaneEchoUntil, 0);
      completeArcaneEcho(context, cast, weapon);
      assert.equal(context.cooldownController.readyAt(echo.id), expectedEcho);
    }
  }
});

// Original recharge is transferred before modifiers, while both running cooldowns earn Alacrity progress.
test('Arcane Echo adds original weapon recharge to its 15-second base and grants one base second', () => {
  const echo = elementalistCatalog.skillsById.get(ID.ARCANE_ECHO);
  const weapon = { ...elementalistCatalog.skillsById.get(ID.LIGHTNING_STRIKE), cooldown: 30 };
  assert.equal(echo.cooldown, 15);
  for (const rate of [1, 1.25]) {
    const context = arcaneEchoContext(rate);
    context.cooldownController.startRecharge(echo, 0);
    armArcaneEcho(context, { effectiveEnd: 0 });
    context.time = 5;
    context.cooldownController.startRecharge(weapon, 5, 7);
    completeArcaneEcho(context, { start: 4, effectiveEnd: 5, rechargeWork: 7 }, weapon);
    assert.deepEqual(context.cooldownController.rechargeFor(weapon.id), { startedAt: 5, work: 1 });
    assert.equal(context.cooldownController.readyAt(weapon.id), canonicalTime(5 + 1 / rate));
    assert.deepEqual(context.cooldownController.rechargeFor(echo.id), { startedAt: 5, work: 45 - 5 * rate });
    assert.equal(context.cooldownController.readyAt(echo.id), 45 / rate);
  }
});

// Autoattacks must not claim the buff even when their authored data includes a positive cooldown.
test('Arcane Echo ignores autoattacks, non-weapons, follow-ups, zero recharge, and cancelled casts', () => {
  const weapon = elementalistCatalog.skillsById.get(ID.LIGHTNING_STRIKE);
  for (const [patch, cancelled] of [
    [{ autoattack: true }, false],
    [{ slot: 'Weapon_1', autoattack: false }, false],
    [{ type: 'Utility' }, false],
    [{ type: 'Heal' }, false],
    [{ flipParentId: weapon.id }, false],
    [{ cooldown: 0 }, false],
    [{}, true]
  ]) {
    const context = arcaneEchoContext();
    const echo = elementalistCatalog.skillsById.get(ID.ARCANE_ECHO);
    context.cooldownController.startRecharge(echo, 0);
    context.cooldownController.setReadyAt(weapon.id, 20);
    armArcaneEcho(context, { effectiveEnd: 0 });
    context.time = 2;
    completeArcaneEcho(context, { start: 1, effectiveEnd: 2, cancelled }, { ...weapon, ...patch });
    assert.equal(context.profession.core.arcaneEchoUntil, 10);
    assert.equal(context.cooldownController.readyAt(weapon.id), 20);
    assert.equal(context.cooldownController.readyAt(echo.id), 15);
    completeArcaneEcho(context, { start: 1, effectiveEnd: 2 }, weapon);
    assert.equal(context.profession.core.arcaneEchoUntil, 0);
  }
});

// Ammo weapons retain their spent charges and count-recharge queue after the effect is consumed.
test('Arcane Echo preserves spent ammunition and adds its original count recharge', () => {
  const context = arcaneEchoContext();
  const echo = elementalistCatalog.skillsById.get(ID.ARCANE_ECHO);
  const weapon = elementalistCatalog.skillsById.get(ID.WATER_TRIDENT);
  context.cooldownController.startRecharge(echo, 0);
  armArcaneEcho(context, { effectiveEnd: 0 });
  context.time = 2;
  context.cooldownController.spendAmmo(weapon, 2, 7);
  completeArcaneEcho(context, { start: 1, effectiveEnd: 2, rechargeWork: 7 }, weapon);
  const ammo = context.cooldownController.readAmmo(weapon.id);
  assert.equal(ammo.charges, 1);
  assert.deepEqual(ammo.recharges, [{ startedAt: 2, work: 7 }]);
  assert.equal(context.cooldownController.readyAt(echo.id), 15 + weapon.ammoRecharge);
});

// Native hit-based recharge reduction must not shrink Echo's surcharge, and the repeat waits for reduced recharge.
test('Arcane Echo transfers original Ride the Lightning recharge and schedules its repeat after one base second', () => {
  const weapon = elementalistCatalog.skillsById.get(ID.RIDE_THE_LIGHTNING);
  const completions = [];
  const result = runElementalist(
    [ID.ARCANE_ECHO, weapon.id, weapon.id].map((skillId) => ({ type: 'cast', skillId })),
    {
      specialization: 'Core',
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Dagger',
      startAttunement: 'Air',
      selectedTraitIds: []
    },
    {
      extend(native) {
        return {
          onCastCommit(context, cast) {
            native.onCastCommit?.(context, cast);
            if (cast.skill.id === weapon.id)
              completions.push({
                at: context.time,
                committedWork: cast.rechargeWork,
                echoReady: context.cooldownController.readyAt(ID.ARCANE_ECHO)
              });
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(completions[0].committedWork < gw2BaseRecharge(weapon));
  assert.equal(completions[0].echoReady, (15 + gw2BaseRecharge(weapon)) / 1.25);
  assert.equal(completions[1].echoReady, completions[0].echoReady);
  const repeat = result.events.filter((event) => event.type === 'action' && event.skillId === weapon.id)[1];
  assert.equal(repeat.at, gw2CooldownReadyAt(completions[0].at + 1 / 1.25));
});

test('Fervent Stance grants dual-attack Might only inside an armed window', () => {
  const skill = elementalistCatalog.skillsByName.get('Galvanize');
  // Exercise the real arming handler and completion hook at both window boundaries.
  for (const [armed, at, active] of [
    [false, 0, false],
    [true, 0, true],
    [true, 7.999, true],
    [true, 8, false],
    [true, 9, false]
  ]) {
    const events = [];
    const context = {
      profession: {
        core: createElementalistCoreState(),
        specialization: { kind: 'Weaver', state: weaverState.create() }
      },
      time: 0,
      query: { statsAt: () => ({}) },
      helpers: elementalistCatalog,
      config: { selectedTraitIds: [] },
      effectiveEnd: at,
      effects: captureEffectEmissions({ submit: (event) => events.push(event) }).effects,
      emitProcedural: (event) => events.push(event)
    };
    bindTriggerPoints(context, elementalistProfession, { specialization: 'Weaver' });
    if (armed) weaverHooks.tasks['elementalist.weaver.arm-fervent-stance'](context);
    context.time = at;
    weaverHooks.onCastCommit(context, { skill, command: {}, effectiveEnd: at, fullEnd: at, start: at });
    const grants = events.filter((event) => event.type === 'buff' && event.source === 'Fervent Stance');
    assert.equal(grants.length, active ? 1 : 0);
    if (active) assert.equal(grants[0].kind, 'might');
  }
});

test('elemental glyphs require equipment while matching command flips and summon retries remain valid', () => {
  // Summon eligibility must be checked before the occupied-window retry, without gating command flips as root skills.
  for (const [name, element, command] of [
    ['Glyph of Elementals', 'Fire', 'Flame Barrage'],
    ['Glyph of Elementals (Earth)', 'Earth', 'Stomp']
  ]) {
    const skill = elementalistCatalog.skillsByName.get(name);
    const core = createElementalistCoreState();
    const context = {
      profession: { core },
      config: { selectedSkillIds: [5516] },
      helpers: elementalistCatalog,
      time: 0,
      start: 0
    };
    for (const selectedSkillIds of [undefined, [], [5516]]) {
      context.config.selectedSkillIds = selectedSkillIds;
      for (const expiry of [0, 10]) {
        core.summonedElemental.activeUntil = expiry;
        const denied = elementalistCoreAvailability(context, skill);
        assert.equal(denied.ready, false);
        assert.equal(denied.code, 'elementalist.not-equipped');
        assert.equal(denied.reason, 'the skill is not equipped.');
        assert.equal(denied.retryAt, null);
      }
    }

    context.config.selectedSkillIds = [skill.id];
    core.summonedElemental.activeUntil = 0;
    assert.equal(elementalistCoreAvailability(context, skill).ready, true);
    const flip = elementalistCatalog.skillsByName.get(command);
    assert.equal(elementalistCoreAvailability(context, flip).ready, true);
    Object.assign(core.summonedElemental, { element, activeUntil: 10 });
    const occupied = elementalistCoreAvailability(context, skill);
    assert.equal(occupied.ready, false);
    assert.equal(occupied.retryAt, 10);
    assert.equal(elementalistCoreAvailability(context, flip).ready, true);
    context.config.selectedSkillIds = [];
    core.summonedElemental.summonGeneration = 1;
    assert.equal(elementalistCoreAvailability(context, flip).ready, true);
    context.time = 10;
    assert.equal(elementalistCoreAvailability(context, flip).ready, false);
    context.config.selectedSkillIds = [skill.id];
    assert.equal(elementalistCoreAvailability(context, skill).ready, true);

    const rejected = runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      selectedSkillIds: { Elite: 5516 },
      rotation: [name]
    });
    assert.match(rejected.warnings[0], /not equipped/);
    assert.equal(rejected.planningState.profession.summonedElemental.element, null);
    const summoned = runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      selectedSkillIds: { Elite: elementalistCatalog.skillsByName.get(name).id },
      rotation: [name, command]
    });
    assert.deepEqual(summoned.warnings, []);
    assert.equal(summoned.planningState.profession.summonedElemental.element, element);
  }
});

test('conjure pickup availability and consumption require a finite, unexpired ground copy', () => {
  // Check both boundaries, including a pickup whose animation ends after expiry.
  for (const [id, weapon] of Object.entries(CONJURE_PICKUP_WEAPONS)) {
    const skill = elementalistCatalog.skillsById.get(Number(id));
    for (const expiry of [undefined, null, NaN, Infinity, -Infinity, -1, 0, 0.1, 1]) {
      const core = createElementalistCoreState();
      if (expiry !== undefined) core.conjurePickups[weapon] = expiry;
      const events = [];
      const context = {
        helpers: elementalistCatalog,
        profession: { core },
        time: 0,
        start: 0,
        effectiveEnd: 0.3,
        schedule() {},
        query: { statsAt: () => ({}) },
        config: {},
        effects: captureEffectEmissions({ submit: (event) => events.push(event) }).effects,
        emitProcedural: (event) => events.push(event)
      };
      const expected = expiry === 0.1 || expiry === 1;
      assert.equal(elementalistCoreAvailability(context, skill).ready, expected, `${weapon}: ${expiry}`);
      const cast = { skill, start: 0, effectiveEnd: 0.3 };
      captureConjurePickup(context, cast);
      pickUpConjure(context, cast, skill);
      assert.equal(core.conjureEquipped, expected ? weapon : null);
      assert.equal(events.filter((event) => event.type === 'sigil_swap').length, expected ? 1 : 0);
      if (expected) {
        assert.equal(Object.hasOwn(core.conjurePickups, weapon), false);
        assert.equal(elementalistCoreAvailability(context, skill).ready, false);
        pickUpConjure(context, { skill, start: 0.3, effectiveEnd: 0.6 }, skill);
        assert.equal(events.filter((event) => event.type === 'sigil_swap').length, 1);
      }
    }
  }
});

test('native rotations reject nonexistent pickups and consume summoned ground copies once', () => {
  const options = {
    lines: [['Fire'], ['Air'], ['Arcane']],
    selectedSkillIds: { Utility1: 5567 }
  };
  const missing = runNative({ ...options, rotation: ['__pickup_Frost Bow'] });
  assert.match(missing.warnings[0], /pickup is unavailable or expired/);
  assert.equal(missing.planningState.profession.conjureEquipped, null);

  const pickedUp = runNative({
    ...options,
    rotation: ['Conjure Frost Bow', '__drop_bundle', '__pickup_Frost Bow']
  });
  assert.deepEqual(pickedUp.warnings, []);
  assert.equal(pickedUp.planningState.profession.conjureEquipped, 'Frost Bow');
  assert.equal(Object.hasOwn(pickedUp.planningState.profession.conjurePickups, 'Frost Bow'), false);

  const expired = runNative({
    ...options,
    rotation: ['Conjure Frost Bow', '__drop_bundle', 36000, '__pickup_Frost Bow']
  });
  assert.match(expired.warnings[0], /pickup is unavailable or expired/);
  assert.equal(expired.planningState.profession.conjureEquipped, null);
});

test('Weaver autoattack roots require the primary attunement, even when the off hand matches', () => {
  for (const skill of ['Seiche', 'Charged Strike', 'Fire Strike']) {
    const result = runNative({
      lines: [['Fire'], ['Air'], ['Weaver']],
      startAttunement: 'Fire',
      secondaryAttunement: 'Air',
      weapons: ['Sword', 'Dagger'],
      rotation: [skill]
    });
    const expected = skill === 'Fire Strike';
    assert.equal(
      result.events.some((event) => event.type === 'action' && event.skillName === skill),
      expected
    );
    if (expected) assert.deepEqual(result.warnings, []);
    else assert.match(result.warnings[0], /matching Weaver hand/);
  }
});

test('Weaver preserves the next autoattack link across completed and concurrent attunement swaps', () => {
  // Both swap paths must retain earned chain progress and clear it after the finisher.
  const airAttunement = elementalistCatalog.skillsByName.get('Air Attunement');
  const root = elementalistCatalog.skillsByName.get('Fire Strike').id;
  for (const swap of ['Air Attunement', { type: 'cast', skillId: airAttunement.id, concurrentOffsetMs: 100 }]) {
    const result = runNative({
      lines: [['Fire'], ['Air'], ['Weaver']],
      startAttunement: 'Fire',
      secondaryAttunement: 'Air',
      weapons: ['Sword', 'Dagger'],
      rotation: ['Fire Strike', swap, 'Fire Swipe', 'Searing Slash']
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'action' && event.skillName === 'Searing Slash'),
      true
    );
    assert.equal(result.planningState.profession.autoattackCarryover, null);
    assert.equal(result.planningState.profession.autoattackChains[root], undefined);
  }
});
