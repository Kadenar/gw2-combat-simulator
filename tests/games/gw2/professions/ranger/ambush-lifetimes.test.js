import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { untamedSkillHandlers } from '#gw2/professions/ranger/specializations/untamed/execution/index.js';
import {
  untamedCastAvailability,
  untamedSchedulerHooks
} from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { bindUntamedUi } from '#gw2/professions/ranger/specializations/untamed/presentation.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';

const untamedUi = bindUntamedUi(rangerCatalog);

// Use the real state and catalog while isolating exact windows from cast speed and pet AI.
function ambushContext(profession = rangerProfession, patchId) {
  const config = { specialization: 'Untamed', selectedTraitIds: [TRAIT.LET_LOOSE], patchId };
  const runtime = profession.resolveRuntime(config);
  return {
    config,
    profession: runtime,
    catalog: runtime.catalog,
    state: { time: 0, profession: runtime.createProfessionState(config), cooldowns: new Map() },
    start: 0,
    effectiveEnd: 0,
    combatStartTime: 0,
    emit: () => {}
  };
}

const unleashRanger = untamedSkillHandlers['ranger.unleash-ranger'].afterEffects;
const unleashPet = untamedSkillHandlers['ranger.unleash-pet'].afterEffects;
const consumeAmbush = untamedSkillHandlers['ranger.unleashed-ambush'].afterEffects;
const advance = untamedSchedulerHooks.advance.handler;

test('both ambush grant paths store canonical exact deadlines with their existing anchors', () => {
  const profession = withPatchPreview(rangerProfession, {
    id: 'short-ambush',
    label: 'Short ambush window',
    professions: { ranger: { balanceProfiles: { [PROFILE.resources]: { fields: { durationMultiplier: 0.2 } } } } }
  });
  const context = ambushContext(profession, 'short-ambush');
  context.start = 0.1;
  context.effectiveEnd = 0.401;
  unleashRanger(context);
  assert.equal(untamedState.from(context).ambushReadyUntil, 0.3, 'Unleash grants from cast start');
  context.effectiveEnd = 0.1;
  untamedSchedulerHooks.onWeaponSwap(context);
  assert.equal(untamedState.from(context).ambushReadyUntil, 0.3, 'Let Loose grants from swap completion');
});

test('ambush cast, palette, and display agree before, at, and after expiry', () => {
  const context = ambushContext();
  unleashRanger(context);
  const state = untamedState.from(context);
  for (const at of [3.999999, 4, 4.000001]) {
    context.start = at;
    const ui = { state: context.state, time: at, atSeconds: at };
    for (const id of [ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]) {
      const skill = context.catalog.skillsById.get(id);
      assert.equal(untamedCastAvailability(context, skill).ready, at < 4);
      assert.equal(untamedUi.paletteSkillAvailability(ui, skill).available, at < 4);
    }

    assert.equal(
      untamedUi.rotationStateSnapshot(ui).some((item) => item.id === 'untamed-ambush-window'),
      at < 4
    );
  }

  advance(context, 3.999999);
  assert.equal(state.ambushReadyUntil, 4);
  advance(context, 4);
  assert.equal(state.ambushReadyUntil, 0);
  assert.equal(state.unleashedPowerReadyAt, 9, 'expiry cannot reset the grant cooldown');
  context.start = 9;
  unleashRanger(context);
  assert.equal(state.ambushReadyUntil, 0, 'existing inclusive ICD still blocks equality');
  context.start = 9.000001;
  unleashRanger(context);
  assert.equal(state.ambushReadyUntil, 13.000001);
});

test('Let Loose refresh survives the old deadline and respects combat, trait, and cooldown gates', () => {
  const context = ambushContext();
  unleashRanger(context);
  const state = untamedState.from(context);
  context.start = 1;
  context.effectiveEnd = 1.301;
  context.combatStartTime = null;
  untamedSchedulerHooks.onWeaponSwap(context);
  assert.equal(state.ambushReadyUntil, 4);
  context.combatStartTime = 0;
  context.config.selectedTraitIds = [];
  untamedSchedulerHooks.onWeaponSwap(context);
  assert.equal(state.ambushReadyUntil, 4);
  context.config.selectedTraitIds = [TRAIT.LET_LOOSE];
  untamedSchedulerHooks.onWeaponSwap(context);
  assert.equal(state.ambushReadyUntil, 5.301);
  assert.equal(state.unleashedPowerReadyAt, 0);
  assert.equal(state.letLooseReadyAt, 10);
  advance(context, 4);
  assert.equal(state.ambushReadyUntil, 5.301);
  context.start = context.effectiveEnd = 5;
  untamedSchedulerHooks.onWeaponSwap(context);
  assert.equal(state.ambushReadyUntil, 5.301, 'a suppressed swap cannot refresh the window');
  advance(context, 5.301);
  assert.equal(state.ambushReadyUntil, 0);
  assert.equal(state.letLooseReadyAt, 10);
});

test('pet unleash blocks ambush use without refreshing it, and consumption closes the grant once', () => {
  const context = ambushContext();
  const state = untamedState.from(context);
  const skill = context.catalog.skillsById.get(ID.RELENTLESS_WHIRL);
  state.rangerUnleashed = true;
  assert.equal(untamedCastAvailability(context, skill).ready, false, 'initial Ranger state is not an ambush grant');
  unleashRanger(context);
  unleashPet(context);
  assert.equal(state.ambushReadyUntil, 4);
  assert.equal(untamedCastAvailability(context, skill).ready, false);
  context.start = context.effectiveEnd = 2;
  untamedSchedulerHooks.onWeaponSwap(context);
  assert.equal(state.ambushReadyUntil, 4, 'Let Loose while Pet is unleashed only resets the grant cooldown');
  unleashRanger(context);
  assert.equal(state.ambushReadyUntil, 6);
  consumeAmbush(context);
  consumeAmbush(context);
  assert.equal(state.ambushReadyUntil, 0);
  assert.equal(state.unleashedPowerReadyAt, 11);
  assert.equal(untamedCastAvailability(context, skill).ready, false);
});

test('scheduler expiry clears planning state while an admitted ambush finishes its delayed effects', () => {
  const config = { specialization: 'Untamed', primaryWeapon: 'Hammer', selectedTraitIds: [TRAIT.LET_LOOSE] };
  const expired = simulateGw2({
    profession: rangerProfession,
    config,
    rotation: [ID.UNLEASH_RANGER, { type: 'wait', durationMs: 4000 }]
  });
  assert.deepEqual(expired.warnings, []);
  assert.equal(expired.planningState.profession.ambushReadyUntil, 0);
  const result = simulateGw2({
    profession: rangerProfession,
    config,
    rotation: [ID.UNLEASH_RANGER, { type: 'wait', durationMs: 3999 }, ID.RELENTLESS_WHIRL],
    observationPolicy: { kind: 'tail', durationMs: 3000 }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.ambushReadyUntil, 0);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillId === ID.RELENTLESS_WHIRL && event.at > 4
    )
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.parentSkillName === 'Relentless Whirl' && event.at > 4
    )
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.kind === 'quickness' && event.sourceId === TRAIT.LET_LOOSE
    ).length,
    1,
    'the committed ambush still triggers Let Loose once after the grant expires'
  );
});
