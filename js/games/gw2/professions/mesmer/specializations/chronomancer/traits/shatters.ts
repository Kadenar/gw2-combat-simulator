import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
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
  fallbackBoon: 'alacrity' | 'quickness'
): void => {
  const runtime = mesmerRuntimeFor(context);
  if (!runtime.traits.has(traitId)) return;

  const effect: SkillEffect = runtime.balanceProfile(traitId)?.effects?.find(({ type }) => type === 'boon') ?? {
    type: 'boon',
    boon: fallbackBoon,
    duration: 3,
    stacks: 1,
    audience: { recipients: 'party' as const, maximumRecipients: 5 }
  };
  const kind = String(effect.boon || fallbackBoon);
  const baseDuration =
    Number(effect.duration ?? 3) +
    (resolution.spent + 1) * balanceProfileValueFromContext(context, traitId, 'durationPerTier', 1);
  const duration = gw2SchedulerBoonDuration(context, { id: traitId, name: traitName }, kind, baseDuration);
  runtime.addEvent({
    type: 'buff',
    at: resolution.at,
    kind,
    stacks: Number(effect.stacks ?? 1),
    duration,
    skillName: resolution.skill.name,
    sourceSkill: resolution.skill.name,
    audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
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
    resolution.spent !== balanceProfileValueFromContext(context, TRAIT.ILLUSIONARY_REVERSION, 'threshold', 3)
  ) {
    return;
  }

  runtime.resources.queueResources(
    resolution.at + context.epsilon,
    balanceProfileValueFromContext(context, TRAIT.ILLUSIONARY_REVERSION, 'resourceGain', 1),
    runtime.activePrimaryWeapon(),
    'Illusionary Reversion',
    {
      traitId: TRAIT.ILLUSIONARY_REVERSION,
      traitName: 'Illusionary Reversion'
    }
  );
}
