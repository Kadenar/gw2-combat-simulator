import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfession, professionOptions } from '#gw2/profession-registry.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { planningState } from '#gw2/platform/results/end-state.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

// Deep snapshots retain Core/elite ownership, nested resource clocks and pending work; a shallow projection cannot prove purity.
function snapshot(runtime) {
  return structuredClone({
    profession: runtime.profession,
    cooldowns: runtime.cooldowns,
    rechargeProgress: runtime.rechargeProgress,
    ammo: runtime.ammo,
    lockouts: runtime.lockouts,
    inFlight: runtime.inFlight,
    history: runtime.history,
    steps: runtime.steps,
    queue: Object.fromEntries(Object.entries(runtime.queue).filter(([, value]) => typeof value !== 'function'))
  });
}

for (const { id } of professionOptions) {
  test(`${id}: every Core/elite availability composition is a pure planning query`, async () => {
    const family = await loadProfession(id);
    for (const module of family.nativeDefinition.modules) {
      const config = { specialization: module.id };
      const profession = family.runtimeFor(config);
      const candidates = profession.catalog.skills.filter(
        (skill) => !skill.simulatorExcluded && !skill.initialStateOnly
      );
      const result = observeGw2Runtime({ profession, config, rotation: [] });
      const runtime = observedRuntime(result);
      assert.deepEqual(
        Object.keys(result.planningState.availability).sort(),
        candidates.map((skill) => String(skill.id)).sort()
      );
      const sweep = () => {
        const before = snapshot(runtime);
        for (const skill of candidates) {
          const verdict = profession.availability(runtime, skill, { type: 'cast', skillId: skill.id });
          assert.equal(typeof verdict.ready, 'boolean');
          if (!verdict.ready) {
            assert.equal(typeof verdict.code, 'string');
            assert.equal(typeof verdict.reason, 'string');
            assert.ok(verdict.retryAt === null || Number.isFinite(verdict.retryAt));
          }
        }

        assert.deepEqual(snapshot(runtime), before, `${id}/${module.id} at ${runtime.time}`);
      };

      sweep();
      // Follow-up queries cover visible-but-arming, ready, and exact-expiry boundaries without executing the queue.
      if (runtime.profession.core.availableFlips) {
        for (const skill of candidates) runtime.profession.core.availableFlips[skill.id] = armSkillFlip({}, 0, 1, 2);
        for (const at of [0, 1, 2]) {
          runtime.time = at;
          sweep();
        }
      }

      // Actual entry casts exercise mode/resource paths beyond factory state, including Core-only compositions.
      const entries = candidates.filter(
        (skill) => skill.type === 'Profession' || skill.slot?.startsWith('Profession_')
      );
      for (const skill of entries) {
        let calls = 0;
        runGw2Runtime({
          config,
          rotation: [{ type: 'cast', skillId: skill.id }],
          profession: {
            ...profession,
            availability(context, candidate, command) {
              const before = snapshot(context);
              const verdict = profession.availability(context, candidate, command);
              assert.deepEqual(snapshot(context), before, `${id}/${module.id}: ${candidate.name}`);
              calls++;
              return verdict;
            }
          }
        });
        assert.ok(calls >= candidates.length);
      }
    }
  });
}

// Trait-selected queries must also be pure after actual pending strikes have elapsed.
test('Fresh Air planning capture leaves elapsed strike candidates and runtime stores untouched', async () => {
  const family = await loadProfession('elementalist');
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Staff',
    startAttunement: 'Fire',
    selectedTraitIds: [TRAIT.FRESH_AIR]
  };
  const profession = family.runtimeFor(config);
  let observedElapsedCandidates = false;
  runGw2Runtime({
    profession: {
      ...profession,
      availability(runtime, skill, command) {
        if (
          runtime.rotationEndTime != null &&
          runtime.profession.core.freshAirCandidates.some((at) => at <= runtime.time)
        )
          observedElapsedCandidates = true;
        const before = snapshot(runtime);
        const verdict = profession.availability(runtime, skill, command);
        assert.deepEqual(snapshot(runtime), before, skill.name);
        return verdict;
      }
    },
    config,
    rotation: ['Fireball', { type: 'wait', durationMs: 2000 }]
  });
  assert.equal(observedElapsedCandidates, true);
});

test('planning verdicts and state are detached; score runs never capture candidates', async () => {
  const family = await loadProfession('warrior');
  const config = { specialization: 'Bladesworn' };
  const profession = family.runtimeFor(config);
  const runtime = observedRuntime(observeGw2Runtime({ profession, config, rotation: [] }));
  const verdict = { ready: false, code: 'fixture.denied', reason: 'Wait', retryAt: 2 };
  const observation = planningState(
    { ...runtime, catalog: profession.catalog },
    profession.projectPlanningState,
    undefined,
    () => verdict
  );
  const before = structuredClone(observation);
  verdict.reason = 'Changed';
  runtime.profession.core.availableFlips = {};
  runtime.profession.specialization.state.gunsaberActive = true;
  runtime.cooldowns.set(123, 99);
  assert.deepEqual(observation, before);
  let queries = 0;
  runGw2Runtime({
    profession: {
      ...profession,
      availability() {
        queries++;
        return { ready: true };
      }
    },
    config,
    rotation: [],
    output: 'score'
  });
  assert.equal(queries, 0);
});

// A stale cached recharge must not be refreshed by merely inspecting either identity of Beguiling Haze.
test('Conduit recharge queries leave the committed resource state untouched', async () => {
  const family = await loadProfession('revenant');
  const config = {
    specialization: 'Conduit',
    selectedLegends: ['LegendaryEntity', 'LegendaryAssassin'],
    startingLegend: 'LegendaryEntity',
    initialEnergy: 100
  };
  const profession = family.runtimeFor(config);
  const runtime = observedRuntime(observeGw2Runtime({ profession, config, rotation: [] }));
  Object.assign(runtime.profession.specialization.state, {
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    beguilingHazeRecharge: { startedAt: 0, work: 20 }
  });
  const before = snapshot(runtime);
  for (const skill of profession.catalog.skills.filter((skill) => skill.name === 'Beguiling Haze')) {
    const verdict = profession.availability(runtime, skill, { type: 'cast', skillId: skill.id });
    assert.equal(verdict.ready, false);
    assert.equal(verdict.code, 'revenant.beguiling-haze-cooldown');
    assert.ok(verdict.retryAt > 0);
  }

  assert.deepEqual(snapshot(runtime), before);
});
