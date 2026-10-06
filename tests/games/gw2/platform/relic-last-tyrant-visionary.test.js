import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { recordProcStep } from '#gw2/platform/results/proc-steps.js';
import { effectStateAt, effectSummary } from '#gw2/platform/results/effect-report.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { comboDefinition } from '#gw2/platform/combos/definitions.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { elementalistProfiledConditionRequest } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { testProfession } from '#tests/fixtures/profession.js';

// Real condition resolution includes direct relic applications, so its own Burning must not feed another Fury cycle.
function conditionResolver() {
  const config = { relic: 'Last Tyrant' };
  const reactions = createGw2ResolverReactionRegistry({ contributions: createGw2EquipmentReactionContributions() });
  const conditions = createGw2ConditionResolution({ config, reactions });
  const ctx = createGw2ResolverRuntimeState({
    config,
    horizon: 20,
    query: createGw2CombatQuery({ profession: testProfession, config }),
    helpers: { conditionName: (name) => name },
    queue: new StableEventQueue()
  });
  ctx.effects = captureEffectEmissions({
    submit: (event) => conditions.applyCondition(ctx, event),
    announce: (request) => recordProcStep(ctx, request.announcement)
  }).effects;
  return { ctx, conditions };
}

function relicHarness(name) {
  const relic = createRelicRuntime(name);
  const procs = [];
  const conditions = [];
  const queued = [];
  const ctx = {
    relic,
    config: {}
  };
  const helpers = {
    activeConditionStackCount: () => 0
  };
  ctx.effects = captureEffectEmissions({
    announce: ({ announcement: a }) =>
      procs.push({ kind: a.type, procName: a.name, at: a.at, sourceSkill: a.sourceSkill, detail: a.detail }),
    submit: (event, delivery) => {
      if (delivery.settlement !== 'reaction') return queued.push(event);
      conditions.push(event);
      // Relic-applied conditions re-enter the condition stage like the resolver does.
      relic.rules.condition?.(ctx, relic.state, event, helpers);
      return event;
    }
  }).effects;
  return { relic, ctx, helpers, procs, conditions, queued };
}

function burning(at, overrides = {}) {
  return {
    type: 'condition',
    at,
    source: 'Fixture',
    sourceId: 'fixture.burn',
    skillName: 'Fixture Burn',
    actorType: 'player',
    condition: 'Burning',
    stacks: 1,
    duration: 4,
    ...overrides
  };
}

test('Last Tyrant explodes on the burning after five Fury stacks and respects its 12s cooldown', () => {
  const { relic, ctx, helpers, conditions, queued } = relicHarness('Last Tyrant');
  const apply = (event) => relic.rules.condition(ctx, relic.state, event, helpers);

  for (let at = 0; at < 5; at += 1) apply(burning(at));
  assert.equal(relic.state.stacks, 5);
  assert.equal(conditions.length, 0);

  apply(burning(5));
  assert.equal(conditions.length, 1);
  assert.deepEqual(
    { stacks: conditions[0].stacks, duration: conditions[0].duration, sourceId: conditions[0].sourceId },
    { stacks: 2, duration: 8, sourceId: `relic.${RELIC_IDS.LAST_TYRANT}` }
  );
  // The explosion strike temporarily borrows Bloodstone Explosion's coefficient.
  assert.deepEqual(
    queued.filter((event) => event.type === 'damage').map((event) => [event.coefficient, event.sourceId]),
    [[3, `relic.${RELIC_IDS.LAST_TYRANT}`]]
  );
  // The explosion's own burning does not start the next Fury cycle.
  assert.equal(relic.state.stacks, 0);

  // No Fury stacks build during the cooldown, including at its boundary timestamp.
  for (let at = 6; at <= 17; at += 1) apply(burning(at));
  assert.equal(relic.state.stacks, 0, 'cooldown blocks stack gain');
  assert.equal(conditions.length, 1);

  // Once the cooldown expires, stacks rebuild before the next explosion.
  for (const at of [17.25, 18, 19, 20, 21]) apply(burning(at));
  assert.equal(relic.state.stacks, 5);
  assert.equal(conditions.length, 1);
  apply(burning(22));
  assert.equal(conditions.length, 2);
});

