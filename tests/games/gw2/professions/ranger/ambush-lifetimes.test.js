import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { untamedCastAvailability } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash.js';
import { bindUntamedUi } from '#gw2/professions/ranger/specializations/untamed/presentation.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';

const config = { specialization: 'Untamed', primaryWeapon: 'Hammer', selectedTraitIds: [TRAIT.LET_LOOSE] };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const ui = bindUntamedUi(rangerCatalog);

// Availability and presentation read the same executed deadline; equality closes the occurrence.
test('ambush cast, palette, and display agree at expiry', () => {
  for (const durationMs of [3999, 4000, 4001]) {
    const result = runRanger([ID.UNLEASH_RANGER, wait(durationMs)], config);
    const runtime = observedRuntime(result);
    const context = { state: { profession: runtime.profession }, time: runtime.time, atSeconds: runtime.time };
    const skill = rangerCatalog.skillsById.get(ID.RELENTLESS_WHIRL);
    const available = durationMs < 4000;
    assert.deepEqual(result.warnings, []);
    assert.equal(untamedCastAvailability(runtime, skill).ready, available);
    assert.equal(ui.paletteSkillAvailability(context, skill).available, available);
    assert.equal(
      ui.rotationStateSnapshot(context).some((item) => item.id === 'untamed-ambush-window'),
      available
    );
    assert.equal(untamedState.from(runtime).unleashedPowerReadyAt, 9);
  }
});

test('Let Loose refresh survives the superseded expiry', () => {
  const result = runRanger(
    [{ type: 'combat-start' }, ID.UNLEASH_RANGER, wait(1000), ID.SWAP_WEAPONS, wait(3000)],
    config
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.ambushReadyUntil, 5);
  assert.equal(untamedState.from(observedRuntime(result)).unleashedPowerReadyAt, 0);
});

test('an admitted ambush consumes the grant while its delayed effects finish', () => {
  const result = runRanger([ID.UNLEASH_RANGER, wait(3999), ID.RELENTLESS_WHIRL], config, {
    observation: { kind: 'tail', durationMs: 3000 }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.ambushReadyUntil, 0);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillId === ID.RELENTLESS_WHIRL && event.at > 4
    )
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.kind === 'quickness' && event.sourceId === TRAIT.LET_LOOSE
    ).length,
    1
  );
});
