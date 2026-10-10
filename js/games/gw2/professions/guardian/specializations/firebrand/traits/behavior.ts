import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

/** Quickfire keeps the tome passive without changing the shared Justice hit tracker. */
export function quickfireRetainsTomePassive(context: unknown): boolean {
  return hasTrait(context, TRAIT.QUICKFIRE);
}

/** Stoic Demeanor retains Courage's passive on the mechanic's unchanged cadence. */
export function stoicDemeanorRetainsCourage(runtime: Runtime): boolean {
  return hasTrait(runtime, TRAIT.STOIC_DEMEANOR);
}