test('Last Tyrant rounds its 250ms stack marker to 40ms ticks and lets the sixth application explode immediately', () => {
  const { relic, ctx, helpers, conditions, queued } = relicHarness('Last Tyrant');
  const apply = (at, sourceId = 'skill-a') =>
    relic.rules.condition(ctx, relic.state, burning(at, { sourceId, stacks: 3 }), helpers);

  // Each eligible application grants one Fury stack, regardless of its Burning stack count.
  for (const [index, at] of [0, 0.28, 0.56, 0.84].entries()) {
    apply(at);
    assert.equal(relic.state.stacks, index + 1);
    // Other sources remain blocked before expiry, even if 250ms has elapsed.
    apply(at + 0.279, 'skill-b');
    assert.equal(relic.state.stacks, index + 1);
    assert.equal(conditions.length, 0);
    assert.equal(queued.length, 0);
  }

  apply(1.12);
  assert.equal(relic.state.stacks, 5);
  apply(1.121);
  assert.equal(relic.state.stacks, 0);
  assert.equal(conditions.length, 1);
  assert.equal(queued.length, 1);

  // Tick rounding is absolute: a marker started at 41ms expires at 320ms.
  const second = relicHarness('Last Tyrant');
  const applySecond = (at) => second.relic.rules.condition(second.ctx, second.relic.state, burning(at), second.helpers);
  applySecond(0.041);
  applySecond(0.319);
  assert.equal(second.relic.state.stacks, 1);
  applySecond(0.32);
  assert.equal(second.relic.state.stacks, 2);
});

test('Last Tyrant ignores non-burning and non-player applications', () => {
  const { relic, ctx, helpers } = relicHarness('Last Tyrant');
  relic.rules.condition(ctx, relic.state, burning(0, { condition: 'Bleeding' }), helpers);
  relic.rules.condition(ctx, relic.state, burning(0, { actorType: 'summon' }), helpers);
  assert.equal(Number(relic.state.stacks || 0), 0);
  relic.rules.condition(ctx, relic.state, burning(0, { actorType: 'effect', ownerActorType: 'player' }), helpers);
  assert.equal(relic.state.stacks, 1);
});

// Consuming Fury ends its report window; the next eligible application starts a fresh stack cycle.
test('Last Tyrant reports zero stacks after its explosion and through cooldown', () => {
  const result = resolveTestGw2Events({
    config: { relic: 'Last Tyrant' },
    events: [...Array.from({ length: 6 }, (_, at) => burning(at)), burning(10), burning(18)],
    endTime: 20
  });
  assert.deepEqual(result.warnings, []);
  const report = result.effectReport;
  const track = report.tracks.find((entry) => entry.kind === 'relic:Relic of the Last Tyrant');
  assert.equal(effectStateAt(report, track, 4).count, 5);
  assert.equal(effectStateAt(report, track, 5).count, 0);
  assert.equal(effectStateAt(report, track, 17).count, 0);
  assert.equal(effectStateAt(report, track, 18).count, 1);
  const summary = effectSummary(track, 0, 20);
  assert.equal(summary.uptime, 7 / 20);
  assert.equal(summary.averageStacks, 17 / 20);
  assert.equal(summary.maximumStackUptime, 1 / 20);
});

// Actual skill packets must finish a four-stack Fury cycle at one impact without multiplying Burning damage.
test('one-time multi-stack Burning skills expose each stack to Last Tyrant at the same impact', async () => {
  const skillsByProfession = {
    elementalist: { 5679: 3, 5675: 2, 5691: 2, 34736: 3, 5542: 2, 30662: 2, 76585: 2, 71907: 2, 5535: 2 },
    engineer: { 72974: 3, 43630: 2 },
    guardian: { 9088: 2, 9089: 3, 9151: 3, 43826: 2, 71817: 5, 42924: 3 },
    necromancer: { 62655: 3 },
    ranger: { 12597: 3 },
    revenant: { 62962: 2, 27162: 2, 46857: 2 },
    thief: { 76895: 2, 76733: 2 },
    warrior: { 14519: 3, 42803: 2, 80226: 2 }
  };
  for (const [profession, skills] of Object.entries(skillsByProfession)) {
    const module = await import(`#gw2/professions/${profession}/catalog.js`);
    for (const [id, totalStacks] of Object.entries(skills)) {
      const skill = module[`${profession}Catalog`].skillsById.get(Number(id));
      const packets = skill.effects
        .flatMap((effect) =>
          materializeSkillEffectApplications({
            skill,
            effect,
            start: 1,
            fullEnd: 2,
            baseEvent: { source: profession, sourceId: skill.id, skillName: skill.name, actorType: 'player' }
          })
        )
        .map(({ event }) => event)
        .filter((event) => event.type === 'condition' && event.condition === 'Burning');
      assert.equal(
        packets.reduce((total, event) => total + event.stacks, 0),
        totalStacks,
        skill.name
      );
      const { ctx, conditions: resolution } = conditionResolver();
      ctx.relic.state.stacks = 4;
      const applications = packets.flatMap((event) => resolution.applyCondition(ctx, event));
      assert.equal(
        applications.reduce((total, event) => total + event.stacks, 0),
        totalStacks,
        skill.name
      );
      assert.ok(
        applications.every((event) => event.stacks === 1 && event.at === canonicalTime(packets[0].at)),
        skill.name
      );
      const explosions = ctx.procSteps.filter((proc) => proc.detail === 'explosion');
      assert.equal(explosions.length, 1, skill.name);
      const relicBurning = ctx.resolved.filter((event) => event.sourceId === `relic.${RELIC_IDS.LAST_TYRANT}`);
      assert.equal(
        relicBurning.reduce((total, event) => total + event.stacks, 0),
        2,
        skill.name
      );
      assert.ok(
        relicBurning.every((event) => event.at === canonicalTime(packets[0].at)),
        skill.name
      );
      assert.equal(ctx.relic.state.stacks, 0, skill.name);
    }
  }
});

