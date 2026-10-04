import { defineTestProfession } from '#tests/helpers/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateSkillDamage } from '#gw2/platform/skill-damage/evaluate.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { WARRIOR_SKILL_IDS as WARRIOR } from '#gw2/professions/warrior/data/ids.js';
import { headlessApp } from '#tests/helpers/skill-damage.js';

const BLADESWORN = 'data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json';

async function bladesworn() {
  const app = await headlessApp('warrior', BLADESWORN);
  const config = {
    ...app.adapter.simulationConfig(app),
    randomness: { mode: 'deterministic', seed: 3 },
    criticalDamageMode: 'averaged',
    target: { ...app.adapter.simulationConfig(app).target, health: 0 }
  };
  const runs = [];
  const simulate = (rotation, probeConfig, tailMs) => {
    runs.push({ rotation, tailMs });
    return simulateGw2({
      profession: app.profession,
      rotation,
      config: probeConfig,
      damageDiagnostics: true,
      observationPolicy: { kind: 'tail', durationMs: tailMs }
    });
  };

  return { config, simulate, runs };
}

const probe = (id, skillId, fields = {}) => ({ id, skillId, setup: [], tailMs: 1_000, ...fields });

test('a probe counts only its measured cast and sends proc packets to proc rows', async () => {
  const { config, simulate, runs } = await bladesworn();
  const evaluation = evaluateSkillDamage(
    {
      config,
      probes: [probe('gash', WARRIOR.GASH, { name: 'Gash', setup: [{ type: 'cast', skillId: WARRIOR.SEVER_ARTERY }] })]
    },
    simulate
  );
  const [{ measurement }] = evaluation.probes;
  // Setup casts run off-target, so the measured row cannot contain Sever Artery's damage.
  assert.equal(runs[0].rotation[0].offTarget, true);
  const result = simulate(runs.at(-1).rotation, config, runs.at(-1).tailMs);
  const activationId = result.steps.at(-1).activationId;
  const owned = result.resolvedEvents.filter(
    (event) =>
      event.activationId === activationId && !['Trait', 'Relic', 'Sigil', 'Rune', 'Food'].includes(event.source)
  );
  assert.equal(
    measurement.total,
    owned.reduce((total, event) => total + (event.damage || 0), 0)
  );
  assert.ok(owned.every((event) => event.skillId === WARRIOR.GASH));
  assert.ok(evaluation.procs.some((proc) => proc.source === 'Food' && proc.observedOn.includes('Gash')));
});

test('a measured condition pays out in full even when the first observation tail is too short', async () => {
  const { config, simulate, runs } = await bladesworn();
  const short = evaluateSkillDamage({ config, probes: [probe('sever', WARRIOR.SEVER_ARTERY)] }, simulate);
  // The evaluator extends the tail once the application outlives it.
  assert.ok(runs.at(-1).tailMs > 1_000);
  const long = evaluateSkillDamage(
    { config, probes: [probe('sever', WARRIOR.SEVER_ARTERY, { tailMs: 30_000 })] },
    simulate
  );
  const [shortRow] = short.probes;
  const [longRow] = long.probes;
  assert.ok(shortRow.measurement.conditionDamage > 0);
  assert.equal(shortRow.measurement.conditionDamage, longRow.measurement.conditionDamage);
});

test('probes are isolated from each other in one batch', async () => {
  const { config, simulate } = await bladesworn();
  const alone = evaluateSkillDamage({ config, probes: [probe('ham', WARRIOR.HAMSTRING)] }, simulate);
  const together = evaluateSkillDamage(
    { config, probes: [probe('sever', WARRIOR.SEVER_ARTERY), probe('ham', WARRIOR.HAMSTRING)] },
    simulate
  );
  assert.deepEqual(together.probes[1].measurement, alone.probes[0].measurement);
});

test('a refused probe reports the runtime reason and yields no measurement', async () => {
  const { config, simulate } = await bladesworn();
  const [result] = evaluateSkillDamage(
    { config, probes: [probe('slash', WARRIOR.DRAGON_SLASH_FORCE)] },
    simulate
  ).probes;
  assert.equal(result.measurement, null);
  assert.match(result.rejected, /Dragon Trigger/);
});

test('variant probes measure every level and show the declared primary variant', async () => {
  const { config, simulate } = await bladesworn();
  const [result] = evaluateSkillDamage(
    {
      config,
      probes: [
        probe('slash', WARRIOR.DRAGON_SLASH_FORCE, {
          setup: [{ type: 'cast', skillId: WARRIOR.DRAGON_TRIGGER }],
          config: { initialResource: 100 },
          variants: [1, 2, 3].map((charges) => ({
            id: String(charges),
            label: `${charges}`,
            cast: { releaseAtCharges: charges }
          })),
          primaryVariantId: '2'
        })
      ]
    },
    simulate
  ).probes;
  assert.equal(result.primaryVariantId, '2');
  assert.equal(result.variants.length, 3);
  assert.deepEqual(result.measurement, result.variants[1].measurement);
  const totals = result.variants.map((variant) => variant.measurement.total);
  assert.ok(totals[0] < totals[1] && totals[1] < totals[2]);
});

