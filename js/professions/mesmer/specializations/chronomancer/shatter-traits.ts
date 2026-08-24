import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import type { SkillEffect } from '../../../../platform/engine/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerBalanceValue } from '../../core/profiles.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import type { MesmerCastContext, MesmerShatterResolution } from '../../types.js';

const partyBoonRecipients = (context: MesmerCastContext, maximumRecipients: number) => ({
  recipients: 'party' as const,
  maximumRecipients,
  companionIds: professionCoreState(context.state).clones.map((clone) => `mesmer.clone:${clone.id}`)
});

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
    recipients: 'party',
    maximumRecipients: 5
  };
  const kind = String(effect.boon || fallbackBoon);
  const baseDuration =
    Number(effect.duration ?? 3) + (resolution.spent + 1) * mesmerBalanceValue(context, traitId, 'durationPerTier', 1);
  const duration =
    context.schedulerPolicy.effectDuration?.(context, { id: traitId, name: traitName }, effect, baseDuration) ??
    baseDuration;
  runtime.addEvent({
    type: 'buff',
    at: resolution.at,
    kind,
    stacks: Number(effect.stacks ?? 1),
    duration,
    skillName: resolution.skill.name,
    sourceSkill: resolution.skill.name,
    ...partyBoonRecipients(context, Number(effect.maximumRecipients ?? 5))
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
    resolution.spent !== mesmerBalanceValue(context, TRAIT.ILLUSIONARY_REVERSION, 'threshold', 3)
  ) {
    return;
  }

  runtime.resources.queueResources(
    resolution.at + context.epsilon,
    mesmerBalanceValue(context, TRAIT.ILLUSIONARY_REVERSION, 'resourceGain', 1),
    runtime.activePrimaryWeapon(),
    'Illusionary Reversion',
    {
      traitId: TRAIT.ILLUSIONARY_REVERSION,
      traitName: 'Illusionary Reversion'
    }
  );
}
