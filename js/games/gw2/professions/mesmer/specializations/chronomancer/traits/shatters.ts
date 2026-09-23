import {
  balanceProfileNumberFromContext,
  requireEffectFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerCastContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

// Materialize one Chronomancer shatter boon with clone-scaled duration and
// profile-owned recipient metadata.
const triggerShatterBoon = (
  context: MesmerCastContext,
  resolution: MesmerShatterResolution,
  traitId: number,
  traitName: string,
  effectName: 'alacrity' | 'quickness'
): void => {
  const runtime = mesmerRuntimeFor(context);
  if (!runtime.traits.has(traitId)) return;

  const effect = requireEffectFromContext(context, 'balance-profile', traitId, 'boon', effectName);
  if (!effect) return;
  const kind = String(effect.boon);
  const baseDuration =
    Number(effect.duration) +
    (resolution.spent + 1) * balanceProfileNumberFromContext(context, traitId, 'durationPerTier');
  const duration = gw2SchedulerBoonDuration(context, { id: traitId, name: traitName }, kind, baseDuration);
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
export function resolveChronomancerShatterBoons(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  triggerShatterBoon(context, resolution, TRAIT.STRETCHED_TIME, 'Stretched Time', 'alacrity');
  triggerShatterBoon(context, resolution, TRAIT.SEIZE_THE_MOMENT, 'Seize the Moment', 'quickness');
}

/** Refunds one clone only when a Chronomancer shatter commits the configured full-clone threshold. */
export function resolveIllusionaryReversion(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  const runtime = mesmerRuntimeFor(context);
  if (
    !runtime.traits.has(TRAIT.ILLUSIONARY_REVERSION) ||
    resolution.spent !== balanceProfileNumberFromContext(context, TRAIT.ILLUSIONARY_REVERSION, 'threshold')
  ) {
    return;
  }

  runtime.resources.queueResources(
    resolution.at,
    balanceProfileNumberFromContext(context, TRAIT.ILLUSIONARY_REVERSION, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Illusionary Reversion',
    {
      traitId: TRAIT.ILLUSIONARY_REVERSION,
      traitName: 'Illusionary Reversion'
    }
  );
}
