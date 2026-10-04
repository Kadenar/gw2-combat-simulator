import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';

import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

export type RevenantRuntime = MechanicContext<RevenantRuntimeState, RevenantSkill>;

/** Permanent configured boons and executed applications both count; pending packets never do. */
export function revenantBoonActive(runtime: RevenantRuntime, kind: string): boolean {
  if (Number(runtime.config.boons?.[kind] ?? 0) > 0 || runtime.config.boons?.[kind] === true) return true;
  return buffApplicationStacks(runtime.combat.boonApplications(kind), kind, runtime.time, 1, { ordered: true }) > 0;
}
