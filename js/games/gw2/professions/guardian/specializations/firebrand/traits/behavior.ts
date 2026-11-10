import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';

/** Righteous Flames keeps the tome passive without changing the shared Justice hit tracker. */
export function righteousFlamesRetainsTomePassive(context: unknown): boolean {
  return hasTrait(context, TRAIT.RIGHTEOUS_FLAMES);
}

/** Stoic Demeanor retains Courage's passive on the mechanic's unchanged cadence. */
export function stoicDemeanorRetainsCourage(runtime: GuardianRuntime): boolean {
  return hasTrait(runtime, TRAIT.STOIC_DEMEANOR);
}