// Producers emit totals; the shared resolver splits every condition before dispatching application reactions.
test('profiled condition procs preserve fractional totals and source attribution through resolution', () => {
  for (const [condition, stacks, expected] of [
    ['Burning', 2.5, [1, 1, 0.5]],
    ['Bleeding', 3, [1, 1, 1]]
  ]) {
    const events = [];
    const context = {
      profession: { id: 'elementalist' },
      // Procedural readers consume a constructed owner even in an isolated resolver scenario.
      helpers: createCanonicalCatalog({
        balanceProfiles: [
          {
            id: 'fixture',
            name: 'Fixture',
            profileKind: 'trait',
            effects: [{ type: 'condition', name: 'Fire', condition, stacks, duration: 7 }]
          }
        ]
      }),
      effects: captureEffectEmissions({ submit: (event) => events.push(event) }).effects
    };
    context.effects.emit(
      elementalistProfiledConditionRequest(context, 3, 'fixture', 'Fire', 'Fixture Proc', 123, 'Fixture Skill')
    );
    assert.deepEqual(
      events.map((event) => event.stacks),
      [stacks]
    );
    const { ctx, conditions: resolution } = conditionResolver();
    ctx.relic.state.stacks = 4;
    const applications = events.flatMap((event) => resolution.applyCondition(ctx, event));
    assert.deepEqual(
      applications.map((event) => event.stacks),
      expected
    );
    assert.ok(
      applications.every(
        (event) =>
          event.at === 3 && event.duration === 7 && event.sourceId === 123 && event.triggeredBy === 'Fixture Skill'
      )
    );
    assert.equal(ctx.procSteps.filter((proc) => proc.detail === 'explosion').length, condition === 'Burning' ? 1 : 0);
  }
});

