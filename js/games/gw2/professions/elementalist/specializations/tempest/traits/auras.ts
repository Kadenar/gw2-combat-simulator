import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistEventSkill,
  elementalistProfiledBuffRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistResolverContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
/**
 * Convert resolved auras into Tempest trait boons and effects after the aura has been accepted by
 * the core resolver: refreshes Tempestuous Aria's damage window and queues the Invigorating
 * Torrents and Elemental Bastion boons for resolver-owned auras, recording each trait that fired as a proc.
 */
export function applyTempestResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.TEMPESTUOUS_ARIA)) {
    const tempestuousAriaProfile = requireBalanceProfileFromContext(context, TRAIT.TEMPESTUOUS_ARIA);
    const extension = balanceProfileNumber(tempestuousAriaProfile, 'durationMultiplier');
    const maximum = balanceProfileNumber(tempestuousAriaProfile, 'maximumStacks');
    // Extend the newest live application instead of stacking a second one, clamping the new expiry
    // to the maximum window measured from this aura; with none live, start a fresh application.
    const current = activeElementalistBuffs(context, 'Tempestuous Aria', event.at).at(-1);
    const expiresAt = current ? Math.min(event.at + maximum, current.expiresAt + extension) : event.at + extension;
    if (current) {
      refreshElementalistBuffs(context, 'Tempestuous Aria', event.at, (previousExpiry) =>
        previousExpiry === current.expiresAt ? expiresAt : previousExpiry
      );
    } else {
      context.effects.emit({
        kind: 'packet',
        durationContext: event,
        event: {
          type: 'buff',
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.TEMPESTUOUS_ARIA,
          actorType: 'player',
          skillName: requireBalanceProfileFromContext(context, TRAIT.TEMPESTUOUS_ARIA).name,
          kind: 'Tempestuous Aria'.toLowerCase(),
          stacks: 1,
          duration: extension,
          triggeredBy: resolverSourceSkill(event),
          priority: Number(event.priority || 0)
        }
      });
    }

    // Preserve each extension's deadline so cursor snapshots do not read a stale initial buff duration.
    context.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Tempestuous Aria',
        at: event.at,
        sourceSkill: resolverSourceSkill(event),
        detail: '',
        icon: '',
        cooldownReduction: null,
        expiresAt: expiresAt
      }
    });
  }

  // Both skill and combo auras grant their trait boons only after actual application. Selection is by trait ID; the
  // name only chooses the boon profile and labels the recorded proc.
  for (const [traitId, trait] of [
    [TRAIT.INVIGORATING_TORRENTS, 'Invigorating Torrents'],
    [TRAIT.ELEMENTAL_BASTION, 'Elemental Bastion']
  ] as const) {
    if (!hasTrait(context, traitId)) continue;
    const boons = tempestAuraBoons(context, trait);
    for (const boon of boons) {
      context.effects.emit({
        kind: 'packet',
        durationContext: event,
        event: {
          type: 'buff',
          at: event.at,
          source: 'Trait',
          sourceId: traitId,
          actorType: 'player',
          skillName: requireBalanceProfileFromContext(context, traitId).name,
          kind: boon.kind.toLowerCase(),
          stacks: boon.stacks,
          duration: boon.duration,
          triggeredBy: resolverSourceSkill(event),
          priority: Number(event.priority || 0)
        }
      });
    }

    if (boons.length)
      context.effects.emit({
        kind: 'announcement',
        announcement: { type: 'trait', name: trait, at: event.at, sourceSkill: resolverSourceSkill(event) }
      });
  }
}

/** Selects Tempest's aura boon payloads; each phase still owns eligibility, scaling, and reporting. */
function tempestAuraBoons(context: unknown, trait: 'Invigorating Torrents' | 'Elemental Bastion') {
  const torrents = trait === 'Invigorating Torrents';
  return (torrents ? ['Vigor', 'Regeneration'] : ['Alacrity']).flatMap((name) => {
    const profile = requireBalanceProfileFromContext(
      context,
      torrents ? TRAIT.INVIGORATING_TORRENTS : TRAIT.ELEMENTAL_BASTION
    );
    const effect = requireEffect(profile, 'boon', name);
    if (!effect) return [];
    return [
      {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: effect.duration
      }
    ];
  });
}

/** Shout rewards stay at committed completion after overload-specific work. */
export function applyTempestShoutTraits(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (!hasTrait(context, TRAIT.TEMPESTUOUS_ARIA)) return;
  // Keep the party reward at this committed shout's completion while reusing named profile emission.
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      cast.effectiveEnd,
      TRAIT.TEMPESTUOUS_ARIA,
      'Shout Might',
      skill.name,
      skill.id,
      0,
      'party',
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Committed heals receive Gale Song before overload-specific completion work. */
export function applyGaleSong(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (skill.type === 'Heal' && hasTrait(context, TRAIT.GALE_SONG))
    context.effects.emit(
      elementalistProfiledBuffRequest(
        context,
        cast.effectiveEnd,
        TRAIT.GALE_SONG,
        'Protection',
        'Gale Song',
        skill.id,
        undefined,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
}

/** Water entry claims the ICD even when a preview removes the optional Vigor effect. */
export function applyLatentStamina(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  if (event.type === 'elementalist.attunement' && event.to === 'Water' && hasTrait(context, TRAIT.LATENT_STAMINA)) {
    if (context.procs.claim(TRAIT.LATENT_STAMINA, 'elementalist.tempest.latentStamina', event.at)) {
      const latentStaminaProfile = requireBalanceProfileFromContext(context, TRAIT.LATENT_STAMINA);
      const vigor = requireEffect(latentStaminaProfile, 'boon', 'Vigor');
      const sourceId = event.skillId ?? event.sourceId;
      if (vigor) {
        context.effects.emit(
          elementalistBuffRequest(
            {
              skill: elementalistEventSkill(context, 'Latent Stamina', sourceId),
              at: event.at,
              source: 'Latent Stamina',
              sourceId,
              actorType: 'player',
              kind: String(vigor.boon).toLowerCase(),
              stacks: Number(vigor.stacks),
              duration: vigor.duration,
              skillName: 'Latent Stamina'
            },
            emissionCast
          )
        );
      }
    }

    return;
  }
}
