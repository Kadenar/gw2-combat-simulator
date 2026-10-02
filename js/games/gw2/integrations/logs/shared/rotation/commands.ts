import type { CastCommand, CooldownResetCommand } from '#gw2/platform/execution/types.js';
import { isMushroomKingsBlessing } from '#gw2/integrations/logs/shared/rotation/model.js';

/** Encodes the adapter's resolved input and cancellation decision without interpreting source timing or evidence. */
export function replayActionCommand(
  action: Pick<CastCommand, 'skillId' | 'doubleEdgeOutcome' | 'releaseAtCharges'> & {
    readonly rawSkillId: number;
    readonly rawName: string;
  },
  interruptMs: number | null
): CastCommand | CooldownResetCommand {
  if (isMushroomKingsBlessing(action)) return { type: 'cooldown-reset' };
  const command: { -readonly [Key in keyof CastCommand]: CastCommand[Key] } = { type: 'cast', skillId: action.skillId };
  // Zero is an explicit cancellation, while null leaves the scheduler's normal cast duration intact.
  if (interruptMs != null) command.interruptAfterMs = interruptMs;
  if (action.doubleEdgeOutcome != null) command.doubleEdgeOutcome = action.doubleEdgeOutcome;
  if (action.releaseAtCharges != null) command.releaseAtCharges = action.releaseAtCharges;
  return command;
}
