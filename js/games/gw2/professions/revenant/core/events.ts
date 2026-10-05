import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';

import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

export type RevenantRuntime = MechanicContext<RevenantRuntimeState, RevenantSkill>;
