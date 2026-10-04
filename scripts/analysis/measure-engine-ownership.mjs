import { performance } from 'node:perf_hooks';
import { loadProfession } from '#gw2/profession-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/evaluate.js';

// Native workloads exercise accepted mechanics; validate them before collecting any timings.
const base = {
  randomness: { mode: 'expected', seed: 123 },
  selectedTraitIds: [],
  stats: { power: 2000, precision: 2000, ferocity: 500, conditionDamage: 1000 },
  target: { armor: 2597 }
};
const wait = (durationMs) => ({ type: 'wait', durationMs });
const definitions = [
  {
    name: 'core-warrior',
    profession: 'warrior',
    config: { specialization: 'Core', weapons: ['Axe', 'Axe'] },
    rotation: Array(30).fill('Cyclone Axe'),
    isolated: 'Cyclone Axe'
  },
  {
    name: 'dragon-trigger',
    profession: 'warrior',
    config: { specialization: 'Bladesworn', initialResource: 15 },
    rotation: [
      { type: 'combat-start' },
      'Dragon Trigger',
      { name: 'Dragon Slash—Force', releaseAtCharges: 2, releaseDelayMs: 960, impactDelayMs: 500 }
    ],
    verify(result) {
      const release = result.events.find(
        (event) => event.resource === 'dragon charges' && event.reason === 'profession mechanic'
      );
      if (release?.chargesReached !== 2 || release.at <= 1.44)
        throw new Error('Dragon fixture must stall on Flow and hold its release.');
    }
  },
  {
    name: 'luminary',
    profession: 'guardian',
    config: { specialization: 'Luminary' },
    rotation: [
      'Enter Radiant Forge',
      'Gleaming Blade',
      'Glaring Burst',
      'Glaring Burst',
      'Luminous Staff',
      'Glaring Burst'
    ],
    verify(result) {
      const details = result.steps.filter((step) => step.skill === 'Glaring Burst').map((step) => step.detail);
      if (details.join('|') !== 'Variant: Sword (fast)|Variant: Sword (slow)|Variant: Staff')
        throw new Error('Luminary fixture must exercise variant selection.');
    }
  },
  {
    name: 'photon-forge-exit',
    profession: 'engineer',
    config: { specialization: 'Holosmith' },
    rotation: ['Engage Photon Forge', 'Corona Burst', wait(6000), 'Deactivate Photon Forge'],
    verify(result) {
      if (!result.events.some((event) => event.type === 'engineer.heat' && event.reason === 'exit-forge'))
        throw new Error('Forge fixture must exit.');
    }
  },
  {
    name: 'photon-forge-overheat',
    profession: 'engineer',
    config: { specialization: 'Holosmith', initialHeat: 90 },
    rotation: ['Engage Photon Forge', 'Light Strike', wait(6000)],
    verify(result) {
      if (!result.planningState.profession.overheated) throw new Error('Forge fixture must overheat.');
    }
  },
  {
    name: 'mesmer-illusions',
    profession: 'mesmer',
    config: { specialization: 'Core', weapons: ['Sword', 'Sword'] },
    rotation: ['Illusionary Leap', 'Phantasmal Swordsman', wait(5000), 'Mind Wrack']
  }
];
const measurements = {};
const summarize = (samples) => {
  samples.sort((a, b) => a - b);
  return { min: samples[0], median: samples[4], max: samples[8] };
};

for (const definition of definitions) {
  const profession = await loadProfession(definition.profession);
  const config = { ...base, ...definition.config };
  const catalog = profession.runtimeFor(config).catalog;
  const rotation = definition.rotation.map((command) => {
    if (typeof command !== 'string' && !command.name) return command;
    const { name, ...options } = typeof command === 'string' ? { name: command } : command;
    const skill = catalog.skillsByName.get(name);
    if (!skill) throw new Error(`Unknown performance skill: ${name}`);
    return { type: 'cast', skillId: skill.id, ...options };
  });
  const options = { profession, config, rotation, observationPolicy: { kind: 'tail', durationMs: 5000 } };
  const smoke = simulateGw2(options);
  if (smoke.warnings.length || !(smoke.totalDamage > 0))
    throw new Error(`Invalid ${definition.name}: ${smoke.warnings.join('; ')}`);
  definition.verify?.(smoke);
  const runs = {
    detailed: (onPhase) => simulateGw2({ ...options, onPhase }),
    score: (onPhase) => simulateGw2({ ...options, output: 'score', onPhase })
  };
  if (definition.isolated) {
    const skill = catalog.skillsByName.get(definition.isolated);
    const occurrence = {
      id: String(skill.id),
      effect: { kind: 'skill', id: skill.id },
      name: skill.name,
      source: 'Skill',
      icon: '',
      unit: 'activation'
    };
    runs.isolated = () => evaluateSkillDamage({ config, occurrences: [occurrence] }, profession);
    if (runs.isolated().occurrences[0].status !== 'measured') throw new Error(`Unmeasurable ${definition.name}`);
  }

  for (const [mode, run] of Object.entries(runs)) {
    for (let warmup = 0; warmup < 10; warmup++) run();
    const totals = [];
    const phases = {};
    for (let sample = 0; sample < 9; sample++) {
      const phaseTotals = {};
      const onPhase = (phase, milliseconds) => {
        phaseTotals[phase] = (phaseTotals[phase] ?? 0) + milliseconds;
      };

      const start = performance.now();
      for (let iteration = 0; iteration < 20; iteration++) run(onPhase);
      totals.push((performance.now() - start) / 20);
      for (const [phase, elapsed] of Object.entries(phaseTotals)) (phases[phase] ??= []).push(elapsed / 20);
    }

    measurements[`${definition.name}/${mode}`] = {
      total: summarize(totals),
      phases: Object.fromEntries(Object.entries(phases).map(([phase, samples]) => [phase, summarize(samples)]))
    };
  }
}

console.log(
  JSON.stringify(
    { node: process.version, warmups: 10, samples: 9, runsPerSample: 20, milliseconds: measurements },
    null,
    2
  )
);
