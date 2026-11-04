import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { activeChargeGrants } from '#gw2/platform/combat/resources/charges.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';
import { planningBuffStacks } from '#gw2/platform/results/result-queries.js';
import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { addVenomCharges, applyActiveVenoms } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { wait } from '#tests/helpers/commands.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

// Short synthetic rotations isolate trap timing and finite on-hit charges from benchmark totals.
const config = {
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  offHandWeapon: 'Torch',
  attributeInputs: baseAttributeInputs({ power: 2000, conditionDamage: 1000, precision: 1000, expertise: 0 }),
  target: { armor: 2597, defiant: true, conditions: {} }
};
const ranger = createObservedProfessionSimulator(rangerProfession, config);
const thief = createObservedProfessionSimulator(thiefProfession, config);
// Live venom grants keep their own deadlines; only unexpired batches still hold charges.
const liveVenomCharges = (result, id) => {
  const runtime = observedRuntime(result);
  return activeChargeGrants(runtime.profession.core.venomChargeBatches[id], runtime.time).reduce(
    (sum, batch) => sum + batch.charges,
    0
  );
};

const conditions = (result, skillId) =>
  result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillId === skillId);

// Consumption uses grant-established expiry order without refreshing unrelated pools or expired survivors.
test('player venoms spend shorter grants first and regrants prune only their selected pool', () => {
  const core = thiefProfession.runtimeFor({}).createState({}).core;
  const context = {
    profession: { core },
    helpers: thiefProfession.catalog,
    effects: captureEffectEmissions().effects
  };
  addVenomCharges(core, THIEF.SPIDER_VENOM, 0, 2, 10);
  addVenomCharges(core, THIEF.SKALE_VENOM, 0, 2, 1);
  const skale = core.venomChargeBatches[THIEF.SKALE_VENOM];
  addVenomCharges(core, THIEF.SPIDER_VENOM, 1, 2, 2);
  assert.equal(core.venomChargeBatches[THIEF.SKALE_VENOM], skale);
  const spider = core.venomChargeBatches[THIEF.SPIDER_VENOM];
  assert.deepEqual(
    spider.map((grant) => grant.expiresAt),
    [3, 10]
  );
  for (const event of [thiefHit(2, { actorType: 'summon' }), thiefHit(2, { coefficient: 0 })])
    assert.equal(applyActiveVenoms(context, event), 0);
  assert.deepEqual(
    spider.map((grant) => grant.charges),
    [2, 2]
  );
  assert.equal(applyActiveVenoms(context, thiefHit(2)), 1);
  assert.deepEqual(
    spider.map((grant) => grant.charges),
    [1, 2]
  );
  assert.equal(applyActiveVenoms(context, thiefHit(3)), 1);
  assert.deepEqual(
    spider.map((grant) => grant.charges),
    [1, 1]
  );
  assert.equal(core.venomChargeBatches[THIEF.SPIDER_VENOM], spider);
  assert.equal(core.venomChargeBatches[THIEF.SKALE_VENOM], skale);
  assert.equal(skale[0].charges, 2);
  assert.equal(applyActiveVenoms(context, thiefHit(10)), 0);
  addVenomCharges(core, THIEF.SPIDER_VENOM, 10, 5, 4, 2);
  assert.deepEqual(
    core.venomChargeBatches[THIEF.SPIDER_VENOM].map(({ charges, expiresAt }) => [charges, expiresAt]),
    [[2, 14]]
  );
  assert.equal(core.venomChargeBatches[THIEF.SKALE_VENOM], skale);
});

test('trait venom caps and zero gains preserve live utility charges while excluding expired capacity', () => {
  const core = thiefProfession.runtimeFor({}).createState({}).core;
  addVenomCharges(core, THIEF.SPIDER_VENOM, 0, 6, 2);
  for (const [charges, cap] of [
    [2, 3],
    [2, 0],
    [0, 10]
  ]) {
    addVenomCharges(core, THIEF.SPIDER_VENOM, 1, charges, 10, cap);
    assert.deepEqual(
      core.venomChargeBatches[THIEF.SPIDER_VENOM].map(({ charges, expiresAt }) => [charges, expiresAt]),
      [[6, 2]]
    );
  }

  addVenomCharges(core, THIEF.SPIDER_VENOM, 2, 2, 5, 3);
  assert.deepEqual(
    core.venomChargeBatches[THIEF.SPIDER_VENOM].map(({ charges, expiresAt }) => [charges, expiresAt]),
    [[2, 7]]
  );
});

