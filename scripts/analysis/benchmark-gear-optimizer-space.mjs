/** Measure unique-stat preparation without simulating the enormous Cartesian products it replaces. */
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { captureGearOptimizerRequest, createOptimizerSpace } from '#gw2/app/simulation/gear-optimizer.js';
import { estimateOptimizerCount, groupOptimizerSpace } from '#gw2/app/simulation/gear-optimizer-space.js';

const adapter = await loadProfessionAppAdapter('warrior');
const build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults());
for (const prefixes of [
  ["Berserker's", "Assassin's"],
  ["Berserker's", "Assassin's", "Dragon's"]
]) {
  const request = captureGearOptimizerRequest(
    { build, adapter, profession: adapter.profession, contentId: adapter.id, buildRevision: 0, patchId: 'current' },
    { prefixes }
  );
  const ordinary = createOptimizerSpace(request, adapter);
  const started = performance.now();
  let space;
  try {
    space = groupOptimizerSpace(ordinary, adapter);
  } catch (error) {
    if (!(error instanceof RangeError) || !error.message.includes('preparation memory limit')) throw error;
    console.log(JSON.stringify({ prefixes, preparationStopped: error.message }));
    continue;
  }
  
  console.log(
    JSON.stringify({
      prefixes,
      rawAssignments: ordinary.rawCount.toString(),
      previousGroupedCandidates: estimateOptimizerCount(ordinary, adapter).toString(),
      uniqueCandidates: space.count.toString(),
      preparationMs: Math.round(performance.now() - started)
    })
  );
}

// Reproduce the two-prefix Scepter/Dagger search, including nineteen infusion splits.
const elementalist = await loadProfessionAppAdapter('elementalist');
const singleSetBuild = elementalist.toApplicationBuild(elementalist.profession.createBuildDefaults());
singleSetBuild.weapons = ['Scepter', 'Dagger'];
const combinedRequest = captureGearOptimizerRequest(
  {
    build: singleSetBuild,
    adapter: elementalist,
    profession: elementalist.profession,
    contentId: elementalist.id,
    buildRevision: 0,
    patchId: 'current'
  },
  {
    prefixes: ["Berserker's", "Assassin's"],
    rune: ['Dragonhunter', 'Scholar'],
    relic: ['Bloodstone', 'Fireworks'],
    sigils: [
      [
        ['Force', 'Accuracy'],
        ['Accuracy', 'Impact']
      ]
    ],
    food: ['Cilantro Lime Sous-Vide Steak', 'Plate of Coq Au Vin with Salsa'],
    utility: ['Superior Sharpening Stone'],
    infusionStats: ['Power', 'Precision'],
    infusionCount: 18
  }
);
const combinedStart = performance.now();
const combined = groupOptimizerSpace(createOptimizerSpace(combinedRequest, elementalist), elementalist);
console.log(
  JSON.stringify({
    configuration: 'Scepter/Dagger with runes and infusions',
    uniqueStatTotals: combined.totals.length,
    uniqueCandidates: combined.count.toString(),
    preparationMs: Math.round(performance.now() - combinedStart)
  })
);
