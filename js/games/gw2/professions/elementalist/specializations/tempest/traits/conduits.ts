import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { materializeSkillEffectApplications, scaleCastBoundTiming } from '#gw2/platform/effects/materializer.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { elementalistProfiledBuffRequest } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/** Schedule alacrity from accepted overload hits before packet emission, retaining shortened-channel behavior. */
export function applyLucidSingularity(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!skill.overload || !hasTrait(context, TRAIT.LUCID_SINGULARITY)) return;
  const lucidSingularityProfile = requireBalanceProfileFromContext(context, TRAIT.LUCID_SINGULARITY);
  const hits = (skill.effects ?? [])
    .flatMap((effect) =>
      materializeSkillEffectApplications({
        skill,
        effect: scaleCastBoundTiming(cast, skill, effect),
        start: cast.start,
        fullEnd: cast.fullEnd,
        baseEvent: {
          source: 'elementalist',
          sourceId: skill.id,
          actorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          activationId: cast.id
        }
      })
    )
    .map((application) => application.event)
    .filter(
      (event) =>
        event.type === 'damage' &&
        Number(event.coefficient) > 0 &&
        (cast.effectiveEnd >= cast.fullEnd || event.at <= cast.effectiveEnd)
    )
    .sort((a, b) => a.at - b.at)
    .slice(0, balanceProfileNumber(lucidSingularityProfile, 'maximumStacks'));
  hits.forEach((event, index: number) => {
    const effectName = index === hits.length - 1 ? 'Final Alacrity' : 'Pulse Alacrity';
    context.effects.emit(
      elementalistProfiledBuffRequest(
        context,
        event.at,
        TRAIT.LUCID_SINGULARITY,
        effectName,
        'Lucid Singularity',
        skill.id,
        undefined,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  });
}

/** The completing overload's aura precedes the same-time overload packet and Fire-exit proc. */
export function applyUnstableConduit(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const attunement = String(skill.attunement);
  if (hasTrait(context, TRAIT.UNSTABLE_CONDUIT)) {
    const aura =
      attunement === 'Fire'
        ? 'Fire Aura'
        : attunement === 'Water'
          ? 'Frost Aura'
          : attunement === 'Air'
            ? 'Shocking Aura'
            : 'Magnetic Aura';
    const unstableConduitProfile = requireBalanceProfileFromContext(context, TRAIT.UNSTABLE_CONDUIT);
    const unstableConduitAttunement = requireEffect(unstableConduitProfile, 'buff', attunement);
    if (unstableConduitAttunement) {
      applyElementalistAura(context, {
        at: cast.effectiveEnd,
        aura,
        duration: unstableConduitAttunement.duration,
        skillName: 'Unstable Conduit',
        sourceId: skill.id,
        // The completion aura precedes the same-time Overload packet.
        priority: -20
      });
    }
  }
}

/** Share the existing overload profile patch target while keeping the selected-trait decision here. */
export function transcendentTempestDwell(context: unknown, base: number): number {
  return hasTrait(context, TRAIT.TRANSCENDENT_TEMPEST)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.overloads), 'durationMultiplier')
    : base;
}