test('venom planning and reports exclude retained expired charges and observe a later regrant', () => {
  // A real strike at expiry cannot spend the old grant; reporting derives liveness without pruning private storage.
  for (const regrant of [false, true]) {
    const result = runThief(
      [wait(3000)],
      {},
      {
        initialize(runtime) {
          addVenomCharges(runtime.profession.core, THIEF.SPIDER_VENOM, 0, 2, 1);
          runtime.effects.emit({ kind: 'packet', event: thiefHit(1) });
        },
        probes: regrant
          ? [[2, (runtime) => addVenomCharges(runtime.profession.core, THIEF.SPIDER_VENOM, 2, 1, 4, 1)]]
          : []
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(conditions(result, THIEF.SPIDER_VENOM).length, 0);
    assert.equal(planningBuffStacks(result.planningState, 'spider-venom'), regrant ? 1 : 0);
    const grants = observedRuntime(result).profession.core.venomChargeBatches[THIEF.SPIDER_VENOM];
    assert.deepEqual(
      grants.map(({ charges, expiresAt }) => [charges, expiresAt]),
      regrant ? [[1, 6]] : [[2, 1]]
    );
    const track = result.effectReport.tracks.find(
      (track) => track.kind === 'spider-venom' && track.recipient === 'self'
    );
    assert.equal(effectStateAt(result.effectReport, track, 0.5).count, 2);
    assert.equal(effectStateAt(result.effectReport, track, 1).count, 0);
    assert.equal(effectStateAt(result.effectReport, track, 3).count, regrant ? 1 : 0);
  }
});

test("Viper's Nest triggers after placement and preserves the pending dagger chain", () => {
  for (const quickness of [false, true]) {
    const result = ranger('Druid', ['Groundwork Gouge', "Viper's Nest", 'Leading Swipe', wait(4000)], {
      boons: { quickness },
      selectedSkillIds: [12496]
    });
    assert.deepEqual(result.warnings, []);
    const cast = result.steps.find((step) => step.skillName === "Viper's Nest");
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === RANGER.VIPERS_NEST);
    assert.ok(hits[0].at * 1000 > cast.end);
    const poison = result.events.filter((event) => event.type === 'condition' && event.skillId === RANGER.VIPERS_NEST);
    assert.deepEqual(
      poison.map((event) => event.at),
      hits.map((event) => event.at)
    );
  }
});

test('Sharpening Stone applications expire independently at thirty seconds', () => {
  const result = ranger(
    'Druid',
    ['Sharpening Stone', wait(10000), '__cooldown_reset', 'Sharpening Stone', wait(20000), 'Groundwork Gouge'],
    { selectedSkillIds: [12537] }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    observedRuntime(result).profession.core.sharpeningStoneGrants.reduce((sum, grant) => sum + grant.charges, 0),
    9
  );
  assert.equal(conditions(result, RANGER.SHARPENING_STONE).length, 1);
  const expired = ranger('Druid', ['Sharpening Stone', wait(30000), 'Groundwork Gouge'], {
    selectedSkillIds: [12537]
  });
  assert.equal(conditions(expired, RANGER.SHARPENING_STONE).length, 0);
});

for (const [name, id, charges] of [
  ['Spider Venom', THIEF.SPIDER_VENOM, 6],
  ['Skale Venom', THIEF.SKALE_VENOM, 4],
  ['Devourer Venom', THIEF.DEVOURER_VENOM, 2]
]) {
  // Setup must retain every ally charge until combat, while the original grant expiry still limits spending.
  test(`${name} starts allied consumption at combat entry without losing precombat charges`, () => {
    for (const interval of [1, 0.52]) {
      const overrides = { allies: { count: 1, strikesPerSecond: 1 / interval } };
      const result = thief('Core', [name, wait(2000), { type: 'combat-start' }, wait(7000)], overrides);
      const procs = conditions(result, id).filter(
        (event) => event.metadata?.triggeredByAlly && event.metadata.venomProcEffectIndex === 0
      );
      assert.equal(procs.length, charges);
      assert.equal(procs[0].at, result.combatStartTime + interval);
      assert.equal(liveVenomCharges(result, id), charges);
      assert.deepEqual(result.warnings, []);
    }

    const expired = thief('Core', [name, wait(25000), { type: 'combat-start' }, wait(7000)], {
      allies: { count: 1, strikesPerSecond: 1 }
    });
    assert.equal(conditions(expired, id).length, 0);
  });

  test(`${name} preserves spent charges across recasts and expires each grant separately`, () => {
    const result = thief('Core', [name, 'Heartseeker', '__cooldown_reset', name, 'Heartseeker'], {
      selectedSkillIds: [thiefProfession.catalog.skills.find((candidate) => candidate.name === name).id]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(liveVenomCharges(result, id), charges * 2 - 2);
    const expired = thief('Core', [name, wait(10000), '__cooldown_reset', name, wait(14000), 'Heartseeker'], {
      selectedSkillIds: [thiefProfession.catalog.skills.find((candidate) => candidate.name === name).id]
    });
    assert.deepEqual(expired.warnings, []);
    assert.equal(liveVenomCharges(expired, id), charges - 1);
    assert.ok(conditions(expired, id).length > 0);
  });
}

test('recast ally venoms spend one charge per strike instead of overlapping proc sequences', () => {
  const result = thief(
    'Core',
    ['Spider Venom', '__cooldown_reset', 'Spider Venom', { type: 'combat-start' }, wait(13000)],
    {
      selectedSkillIds: [13037],
      allies: { count: 1, strikesPerSecond: 1 }
    }
  );
  const procs = conditions(result, THIEF.SPIDER_VENOM).filter((event) => event.metadata?.triggeredByAlly);
  assert.equal(procs.length, 12);
  assert.deepEqual(
    procs.map((event) => event.at),
    Array.from({ length: 12 }, (_, index) => index + 1)
  );
});
