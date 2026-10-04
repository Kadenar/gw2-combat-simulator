import { playerHealthFraction, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { ENGINEER_TRAIT_IDS } from '#gw2/professions/engineer/data/ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/evaluate.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { headlessApp, firstPresetBuildPath } from '#tests/helpers/skill-damage.js';

const occurrence = (id, fields = {}) => ({
  id: String(id),
  effect: { kind: 'skill', id },
  name: 'Test effect',
  source: 'Skill',
  icon: '',
  unit: 'activation',
  ...fields
});
const fixture = (effects, hooks = {}) =>
  defineTestProfession({
    id: 'damage-test',
    name: 'Damage test',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 991001,
          name: 'Measured',
          castTimeMs: 0,
          effects: effects.map((effect) => (effect.type === 'strike' ? { ...effect, weaponStrength: 1000 } : effect))
        }
      ]
    }),
    hooks
  });
const evaluate = (profession, occurrences, config = {}, cache) =>
  evaluateSkillDamage({ config, occurrences }, profession, cache).occurrences;

// Assumed activation enters below eligibility; the ordinary scheduler must still consult it.
test('direct damage does not query activation availability', () => {
  let checks = 0;
  const profession = fixture([{ type: 'strike', coefficient: 1 }], {
    availability() {
      checks++;
      return { ready: false, reason: 'Not ready.' };
    }
  });
  const [row] = evaluate(profession, [occurrence(991001)]);
  assert.equal(row.status, 'measured');
  assert.equal(checks, 0);
  const combat = simulateGw2({ profession, rotation: [{ type: 'cast', skillId: 991001 }], config: {} });
  assert.ok(combat.steps[0].invalid);
  assert.ok(checks > 0);
});

test('Elemental Explosion damage is measurable without stored bullets while combat still requires them', async () => {
  const app = await headlessApp('elementalist', await firstPresetBuildPath('elementalist'));
  const config = {
    ...app.adapter.simulationConfig(app),
    pistolBullets: { Fire: false, Water: false, Air: false, Earth: false },
    weapons: ['Pistol', 'Warhorn']
  };
  const [row] = evaluate(app.profession, [occurrence(ID.ELEMENTAL_EXPLOSION)], config);
  assert.equal(row.status, 'measured');
  const combat = simulateGw2({
    profession: app.profession,
    config,
    rotation: [{ type: 'cast', skillId: ID.ELEMENTAL_EXPLOSION }]
  });
  assert.ok(combat.steps[0].invalid);
});

test('owned delayed applications complete their payout without an arbitrary short sampling tail', () => {
  const profession = fixture([
    {
      type: 'condition',
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      ticks: [0, 2000, 4000].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 2 }))
    }
  ]);
  const [row] = evaluate(profession, [occurrence(991001)]);
  const combat = simulateGw2({
    profession,
    config: {},
    rotation: [{ type: 'cast', skillId: 991001 }],
    observationPolicy: { kind: 'tail', durationMs: 10000 }
  });
  assert.equal(row.status, 'measured');
  assert.equal(
    row.measurement.conditionDamage,
    combat.resolvedEvents
      .filter((event) => event.condition === 'Bleeding' && event.effectiveDuration != null)
      .reduce((total, event) => total + event.damage, 0)
  );
});

test('unrelated damage reactions are not invoked when measuring a skill', () => {
  let reactions = 0;
  const profession = fixture([{ type: 'strike', coefficient: 1 }], {
    reactions: {
      'damage.resolved'() {
        reactions++;
      }
    }
  });
  evaluate(profession, [occurrence(991001)]);
  assert.equal(reactions, 0);
});

test('Fractal evaluates its shared payload without a Bleeding prerequisite and without changing target assumptions', async () => {
  const app = await headlessApp('elementalist', await firstPresetBuildPath('elementalist'));
  const config = { ...app.adapter.simulationConfig(app), relic: 'Fractal', target: { health: 0, conditions: {} } };
  const saved = structuredClone(config);
  const [row] = evaluate(
    app.profession,
    [occurrence('fractal', { effect: { kind: 'relic', id: RELIC_IDS.FRACTAL }, source: 'Relic', unit: 'occurrence' })],
    config
  );
  assert.equal(row.status, 'measured');
  assert.ok(row.measurement.conditionDamage > 0);
  assert.deepEqual(config, saved);
});

