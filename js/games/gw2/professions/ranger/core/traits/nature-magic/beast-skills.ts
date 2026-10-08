import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Applies the trait at the accepted Beast-skill boundary. */
export function applyRejuvenation(context: RangerRuntime, skill: RangerSkill): void {
  if (hasTrait(context, TRAIT.REJUVENATION)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.REJUVENATION);
    const effect = requireEffect(profile, 'boon', 'regeneration');
    // The cooldown gates only regeneration, so a removed boon leaves the trait ready.
    if (effect && context.procs.claim(TRAIT.REJUVENATION, 'ranger.core.rejuvenation', context.time)) {
      const kind = String(effect.boon);
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at: context.time,
            source: 'Trait',
            sourceId: TRAIT.REJUVENATION,
            actorType: 'effect',
            skillId: TRAIT.REJUVENATION,
            skillName: 'Rejuvenation',
            name: `Rejuvenation - ${kind}`,
            kind,
            boon: kind,
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            audience: { recipients: 'party' as const, maximumRecipients: 5 },
            triggeredBy: skill.name
          },
          'buff'
        )
      });
    }
  }
}

/** Grants combat-only arrival boons before Clarion Bond. */
export function applySpiritedArrival(context: RangerRuntime, skill: RangerSkill): void {
  const at = context.time;
  const inCombat = context.combatStartTime != null && context.time >= context.combatStartTime;
  if (inCombat && hasTrait(context, TRAIT.SPIRITED_ARRIVAL)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.SPIRITED_ARRIVAL);
    context.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.SPIRITED_ARRIVAL,
        actorType: 'effect',
        skillId: TRAIT.SPIRITED_ARRIVAL,
        skillName: 'Spirited Arrival',
        triggeredBy: skill.name
      },
      transform: (event) => ({
        ...event,
        name: 'Spirited Arrival - ' + event.kind,
        boon: event.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      })
    });
  }
}
