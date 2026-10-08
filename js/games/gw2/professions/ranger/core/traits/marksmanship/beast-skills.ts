import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Applies the trait at the accepted Beast-skill boundary. */
export function applyWolfsong(context: RangerRuntime, skill: RangerSkill): void {
  if (
    hasTrait(context, TRAIT.WOLFSONG) &&
    rangerPetByName(professionCoreState(context).activePet).family === 'canine'
  ) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.WOLFSONG);
    const effect = requireEffect(profile, 'condition', 'Vulnerability');
    if (effect)
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at: context.time,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.WOLFSONG,
            skillName: 'Wolfsong',
            name: 'Wolfsong - Vulnerability',
            condition: String(effect.condition),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      });
  }
}

/** Completes the lesser warhorn package after the pet swap. */
export function applyClarionBond(context: RangerRuntime, skill: RangerSkill): void {
  const at = context.time;
  if (
    hasTrait(context, TRAIT.CLARION_BOND) &&
    context.procs.claim(TRAIT.CLARION_BOND, 'ranger.core.clarionBond', context.time)
  ) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.CLARION_BOND);
    // The blast finisher is part of the lesser warhorn package, so the cooldown survives removed boons.
    context.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'boon'),
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CLARION_BOND,
        actorType: 'effect',
        skillId: TRAIT.CLARION_BOND,
        skillName: 'Clarion Bond',
        triggeredBy: skill.name
      },
      transform: (event) => ({
        ...event,
        name: 'Clarion Bond - ' + event.kind,
        boon: event.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      })
    });

    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (weakness)
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.CLARION_BOND,
            skillName: 'Clarion Bond',
            name: 'Lesser Call of the Wild - Weakness',
            condition: String(weakness.condition),
            duration: effectNumber(profile, weakness, 'duration'),
            stacks: effectNumber(profile, weakness, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      });
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'proc',
        at,
        source: 'Trait',
        sourceId: TRAIT.CLARION_BOND,
        actorType: 'effect',
        skillId: TRAIT.CLARION_BOND,
        skillName: 'Clarion Bond',
        name: 'Lesser Call of the Wild - Blast Finisher',
        triggeredBy: skill.name,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    });
  }
}
