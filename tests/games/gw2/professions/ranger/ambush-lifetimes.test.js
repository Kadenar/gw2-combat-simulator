import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { untamedCastAvailability } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { bindUntamedUi } from '#gw2/professions/ranger/specializations/untamed/presentation.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { UNTAMED_AMBUSH_SKILL_IDS } from '#gw2/professions/ranger/data/untamed-ambushes.js';

const config = { specialization: 'Untamed', primaryWeapon: 'Hammer', selectedTraitIds: [TRAIT.LET_LOOSE] };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const ui = bindUntamedUi(rangerCatalog);

// Availability and presentation read the same executed deadline; equality closes the occurrence.
test('ambush cast, palette, and display agree at expiry', () => {
  for (const durationMs of [3999, 4000, 4001]) {
    const result = runRanger([ID.UNLEASH_RANGER, wait(durationMs)], config);
    const runtime = observedRuntime(result);
    const context = {
      professionState: result.planningState.profession,
      time: runtime.time,
      atSeconds: runtime.time,
      balanceContext: { catalog: runtime.helpers }
    };
    const skill = rangerCatalog.skillsById.get(ID.RELENTLESS_WHIRL);
    const available = durationMs < 4000;
    assert.deepEqual(result.warnings, []);
    assert.equal(untamedCastAvailability(runtime, skill).ready, available);
    assert.equal(result.planningState.availability[skill.id].ready, available);
    assert.equal(
      ui.rotationStateSnapshot(context).some((item) => item.id === 'untamed-ambush-window'),
      available
    );
    assert.equal(runtime.procs.deadline('ranger.untamed.unleashedPower'), 9);
  }
});

test('Let Loose refresh survives the superseded expiry', () => {
  const result = runRanger(
    [{ type: 'combat-start' }, ID.UNLEASH_RANGER, wait(1000), SHARED_SKILL_IDS.SWAP_WEAPONS, wait(3000)],
    { ...config, weaponSet2Primary: 'Axe' }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.ambushReadyUntil, 5);
  assert.equal(observedRuntime(result).procs.deadline('ranger.untamed.unleashedPower'), 0);
});

test('an admitted ambush consumes the grant while its delayed effects finish', () => {
  const result = runRanger([ID.UNLEASH_RANGER, wait(3960), ID.RELENTLESS_WHIRL], config, {
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

// Every weapon replacement consumes the shared grant and owns only one Let Loose reward, including delayed hits.
test('all supported weapon ambushes share availability and Let Loose ownership', () => {
  for (const skillId of UNTAMED_AMBUSH_SKILL_IDS) {
    const skill = rangerCatalog.skillsById.get(skillId);
    assert.ok(skill?.unleashedAmbushSkill, String(skillId));
    const result = runRanger(
      [ID.UNLEASH_RANGER, skillId],
      {
        ...config,
        primaryWeapon: skill.weapon
      },
      { observation: { kind: 'tail', durationMs: 5000 } }
    );
    assert.deepEqual(result.warnings, [], skill.name);
    assert.equal(result.planningState.profession.ambushReadyUntil, 0, skill.name);
    assert.equal(untamedCastAvailability(observedRuntime(result), skill).ready, false, skill.name);
    assert.ok(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === skillId),
      skill.name
    );
    assert.equal(
      result.resolvedEvents.filter(
        (event) => event.type === 'buff' && event.kind === 'quickness' && event.sourceId === TRAIT.LET_LOOSE
      ).length,
      1,
      skill.name
    );
  }
});

// Poison gained or lost during flight changes the conditional payload; Toxic Shot cannot enable its own torment.
test('Toxic Shot checks existing poison at impact and preserves its condition ownership', () => {
  for (const [label, poisonAt, duration, expected] of [
    ['clean target', null, 0, false],
    ['poison arrives during flight', 0.2, 2, true],
    ['poison expires during flight', 0.2, 0.1, false],
    ['poison arrives after impact', 0.8, 2, false]
  ]) {
    const result = runRanger(
      [ID.UNLEASH_RANGER, ID.TOXIC_SHOT],
      {
        specialization: 'Untamed',
        primaryWeapon: 'Shortbow'
      },
      {
        observation: { kind: 'tail', durationMs: 2000 },
        initialize(runtime) {
          if (poisonAt == null) return;
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at: poisonAt,
              condition: 'Poisoned',
              stacks: 1,
              duration,
              source: 'fixture',
              sourceId: 'fixture',
              actorType: 'player',
              skillName: 'Setup poison'
            }
          });
        }
      }
    );
    assert.deepEqual(result.warnings, [], label);
    const torment = result.events.filter((event) => event.type === 'condition' && event.condition === 'Torment');
    assert.equal(torment.length, expected ? 1 : 0, label);
    for (const event of torment) {
      assert.equal(event.skillId, ID.TOXIC_SHOT);
      assert.equal(event.sourceId, ID.TOXIC_SHOT);
      assert.equal(event.actorType, 'player');
      assert.equal(event.stacks, 4);
    }
  }
});