test('measured zero, invalid inputs, and unsupported content remain distinct', () => {
  const profession = fixture([{ type: 'strike', coefficient: 0 }]);
  const rows = evaluate(profession, [
    occurrence(991001),
    occurrence(991001, { id: 'invalid', inputs: { stacks: NaN } }),
    occurrence(991002)
  ]);
  assert.deepEqual(
    rows.map((row) => row.status),
    ['zero', 'missing-input', 'unsupported']
  );
  assert.equal(rows[0].damaging, true);
  assert.equal(rows[0].measurement.total, 0);
});

test('each occurrence has fresh state and caches include damage inputs and configuration', () => {
  const profession = fixture([{ type: 'strike', coefficient: 1 }]);
  const cache = new Map();
  const [alone] = evaluate(profession, [occurrence(991001)], { stats: { power: 1000 } }, cache);
  const rows = evaluate(
    profession,
    [occurrence(991001), occurrence(991001, { id: 'second' })],
    { stats: { power: 1000 } },
    cache
  );
  assert.equal(rows[0].measurement.total, alone.measurement.total);
  assert.equal(rows[1].measurement.total, alone.measurement.total);
  const [stronger] = evaluate(profession, [occurrence(991001)], { stats: { power: 2000 } }, cache);
  assert.ok(stronger.measurement.total > alone.measurement.total);
});

// Damage predicates retain their meaning even though occurrence eligibility is assumed.
test('damage modifiers retain full player health and selected target health', () => {
  const profession = defineTestProfession({
    id: 'health-damage',
    name: 'Health damage',
    catalog: fixture([{ type: 'strike', coefficient: 1 }]).catalog,
    modifiers: {
      modifyStrikeDamage(context, multiplier) {
        assert.equal(playerHealthFraction(context), 1);
        return multiplier * (targetHealthBelow(context, 0.5) ? 2 : 1);
      }
    }
  });
  const [high] = evaluate(profession, [occurrence(991001)], { target: { health: 100, fixedHealthFraction: 1 } });
  const [low] = evaluate(profession, [occurrence(991001)], { target: { health: 100, fixedHealthFraction: 0.25 } });
  assert.equal(high.status, 'measured');
  assert.equal(
    low.measurement.strikeBreakdown.outgoingMultiplier,
    high.measurement.strikeBreakdown.outgoingMultiplier * 2
  );
  assert.ok(low.measurement.total > high.measurement.total);
});

test('a shared cache cannot reuse a result from different content', () => {
  const cache = new Map();
  const [first] = evaluate(fixture([{ type: 'strike', coefficient: 1 }]), [occurrence(991001)], {}, cache);
  const [second] = evaluate(fixture([{ type: 'strike', coefficient: 2 }]), [occurrence(991001)], {}, cache);
  assert.equal(second.measurement.coefficient, first.measurement.coefficient * 2);
  assert.ok(second.measurement.total > first.measurement.total);
});

test('trait occurrence damage does not inherit trigger probability', async () => {
  const app = await headlessApp('engineer', await firstPresetBuildPath('engineer'));
  const id = ENGINEER_TRAIT_IDS.SHRAPNEL;
  const config = { ...app.adapter.simulationConfig(app), selectedTraitIds: [id] };
  const definition = occurrence('shrapnel', {
    source: 'Trait',
    unit: 'occurrence',
    effect: { kind: 'profile', id, ownerId: id }
  });
  const [zeroChance] = evaluate(app.profession, [definition], { ...config, procRateOverrides: { [id]: 0 } });
  const [certain] = evaluate(app.profession, [definition], { ...config, procRateOverrides: { [id]: 1 } });
  assert.equal(zeroChance.status, 'measured');
  assert.equal(zeroChance.measurement.total, certain.measurement.total);
});
