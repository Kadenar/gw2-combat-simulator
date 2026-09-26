import assert from 'node:assert/strict';
import test from 'node:test';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, runtimeFor } from '#tests/helpers/live-runtime.js';

// Inject boundary events through the real queue so expiration and completion use their native owners.
function run(specialization, rotation, selectedTraitIds = [], initialize = () => {}) {
  const config = {
    specialization,
    selectedTraitIds,
    initialResource: specialization === 'Bladesworn' ? 100 : 30,
    stats: { power: 2000, precision: 4000 },
    target: { armor: 2597 }
  };
  const profession = warriorProfession.liveRuntimeFor(config);
  const result = observeGw2Runtime({
    profession: {
      ...profession,
      initialize(runtime) {
        profession.initialize?.(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation
  });
  assert.deepEqual(result.warnings, []);
  return result;
}

const wait = (durationMs) => ({ type: 'wait', durationMs });
const combat = { type: 'combat-start' };
const state = (result) => runtimeFor(result).profession.specialization.state;

test('Tactical Reload rounds an off-grid application and admits entry exactly at its displayed deadline', () => {
  for (const [delay, charges] of [
    [10039, 2],
    [10040, 1]
  ]) {
    const result = run('Bladesworn', [wait(1), ID.TACTICAL_RELOAD, wait(delay), ID.DRAGON_TRIGGER, wait(240), combat]);
    const application = result.events.find((event) => event.kind === 'tactical-reload');
    const [buff] = boonApplicationsAt(result.events, 'tactical-reload', application.at);
    assert.equal(Math.round((buff.expiresAt - buff.at) * 1000), 10039);
    assert.equal(state(result).dragonCharges, charges);
    assert.equal(state(result).tacticalReloadUntil, 0);
  }
});

test('Positive Flow state and displayed expiry agree on off-grid applications', () => {
  for (const source of ['trait', 'stabilizer']) {
    const skillId = source === 'trait' ? ID.UNSHEATHE_GUNSABER : ID.FLOW_STABILIZER;
    const result = run('Bladesworn', [combat, wait(1), skillId], [TRAIT.RIVERS_FLOW]);
    const [buff] = boonApplicationsAt(result.events, 'positive-flow', 0.001);
    const until =
      source === 'trait' ? state(result).traitPositiveFlowUntil : state(result).flowStabilizerWindows[0].expiresAt;
    assert.equal(until, source === 'trait' ? 5.04 : 8.04);
    assert.equal(buff.expiresAt, until);
  }
});

test('trait and combo fire auras detonate once before their exclusive rounded expiry', () => {
  for (const source of ['trait', 'combo']) {
    for (const at of [5039, 5040, 5041]) {
      const result = run('Berserker', [wait(at), ID.BERSERK], [TRAIT.KING_OF_FIRES], (runtime) => {
        const event = {
          at: 0.001,
          source: 'warrior',
          sourceId: ID.CHOP,
          skillId: ID.CHOP,
          skillName: 'Chop',
          actorType: 'player'
        };
        runtime.emit(
          source === 'trait'
            ? { ...event, type: 'damage', coefficient: 1, forceCrit: true, weaponStrengthProfileId: 'weapon.axe' }
            : { ...event, type: 'aura', aura: 'Fire Aura', duration: 5 }
        );
      });
      if (source === 'trait') assert.equal(boonApplicationsAt(result.events, 'fire-aura', 0.001)[0].expiresAt, 5.04);
      assert.equal(result.procSteps.filter((proc) => proc.skill === 'King of Fires').length, at < 5040 ? 1 : 0);
      assert.equal(state(result).fireAuraUntil, 0);
    }
  }
});

test('a shorter combo fire aura cannot truncate the current aura owner', () => {
  const result = run('Berserker', [wait(1100)], [], (runtime) => {
    for (const [at, duration] of [
      [0.001, 5],
      [1.001, 1]
    ])
      runtime.emit({
        type: 'aura',
        aura: 'Fire Aura',
        at,
        duration,
        source: 'combo',
        sourceId: 'fixture',
        actorType: 'player'
      });
  });
  assert.equal(state(result).fireAuraUntil, 5.04);
});
