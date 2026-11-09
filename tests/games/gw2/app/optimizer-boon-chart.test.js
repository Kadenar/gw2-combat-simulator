// Candidate previews must use captured inputs and show allied supply independently of personal boons.
import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateOptimizerBoonChart } from '#gw2/app/optimizer/gear/boon-chart-data.js';
import { loadOptimizerContext } from '#gw2/app/optimizer/gear/context.js';
import {
  captureGearOptimizerRequest,
  createOptimizerEvaluator,
  createOptimizerSpace,
  optimizerEquipment
} from '#gw2/app/optimizer/gear/search.js';
import { mountTimeSeriesCharts } from '#gw2/app/results/charts/time-series-view.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import { inertContainer } from '#tests/helpers/dom.js';

const adapter = await loadOptimizerContext('guardian');

function fixture() {
  const build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults());
  Object.assign(build, {
    rune: '',
    relic: '',
    food: '',
    utility: '',
    infusions: [],
    rotation: [
      { type: 'combat-start' },
      { type: 'cast', skillId: GUARDIAN_SKILL_IDS.FEEL_MY_WRATH },
      { type: 'wait', durationMs: 10000 }
    ]
  });
  build.selectedSkillIds.Elite = GUARDIAN_SKILL_IDS.FEEL_MY_WRATH;
  for (const slot of Object.keys(build.gear)) build.gear[slot] = "Berserker's";
  const request = captureGearOptimizerRequest(
    {
      build,
      adapter,
      contentId: adapter.id,
      analysis: { state: { buildRevision: 1 } },
      patch: adapter.profession.resolvePatch({ id: 'current' })
    },
    {}
  );
  return { build, request };
}

test('boon previews use the selected equipment and captured rotation without applying the build', () => {
  const { build, request } = fixture();
  const equipment = optimizerEquipment(request.build);
  const original = structuredClone(request);
  const chart = calculateOptimizerBoonChart(request, equipment, adapter);
  assert.ok(chart.coverage.quickness.allyPercent > 0);
  assert.ok(chart.coverage.quickness.selfPercent > chart.coverage.quickness.allyPercent);
  assert.equal(chart.coverage.alacrity.allyPercent, 0);
  assert.deepEqual(Object.keys(chart.series.alliedEffects).sort(), ['Alacrity', 'Quickness']);
  assert.deepEqual(chart.series.effects, {});
  // Feel My Wrath also grants Fury; it must not masquerade as Alacrity in the worker's summary payload.
  assert.deepEqual(Object.keys(chart.series.sustainedBoonGeneration), ['Quickness']);
  assert.deepEqual(chart.series.effectUnits, { Quickness: 's', Alacrity: 's' });
  assert.ok(chart.series.alliedEffects.Quickness.some((point) => point.v > 0));
  assert.ok(chart.series.alliedEffects.Alacrity.every((point) => point.v === 0));

  // Unconstrained searches supply row percentages without collecting a detailed timeline for each candidate.
  const evaluator = createOptimizerEvaluator(createOptimizerSpace(request, adapter), adapter);
  const score = evaluator.score(equipment);
  assert.deepEqual(score.boonCoverage, chart.coverage);
  assert.equal(score.effectReport, undefined);

  // Mutating the live build must not alter a historical result's preview.
  build.rotation = [];
  const live = structuredClone(build);
  assert.deepEqual(calculateOptimizerBoonChart(request, equipment, adapter), chart);
  const boonGear = structuredClone(equipment);
  for (const slot of Object.keys(boonGear.gear)) boonGear.gear[slot] = "Ritualist's";
  const longer = calculateOptimizerBoonChart(request, boonGear, adapter);
  assert.ok(longer.coverage.quickness.allyPercent > chart.coverage.quickness.allyPercent);
  assert.deepEqual(request, original);
  assert.deepEqual(build, live);
  assert.deepEqual(equipment, optimizerEquipment(request.build));
});

test('ally chart mounting omits unrelated panels and exposes disposal for overlay cleanup', () => {
  const { request } = fixture();
  const chart = calculateOptimizerBoonChart(request, optimizerEquipment(request.build), adapter);
  const container = inertContainer();
  const dispose = mountTimeSeriesCharts(container, chart.series, { allyBoonsOnly: true });
  assert.match(container.innerHTML, /data-role="effects-canvas"/);
  assert.match(container.innerHTML, /Remaining boon duration in seconds/);
  assert.doesNotMatch(container.innerHTML, /data-role="(?:dps-canvas|conditions-canvas|boon-audience)"/);
  assert.equal(typeof dispose, 'function');
  dispose();
  dispose();
});

test('the gear worker accepts standalone previews and reports loading failures with their request IDs', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'self');
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'self', descriptor);
    else delete globalThis.self;
  });
  let receive;
  const replies = [];
  // Exercise worker dispatch without starting an optimizer search or depending on browser globals.
  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    value: {
      addEventListener(_type, listener) {
        receive = listener;
      },
      postMessage(message) {
        replies.push(structuredClone(message));
      }
    }
  });
  await import('#gw2/app/optimizer/gear/worker.js');
  const { request } = fixture();
  const equipment = optimizerEquipment(request.build);
  await receive({ data: { kind: 'boon-chart', requestId: 17, request, equipment } });
  assert.equal(replies[0].requestId, 17);
  assert.ok(replies[0].chart.coverage.quickness.allyPercent > 0);
  await receive({
    data: { kind: 'boon-chart', requestId: 18, request: { ...request, contentId: 'missing' }, equipment }
  });
  assert.deepEqual(replies[1], { requestId: 18, error: 'Optimizer profession is unavailable.' });
});
