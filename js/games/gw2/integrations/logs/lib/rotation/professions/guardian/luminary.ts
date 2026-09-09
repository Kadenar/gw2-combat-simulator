import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const EFFULGENT_DAMAGE_SIGNAL_ID = 76730;
const FORGE_BAR_CHANGES = new Set([77073, 76616, 77339, 76708, 76924, 77197]);

/** Filters the simulator-owned Effulgent proc while preserving represented Forge inputs. */
export function reconstructLuminaryDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return context.recordedActions.filter((action) => {
    if (action.rawSkillId === EFFULGENT_DAMAGE_SIGNAL_ID || normalized(action.rawName) === 'effulgent stance (damage)')
      return false;
    // Forge transitions and radiant weapons generate bar-swap rows; their simulator inputs already change the bar.
    if (action.isSwap && normalized(action.rawName) === 'weapon swap')
      return !context.recordedActions.some(
        (other) => FORGE_BAR_CHANGES.has(other.rawSkillId) && Math.abs(other.start - action.start) < 10
      );
    return true;
  });
}