test('initial buffs are executed at time zero with their fixed duration and read by traits', async () => {
  const { config } = await bladesworn();
  const app = await headlessApp('warrior', BLADESWORN);
  const run = (initialBuffs) =>
    simulateGw2({
      profession: app.profession,
      rotation: [{ type: 'cast', skillId: WARRIOR.SEVER_ARTERY }],
      config: { ...config, ...(initialBuffs ? { initialBuffs } : {}) }
    });
  const held = run([{ kind: 'fierce-as-fire', stacks: 3, duration: 60, name: 'Fierce as Fire' }]);
  const buff = held.events.find((event) => event.type === 'buff' && event.kind === 'fierce-as-fire');
  assert.equal(buff?.at, 0);
  assert.equal(buff?.stacks, 3);
  assert.equal(buff?.duration, 60);
  // The fixture build selects Fierce as Fire, whose damage bonus reads the held stacks.
  assert.ok(held.strikeDamage > run(null).strikeDamage);
});

test('proc owners claim packets by source, source id, or name, and lend their icon and name', () => {
  const result = {
    events: [],
    steps: [{ ri: 0, skill: 'Probe', start: 0, end: 500, activationId: 'cast:1' }],
    warnings: [],
    rotationEndTime: 0.5,
    observationEndTime: 10,
    resolvedEvents: [
      {
        type: 'damage',
        at: 0.2,
        damage: 1000,
        eventOrder: 3,
        hits: 1,
        coefficient: 1,
        activationId: 'cast:1',
        source: 'warrior',
        sourceId: 1,
        actorType: 'player',
        name: 'Probe'
      },
      // A trait without its own activation retains the recorded cause of its measured hit.
      {
        type: 'condition',
        at: 0.2,
        condition: 'Bleeding',
        stacks: 1,
        effectiveDuration: 2,
        naturalExpiresAt: 2.2,
        damage: 300,
        parentEventOrder: 3,
        source: 'Strength of Stone',
        sourceId: 'Strength of Stone',
        name: 'Strength of Stone — Bleeding',
        actorType: 'player'
      },
      // A relic packet stamped with the measured activation still belongs to the relic's row.
      {
        type: 'damage',
        at: 0.2,
        damage: 50,
        activationId: 'cast:1',
        source: 'Relic',
        sourceId: 'relic.7',
        skillName: 'Relic of the Fractal',
        name: 'Relic of the Fractal',
        actorType: 'effect',
        parentEventOrder: 3
      }
    ]
  };
  const evaluation = evaluateSkillDamage(
    {
      config: {},
      probes: [{ id: 'probe', skillId: 1, name: 'Probe', setup: [], tailMs: 1_000 }],
      procOwners: [
        {
          key: '99',
          source: 'Trait',
          name: 'Strength of Stone',
          icon: 'stone.png',
          matches: ['Strength of Stone', '99']
        },
        { key: 'Fractal', source: 'Relic', icon: 'fractal.png', matches: ['relic.7'] }
      ]
    },
    () => result
  );
  assert.equal(evaluation.probes[0].measurement.total, 1000);
  const procs = Object.fromEntries(evaluation.procs.map((proc) => [proc.name, proc]));
  assert.equal(procs['Strength of Stone'].icon, 'stone.png');
  assert.equal(procs['Strength of Stone'].perTrigger.conditionDamage, 300);
  assert.equal(procs['Relic of the Fractal'].icon, 'fractal.png');
  assert.equal(procs['Relic of the Fractal'].perTrigger.strike, 50);
});

// Later accepted pulses can reveal new expiries, requiring more than one observation extension.
test('condition tails extend until every pulse of the measured cast has settled', () => {
  const profession = defineTestProfession({
    id: 'preview-pulses',
    name: 'Preview pulses',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 991001,
          name: 'Pulses',
          castTimeMs: 0,
          effects: [
            {
              type: 'condition',
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              ticks: [0, 2000, 4000].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 1 }))
            }
          ]
        }
      ]
    })
  });
  const tails = [];
  const simulate = (rotation, config, tailMs) => {
    tails.push(tailMs);
    return simulateGw2({ profession, rotation, config, observationPolicy: { kind: 'tail', durationMs: tailMs } });
  };

  const request = { config: {}, probes: [probe('pulses', 991001)] };
  const short = evaluateSkillDamage(request, simulate);
  assert.ok(tails.length > 2);
  const long = evaluateSkillDamage({ ...request, probes: [probe('pulses', 991001, { tailMs: 10000 })] }, simulate);
  assert.equal(short.probes[0].measurement.conditionDamage, long.probes[0].measurement.conditionDamage);
});

// Setup and unrelated ambient procs must never appear as consequences of the measured skill.
test('proc attribution follows recorded causes and excludes setup reactions', () => {
  const base = { type: 'damage', actorType: 'player', at: 1, damage: 10 };
  const result = {
    steps: [{ ri: 1, activationId: 'cast:2', start: 1000, end: 1500 }],
    warnings: [],
    rotationEndTime: 1.5,
    observationEndTime: 10,
    events: [
      { type: 'action', eventOrder: 1, activationId: 'cast:1' },
      { type: 'action', eventOrder: 2, activationId: 'cast:2' }
    ],
    resolvedEvents: [
      { ...base, source: 'Trait', sourceId: 99, name: 'Setup proc', parentEventOrder: 1 },
      { ...base, source: 'Trait', sourceId: 100, name: 'Measured proc', parentEventOrder: 2 },
      { ...base, source: 'Trait', sourceId: 101, name: 'Ambient proc' },
      { ...base, source: 'Player', sourceId: 2, name: 'Measured', activationId: 'cast:2' }
    ]
  };
  const evaluation = evaluateSkillDamage(
    { config: {}, probes: [probe('measured', 2, { setup: [{ type: 'cast', skillId: 1 }] })] },
    () => result
  );
  assert.deepEqual(
    evaluation.procs.map((proc) => proc.name),
    ['Measured proc']
  );
  assert.equal(evaluation.probes[0].measurement.total, 10);
});
