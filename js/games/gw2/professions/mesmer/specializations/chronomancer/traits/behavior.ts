import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-mechanics.js';
import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { MesmerPhantasmPolicy } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Arms Danger Time from Chronomancer control packets and Delayed Reactions. */
export function observeChronomancerEvent(context: MesmerRuntime, event: SimulationEvent): void {
  if (event.type !== 'control') return;

  const skillId = Number(event.skillId);
  if (
    !hasTrait(context, TRAIT.DANGER_TIME) ||
    (skillId !== ID.TIME_SINK && !hasTrait(context, TRAIT.DELAYED_REACTIONS))
  ) {
    return;
  }

  const skillName = event.skillName || event.name || 'Control effect';
  const dangerTimeProfile = requireBalanceProfileFromContext(context, TRAIT.DANGER_TIME);
  {
    const grants: readonly MesmerEventExtra[] = [
      {
        kind: 'danger-time',
        stacks: 1,
        duration: balanceProfileNumber(dangerTimeProfile, 'durationMultiplier'),
        sourceSkill: skillName
      }
    ];
    const traitProfile = requireBalanceProfileFromContext(context, TRAIT.DANGER_TIME);
    const traitSource = {
      source: 'Trait',
      sourceId: TRAIT.DANGER_TIME,
      actorType: 'player' as const,
      skillId: TRAIT.DANGER_TIME,
      skillName: traitProfile.name
    };
    {
      const proc = context.effects.emit({
        receipt: true,
        kind: 'announcement',
        log: true,
        attribution: { ...traitSource, actorType: 'effect' },
        announcement: { type: 'trait', name: traitProfile.name, at: event.at, sourceSkill: skillName, detail: '' }
      });
      for (const grant of grants)
        context.effects.emit({
          kind: 'packet',
          cause: proc,
          event: {
            ...grant,
            ...traitSource,
            type: 'buff',
            at: event.at,
            name: traitProfile.name,
            sourceSkill: skillName
          }
        });
    }
  }
}

/** Supply repeat policy while the shared illusion lifecycle owns entities, cancellation, and conversion. */
export function chronophantasmaPolicy(context: MesmerRuntime): Partial<MesmerPhantasmPolicy> | undefined {
  return hasTrait(context, TRAIT.CHRONOPHANTASMA)
    ? {
        repeat: {
          label: 'Chronophantasma',
          traitId: TRAIT.CHRONOPHANTASMA,
          traitName: 'Chronophantasma',
          damageMultiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(context, TRAIT.CHRONOPHANTASMA),
            'damageMultiplier'
          )
        }
      }
    : undefined;
}

// Materialize one Chronomancer shatter boon with clone-scaled duration and
// profile-owned recipient metadata.
const triggerShatterBoon = (
  context: MesmerRuntime,
  resolution: MesmerShatterResolution,
  traitId: number,
  effectName: 'alacrity' | 'quickness'
): void => {
  if (!hasTrait(context, traitId)) return;

  const traitProfile = requireBalanceProfileFromContext(context, traitId);
  const effect = requireEffect(traitProfile, 'boon', effectName);
  if (!effect) return;
  const kind = String(effect.boon);
  const baseDuration = effect.duration + (resolution.spent + 1) * balanceProfileNumber(traitProfile, 'durationPerTier');
  const duration = baseDuration;
  {
    const grants: readonly MesmerEventExtra[] = [
      {
        kind,
        stacks: Number(effect.stacks),
        duration,
        skillName: resolution.skill.name,
        sourceSkill: resolution.skill.name,
        audience: effect.audience
      }
    ];
    const traitProfile = requireBalanceProfileFromContext(context, traitId);
    const traitSource = {
      source: 'Trait',
      sourceId: traitId,
      actorType: 'player' as const,
      skillId: traitId,
      skillName: traitProfile.name
    };
    {
      const proc = context.effects.emit({
        receipt: true,
        ...resolution.delivery,
        kind: 'announcement',
        log: true,
        attribution: { ...traitSource, actorType: 'effect' },
        announcement: {
          type: 'trait',
          name: traitProfile.name,
          at: resolution.at,
          sourceSkill: resolution.skill.name,
          detail: ''
        }
      });
      for (const grant of grants)
        context.effects.emit({
          ...resolution.delivery,
          kind: 'packet',
          cause: proc,
          event: {
            ...grant,
            ...traitSource,
            type: 'buff',
            at: resolution.at,
            name: traitProfile.name,
            sourceSkill: resolution.skill.name
          }
        });
    }
  }
};

/** Grants Chronomancer shatter boons using player-plus-clone tiers from the committed resource spend. */
export function resolveChronomancerShatterBoons(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  triggerShatterBoon(context, resolution, TRAIT.STRETCHED_TIME, 'alacrity');
  triggerShatterBoon(context, resolution, TRAIT.SEIZE_THE_MOMENT, 'quickness');
}

/** Refunds one clone only when a Chronomancer shatter commits the configured full-clone threshold. */
export function resolveIllusionaryReversion(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  if (
    !hasTrait(context, TRAIT.ILLUSIONARY_REVERSION) ||
    resolution.spent !==
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_REVERSION), 'threshold')
  ) {
    return;
  }

  const illusionaryReversionProfile = requireBalanceProfileFromContext(context, TRAIT.ILLUSIONARY_REVERSION);
  createMesmerIllusionRewards(context).queueResources(
    resolution.at,
    balanceProfileNumber(illusionaryReversionProfile, 'resourceGain'),
    mesmerActivePrimaryWeapon(context),
    'Illusionary Reversion',
    {
      traitId: TRAIT.ILLUSIONARY_REVERSION,
      traitName: 'Illusionary Reversion'
    }
  );
}
