/** Simulate one captured equipment assignment and return only its ally boon chart and coverage. */
import type { OptimizerContext } from '#gw2/app/optimizer/gear/context.js';
import {
  createOptimizerEvaluator,
  createOptimizerSpace,
  type GearOptimizerRequest,
  type OptimizerEquipment
} from '#gw2/app/optimizer/gear/search.js';
import { buildTimeSeries, type ChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import {
  generatedBoonCoverage,
  type BoonCoverage,
  type BoonGenerationByAudience
} from '#gw2/platform/results/boon-generation.js';

export interface OptimizerBoonChart {
  readonly series: ChartSeries;
  readonly coverage: BoonCoverage;
}

export interface OptimizerBoonChartRequest {
  readonly kind: 'boon-chart';
  readonly requestId: number;
  readonly request: GearOptimizerRequest;
  readonly equipment: OptimizerEquipment;
}

export type OptimizerBoonChartResponse = { readonly requestId: number } & (
  { readonly chart: OptimizerBoonChart; readonly error?: never } | { readonly error: string }
);

export function calculateOptimizerBoonChart(
  request: GearOptimizerRequest,
  equipment: OptimizerEquipment,
  adapter: OptimizerContext
): OptimizerBoonChart {
  const evaluator = createOptimizerEvaluator(createOptimizerSpace(request, adapter), adapter);
  const result = evaluator.evaluate(equipment);

  if (!result.effectReport || !result.boonGeneration) throw new Error('Boon chart data was not collected.');

  const kinds = ['quickness', 'alacrity'];
  // Keep absent boons as zero lines so personal grants cannot be mistaken for ally coverage.
  const boons: Record<string, BoonGenerationByAudience> = Object.fromEntries(
    kinds.map((kind) => [
      kind,
      result.boonGeneration!.boons[kind] ?? {
        intensityStacking: false,
        self: { generatedStackSeconds: 0 },
        ally: { generatedStackSeconds: 0 }
      }
    ])
  );
  return {
    coverage: generatedBoonCoverage(new Map(Object.entries(boons)), result.dpsWindow),
    series: {
      ...buildTimeSeries(
        {
          dpsStartTime: result.dpsStartTime,
          firstHitTime: result.firstHitTime,
          combatEndTime: result.combatEndTime,
          resolvedEvents: [],
          // The worker preview owns only these two boons, including its summary data.
          boonGeneration: {
            boons,
            sustained: Object.fromEntries(
              Object.entries(result.boonGeneration.sustained).filter(([kind]) => kinds.includes(kind))
            )
          },
          effectReport: {
            ...result.effectReport,
            tracks: result.effectReport.tracks.filter(
              (track) => track.origin === 'party-projection' && kinds.includes(track.kind)
            )
          }
        },
        250
      ),
      effectUnits: { quickness: 's', alacrity: 's' }
    }
  };
}
