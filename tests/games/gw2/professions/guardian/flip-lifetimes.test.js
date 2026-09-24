import { pruneSkillFlips, armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianCastAvailability } from '#gw2/professions/guardian/core/mechanics/availability.js';
import { updateWeaponCastState } from '#gw2/professions/guardian/core/mechanics/weapon-state.js';
import { guardianUiSkillIdsByName } from '#gw2/professions/guardian/core/presentation.js';
import { projectGuardianPlanningState } from '#gw2/professions/guardian/family-state.js';
import { willbenderSkillMechanicHandlers } from '#gw2/professions/guardian/specializations/willbender/mechanics/virtue-rules.js';
import { dragonhunterSkillMechanicHandlers } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtues-and-traps.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Isolate flip lifetimes from authored cast speed and recharge using the real catalog and state owners.
function flipContext(specialization = 'Core', selectedTraitIds = []) {
  const config = { specialization, selectedTraitIds };
  const profession = guardianProfession.resolveRuntime(config);
  return {
    config,
    profession,
    catalog: profession.catalog,
    action: {},
    start: 0,
    effectiveEnd: 0.1 + 0.201,
    state: { time: 0, profession: profession.createProfessionState(config), cooldowns: new Map(), lockouts: new Map() }
  };
}

test('Guardian weapon flips share exact deadlines across cast availability, snapshots, palette, and cleanup', () => {
  for (const [id, duration, traits] of [
    [ID.BINDING_BLADE, 10, []],
    [ID.SHIELD_OF_ABSORPTION, 4, []],
    [ID.ZEALOTS_FLAME, 3, []],
    [ID.ZEALOTS_FLAME, 4.5, [TRAIT.RADIANT_FIRE]]
  ]) {
    const context = flipContext('Core', traits);
    const parent = context.catalog.skillsById.get(id);
    const flip = context.catalog.skillsById.get(parent.flipSkillId);
    const flips = context.state.profession.core.availableFlips;
    context.state.cooldowns.set(id, 99);
    updateWeaponCastState(context, parent);
    const expiresAt = (301 + duration * 1000) / 1000;
    assert.equal(flips[flip.id]?.expiresAt, expiresAt);
    for (const at of [expiresAt - 0.000001, expiresAt, expiresAt + 0.000001]) {
      context.start = context.state.time = at;
      const active = at < expiresAt;
      assert.equal(guardianCastAvailability(context, flip).ready, active);
      if (id === ID.ZEALOTS_FLAME) assert.equal(guardianCastAvailability(context, parent).ready, !active);
      const projected = projectGuardianPlanningState({ schedulerState: context.state });
      assert.equal(Object.hasOwn(projected.availableFlips, flip.id), active);
      assert.equal(flips[flip.id]?.expiresAt, expiresAt, 'projection must not mutate scheduler state');
      assert.equal(
        guardianUiSkillIdsByName(guardianCatalog, [parent.name], { state: context.state, atSeconds: at }).includes(
          flip.id
        ),
        active
      );
    }

    pruneSkillFlips(context.state.profession.core.availableFlips, expiresAt - 0.000001);
    assert.equal(flips[flip.id]?.expiresAt, expiresAt);
    pruneSkillFlips(context.state.profession.core.availableFlips, expiresAt);
    assert.equal(flips[flip.id], undefined);
    assert.equal(context.state.cooldowns.get(id), 99, 'expiry must not reset the parent recharge');
  }
});

test('flip refresh replaces its deadline and committed consumption closes the window once', () => {
  const context = flipContext();
  const parent = context.catalog.skillsById.get(ID.BINDING_BLADE);
  const flip = context.catalog.skillsById.get(ID.PULL);
  const flips = context.state.profession.core.availableFlips;
  updateWeaponCastState(context, parent);
  context.effectiveEnd = 1.301;
  updateWeaponCastState(context, parent);
  pruneSkillFlips(context.state.profession.core.availableFlips, 10.301);
  assert.equal(flips[flip.id]?.expiresAt, 11.301);
  context.start = 11.300999;
  assert.equal(guardianCastAvailability(context, flip).ready, true);
  // A cast admitted before expiry still commits after cleanup; it cannot leave a reusable flip behind.
  context.effectiveEnd = 12;
  pruneSkillFlips(context.state.profession.core.availableFlips, 12);
  updateWeaponCastState(context, flip);
  assert.equal(flips[flip.id], undefined);
  assert.equal(guardianCastAvailability(context, flip).ready, false);
});

test('uncommitted parents and flips preserve prior state while a committed atomic cancel still arms its flip', () => {
  const context = flipContext();
  const parent = context.catalog.skillsById.get(ID.BINDING_BLADE);
  const flip = context.catalog.skillsById.get(ID.PULL);
  const flips = context.state.profession.core.availableFlips;
  flips[flip.id] = armSkillFlip({}, 0, 0, 9);
  context.action = { cancelled: true };
  updateWeaponCastState(context, parent);
  updateWeaponCastState(context, flip);
  assert.equal(flips[flip.id]?.expiresAt, 9);
  context.action = { interrupted: true };
  updateWeaponCastState(context, { ...parent, interruptMode: 'per-packet' });
  assert.equal(flips[flip.id]?.expiresAt, 9);
  updateWeaponCastState(context, parent);
  assert.equal(flips[flip.id]?.expiresAt, 10.301);
  updateWeaponCastState(context, flip);
  assert.equal(flips[flip.id], undefined);
});

test('specialization flip producers use canonical deadlines and persistent flips survive cleanup', () => {
  const willbender = flipContext('Willbender');
  willbenderSkillMechanicHandlers['guardian.willbender.arm-repose']({ context: willbender, at: 0.1 + 0.201 });
  assert.equal(willbender.state.profession.core.availableFlips[ID.REPOSE]?.expiresAt, 6.301);
  const dragonhunter = flipContext('Dragonhunter');
  dragonhunter.state.profession.specialization.state.tetherUntil = 0.1 + 0.2;
  dragonhunterSkillMechanicHandlers['guardian.dragonhunter.arm-hunters-verdict']({ context: dragonhunter, at: 0 });
  assert.equal(dragonhunter.state.profession.core.availableFlips[ID.HUNTERS_VERDICT]?.expiresAt, 0.3);
  const context = flipContext('Luminary');
  context.state.profession.core.availableFlips[ID.EXIT_RADIANT_FORGE] = armSkillFlip({}, 0, 0, Infinity);
  context.state.time = 1000;
  pruneSkillFlips(context.state.profession.core.availableFlips, 1000);
  assert.equal(
    projectGuardianPlanningState({ schedulerState: context.state }).availableFlips[ID.EXIT_RADIANT_FORGE]?.expiresAt,
    null
  );
});

test('Binding Blade expiry hides Pull without removing the final tether damage packet', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    config: { primaryWeapon: 'Greatsword' },
    rotation: [ID.BINDING_BLADE, { type: 'wait', durationMs: 10000 }]
  });
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.BINDING_BLADE);
  const expiresAt = action.endsAt + 10;
  const finalPulse = result.resolvedEvents.find(
    (event) => event.name === 'Binding Blade — Tether' && event.at === expiresAt
  );
  assert.ok(finalPulse?.damage > 0);
  assert.equal(result.planningState.profession.availableFlips[ID.PULL], undefined);
});
