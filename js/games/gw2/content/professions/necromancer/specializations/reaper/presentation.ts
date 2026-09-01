import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import {
  necromancerCoreTargetHealthThresholds,
  necromancerSoulShardResourceViews,
  necromancerTransformPaletteGroups,
  necromancerTransformSkillBarGroups
} from '#gw2/content/professions/necromancer/core/presentation.js';
import { createProfessionAssumptionControls } from '#gw2/platform/builds/assumptions.js';
import type { ProfessionResourceView, ProfessionUiContract, SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { NecromancerUiContext } from '#gw2/content/professions/necromancer/types.js';

const REAPER_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: 'permanentIceField',
    label: 'Permanent ice field (testing)',
    type: 'boolean',
    defaultValue: false,
    specializations: ['Reaper']
  }
]);

export const reaperUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  assumptionControls: REAPER_ASSUMPTION_CONTROLS,
  paletteGroups: (context: NecromancerUiContext) =>
    necromancerTransformPaletteGroups(context, {
      entryId: ID.REAPERS_SHROUD,
      exitId: ID.EXIT_REAPERS_SHROUD,
      shroud: 'reaper',
      stackId: 'reaper-profession'
    }),
  skillBarGroups: (context: NecromancerUiContext) =>
    necromancerTransformSkillBarGroups(context, {
      entryId: ID.REAPERS_SHROUD,
      exitId: ID.EXIT_REAPERS_SHROUD,
      shroud: 'reaper'
    }),
  resourceViews: (context: NecromancerUiContext): ProfessionResourceView[] =>
    necromancerSoulShardResourceViews(context),
  // Suppress the default 50% Gravedigger threshold when the core layer already defines its own thresholds.
  targetHealthThresholds: (context: NecromancerUiContext) =>
    necromancerCoreTargetHealthThresholds(context).length ? [] : [0.5]
});
