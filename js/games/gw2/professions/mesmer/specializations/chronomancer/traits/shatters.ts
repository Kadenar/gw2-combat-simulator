import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

// Materialize one Chronomancer shatter boon with clone-scaled duration and
// profile-owned recipient metadata.
const triggerShatterBoon = (
  context: MesmerRuntime,
  resolution: MesmerShatterResolution,
  traitId: number,
  traitName: string,
  effectName: 'alacrity' | 'quickness'
): void => {
  const runtime = mesmerMechanicsFor(context);
  if (!runtime.traits.has(traitId)) return;

  const traitProfile = requireBalanceProfileFromContext(context, traitId);
  const effect = requireEffect(traitProfile, 'boon', effectName);
  if (!effect) return;
  const kind = String(effect.boon);
  const baseDuration =
    Number(effect.duration) + (resolution.spent + 1) * balanceProfileNumber(traitProfile, 'durationPerTier');
  const duration = baseDuration;
  runtime.addEvent({
    type: 'buff',
    at: resolution.at,
    kind,
    stacks: Number(effect.stacks),
    duration,
    skillName: resolution.skill.name,
    sourceSkill: resolution.skill.name,
    audience: effect.audience
  });
  runtime.addTraitProc(traitName, resolution.at, resolution.skill.name, `${duration}s ${kind}`);
};

/** Grants Chronomancer shatter boons using player-plus-clone tiers from the committed resource spend. */
export function resolveChronomancerShatterBoons(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  triggerShatterBoon(context, resolution, TRAIT.STRETCHED_TIME, 'Stretched Time', 'alacrity');
  triggerShatterBoon(context, resolution, TRAIT.SEIZE_THE_MOMENT, 'Seize the Moment', 'quickness');
}

/** Refunds one clone only when a Chronomancer shatter commits the configured full-clone threshold. */
export function resolveIllusionaryReversion(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  const runtime = mesmerMechanicsFor(context);
  if (
    !runtime.traits.has(TRAIT.ILLUSIONARY_REVERSION) ||
    resolution.spent !==
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_REVERSION), 'threshold')
  ) {
    return;
  }

  const illusionaryReversionProfile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_REVERSION);
  runtime.resources.queueResources(
    resolution.at,
    balanceProfileNumber(illusionaryReversionProfile, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Illusionary Reversion',
    {
      traitId: TRAIT.ILLUSIONARY_REVERSION,
      traitName: 'Illusionary Reversion'
    }
  );
}
