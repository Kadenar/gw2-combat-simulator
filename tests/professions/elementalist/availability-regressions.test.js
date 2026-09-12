import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { CONJURE_PICKUP_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { applyConjureState } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import { completeArcaneEcho } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';
import { createWeaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import {
  weaverSchedulerHooks,
  weaverSkillMechanicHandlers
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-attunements.js';

test('Arcane Echo requires an armed, unexpired window and consumes it only once', () => {
  const echo = elementalistCatalog.skillsByName.get('Arcane Echo');
  const weapon = elementalistCatalog.skillsByName.get('Lightning Strike');
  // Inactive and exact-expiry casts must leave both cooldowns untouched.
  for (const [armed, at, active] of [
    [false, 0, false],
    [true, 0, true],
    [true, 9.999, true],
    [true, 10, false],
    [true, 11, false]
  ]) {
    const core = createElementalistCoreState();
    const cooldowns = new Map([
      [weapon.id, 20],
      [echo.id, 30]
    ]);
    const context = {
      state: { profession: { core }, cooldowns },
      catalog: elementalistCatalog,
      effectiveEnd: 0,
      rechargeDuration: 5
    };
    if (armed) completeArcaneEcho(context, echo);
    context.effectiveEnd = at;
    completeArcaneEcho(context, weapon);
    assert.equal(cooldowns.get(weapon.id), active ? at + 1 : 20);
    assert.equal(cooldowns.get(echo.id), active ? 35 : 30);
    if (active) {
      assert.equal(core.arcaneEchoUntil, 0);
      completeArcaneEcho(context, weapon);
      assert.equal(cooldowns.get(echo.id), 35);
    }
  }
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
      state: {
        profession: {
          core: createElementalistCoreState(),
          specialization: { kind: 'Weaver', state: createWeaverState() }
        }
      },
      catalog: elementalistCatalog,
      config: { selectedTraitIds: [] },
      effectiveEnd: at,
      emit: (event) => events.push(event)
    };
    if (armed) weaverSkillMechanicHandlers['elementalist.weaver.arm-fervent-stance']({ context, at: 0 });
    weaverSchedulerHooks.onCastComplete.handler(context, skill);
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
      state: { profession: { core } },
      config: { selectedSkills: { Elite: 'Conjure Fiery Greatsword' }, autoSummonElemental: false },
      catalog: elementalistCatalog,
      start: 0,
      epsilon: 1e-9
    };
    for (const expiry of [0, 10]) {
      core.summonedElemental.activeUntil = expiry;
      const denied = elementalistCoreAvailability(context, skill);
      assert.equal(denied.ready, false);
      assert.equal(denied.code, 'elementalist.not-equipped');
      assert.equal(denied.retryAt, null);
    }

    context.config.selectedSkills.Elite = name;
    core.summonedElemental.activeUntil = 0;
    assert.equal(elementalistCoreAvailability(context, skill).ready, true);
    const flip = elementalistCatalog.skillsByName.get(command);
    assert.equal(elementalistCoreAvailability(context, flip).ready, false);
    Object.assign(core.summonedElemental, { element, activeUntil: 10 });
    const occupied = elementalistCoreAvailability(context, skill);
    assert.equal(occupied.ready, false);
    assert.equal(occupied.retryAt, 10);
    assert.equal(elementalistCoreAvailability(context, flip).ready, true);
    context.start = 10;
    assert.equal(elementalistCoreAvailability(context, skill).ready, true);

    const rejected = runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      selectedSkills: { Elite: 'Conjure Fiery Greatsword' },
      rotation: [name]
    });
    assert.match(rejected.warnings[0], /not equipped/);
    assert.equal(rejected.endState.profession.summonedElemental.element, null);
    const summoned = runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      selectedSkills: { Elite: name },
      autoSummonElemental: false,
      rotation: [name, command]
    });
    assert.deepEqual(summoned.warnings, []);
    assert.equal(summoned.endState.profession.summonedElemental.element, element);
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
        state: { profession: { core } },
        start: 0,
        effectiveEnd: 0.3,
        emit: (event) => events.push(event)
      };
      const expected = expiry === 0.1 || expiry === 1;
      assert.equal(elementalistCoreAvailability(context, skill).ready, expected, `${weapon}: ${expiry}`);
      applyConjureState(context, skill);
      assert.equal(core.conjureEquipped, expected ? weapon : null);
      assert.equal(events.filter((event) => event.type === 'sigil_swap').length, expected ? 1 : 0);
      if (expected) {
        assert.equal(Object.hasOwn(core.conjurePickups, weapon), false);
        assert.equal(elementalistCoreAvailability(context, skill).ready, false);
        applyConjureState(context, skill);
        assert.equal(events.filter((event) => event.type === 'sigil_swap').length, 1);
      }
    }
  }
});

test('native rotations reject nonexistent pickups and consume summoned ground copies once', () => {
  const options = {
    lines: [['Fire'], ['Air'], ['Arcane']],
    selectedSkills: { Utility1: 'Conjure Frost Bow' }
  };
  const missing = runNative({ ...options, rotation: ['__pickup_Frost Bow'] });
  assert.match(missing.warnings[0], /pickup is unavailable or expired/);
  assert.equal(missing.endState.profession.conjureEquipped, null);

  const pickedUp = runNative({
    ...options,
    rotation: ['Conjure Frost Bow', '__drop_bundle', '__pickup_Frost Bow']
  });
  assert.deepEqual(pickedUp.warnings, []);
  assert.equal(pickedUp.endState.profession.conjureEquipped, 'Frost Bow');
  assert.equal(Object.hasOwn(pickedUp.endState.profession.conjurePickups, 'Frost Bow'), false);

  const expired = runNative({
    ...options,
    rotation: ['Conjure Frost Bow', '__drop_bundle', 36000, '__pickup_Frost Bow']
  });
  assert.match(expired.warnings[0], /pickup is unavailable or expired/);
  assert.equal(expired.endState.profession.conjureEquipped, null);
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
    assert.equal(result.endState.profession.autoattackCarryover, null);
    assert.equal(result.endState.profession.autoattackChains[root], undefined);
  }
});