// Scheduled totals exercise the full runtime, including immediate relic Burning and cooldown suppression.
test('bundled Burning triggers Tyrant on the fifth-stack impact and respects cooldown and actor gates', () => {
  for (const output of ['detailed', 'score']) {
    const explosions = [];
    const result = resolveTestGw2Events({
      output,
      config: { relic: 'Last Tyrant', sigilSets: [{ names: [] }] },
      events: [
        burning(0, { stacks: 3, actorType: 'summon' }),
        burning(0, { stacks: 3, offTarget: true }),
        ...[0, 0.28, 0.56, 0.84].map((at) => burning(at, { stacks: 3 })),
        burning(1.12, { stacks: 2 }),
        burning(2, { stacks: 3 }),
        burning(13.12, { stacks: 3 }),
        ...[13.4, 13.68, 13.96, 14.24, 14.52].map((at) => burning(at, { stacks: 2 }))
      ],
      endTime: 15,
      professionReactions: {
        'damage.resolved'(_ctx, event) {
          if (event.sourceId === `relic.${RELIC_IDS.LAST_TYRANT}`) explosions.push(event.at);
        }
      }
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(explosions, [1.12, 14.52]);
  }
});

// Empty applications cannot progress the relic, and unbounded stack counts must never allocate split packets.
test('condition application returns no packets for zero stacks or duration and rejects infinite stacks', () => {
  const { ctx, conditions: resolution } = conditionResolver();
  assert.deepEqual(resolution.applyCondition(ctx, burning(0, { stacks: 0 })), []);
  assert.deepEqual(resolution.applyCondition(ctx, burning(0, { duration: 0 })), []);
  assert.equal(ctx.relic.state.stacks, 0);
  assert.throws(() => resolution.applyCondition(ctx, burning(0, { stacks: Infinity })), /stacks must be finite/);
});

function combo(at, finisherType = 'Blast') {
  // Supply an accepted semantic combo so both hook probes and the full runtime exercise the same event.
  return {
    type: 'combo',
    at,
    actorType: 'player',
    skillName: 'Fixture Finisher',
    finisherType,
    fieldType: 'Fire',
    source: 'Fixture',
    sourceId: 'fixture.finisher',
    comboId: `fixture-combo:${at}`,
    attemptId: `fixture-attempt:${at}`,
    fieldId: 'fixture-field',
    bindingKind: 'field-id',
    applicationCount: 1,
    outcome: comboDefinition('Fire', finisherType).outcome
  };
}

// Accepted stack consumption and buff activation must stay separate through report and chart projection.
test("Visionary charts buildup and Vloxx's Vision with independent counts, caps, and uptime", () => {
  const result = resolveTestGw2Events({
    config: { relic: 'Visionary' },
    events: Array.from({ length: 8 }, (_, at) => combo(at)),
    endTime: 20
  });
  assert.deepEqual(result.warnings, []);
  const report = result.effectReport;
  const buildup = report.tracks.find((track) => track.kind === 'relic:Relic of the Visionary');
  const vision = report.tracks.find((track) => track.kind === "relic:Vloxx's Vision");
  assert.ok(buildup);
  assert.ok(vision);
  assert.equal(buildup.countLimit, 8);
  assert.equal(vision.countLimit, 1);
  assert.equal(effectStateAt(report, buildup, 6).count, 7);
  assert.equal(effectStateAt(report, buildup, 7).count, 0);
  assert.equal(effectStateAt(report, vision, 6).count, 0);
  assert.equal(effectStateAt(report, vision, 7).count, 1);
  assert.equal(effectStateAt(report, vision, 15).count, 0);
  const series = buildChartSeries(result, 1000);
  assert.ok(series.effects['Relic of the Visionary']);
  assert.ok(series.effects["Vloxx's Vision"]);
  assert.equal(series.effectSummaries['Relic of the Visionary'].averageStacks, 28 / 20);
  assert.equal(series.effectSummaries['Relic of the Visionary'].uptime, 7 / 20);
  assert.equal(series.effectSummaries['Relic of the Visionary'].maximumStacks, 8);
  assert.equal(series.effectSummaries["Vloxx's Vision"].uptime, 8 / 20);
  assert.equal(series.effectSummaries["Vloxx's Vision"].maximumStacks, 1);
});

// Buff expiry reopens buildup without reviving old stacks or extending the previous buff window.
test("Visionary reports a new buildup and buff cycle after Vloxx's Vision expires", () => {
  const result = resolveTestGw2Events({
    config: { relic: 'Visionary' },
    events: [
      ...Array.from({ length: 8 }, (_, at) => combo(at)),
      combo(10),
      ...Array.from({ length: 8 }, (_, index) => combo(15 + index))
    ],
    endTime: 32
  });
  assert.deepEqual(result.warnings, []);
  const report = result.effectReport;
  const buildup = report.tracks.find((track) => track.kind === 'relic:Relic of the Visionary');
  const vision = report.tracks.find((track) => track.kind === "relic:Vloxx's Vision");
  assert.equal(effectStateAt(report, buildup, 10).count, 0);
  assert.equal(effectStateAt(report, buildup, 15).count, 1);
  assert.equal(effectStateAt(report, vision, 15).count, 0);
  assert.equal(effectStateAt(report, buildup, 22).count, 0);
  assert.equal(effectStateAt(report, vision, 22).count, 1);
  assert.equal(effectStateAt(report, vision, 30).count, 0);
});

test("Visionary grants Vloxx's Vision at eight combos for 8s of +10% strike and condition damage", () => {
  const { relic, ctx } = relicHarness('Visionary');
  for (let at = 0; at < 7; at += 1) relic.rules.combo(ctx, relic.state, combo(at));
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'strike', 7), 0);

  relic.rules.combo(ctx, relic.state, combo(7));
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'strike', 7), 0.1);
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'condition', 14.9), 0.1);
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'condition', 15), 0);

  // Stacks do not build while the buff is active.
  relic.rules.combo(ctx, relic.state, combo(10));
  assert.equal(relic.state.stacks, 0);
  relic.rules.combo(ctx, relic.state, combo(15));
  assert.equal(relic.state.stacks, 1);
});

test('Visionary counts whirl finishers at most once per 3s', () => {
  const { relic, ctx } = relicHarness('Visionary');
  for (const at of [0, 0, 0.5, 2.9]) relic.rules.combo(ctx, relic.state, combo(at, 'Whirl'));
  assert.equal(relic.state.stacks, 1);
  relic.rules.combo(ctx, relic.state, combo(1, 'Projectile'));
  relic.rules.combo(ctx, relic.state, combo(3, 'Whirl'));
  assert.equal(relic.state.stacks, 2, 'the whirl ICD blocks through its boundary');
  relic.rules.combo(ctx, relic.state, combo(3.25, 'Whirl'));
  assert.equal(relic.state.stacks, 3);
});
