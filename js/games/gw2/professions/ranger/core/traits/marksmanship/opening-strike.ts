import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  buildRangerCondition,
  isPetStrike,
  isPlayerStrike,
  targetHealthFraction
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Owns Core Ranger Marksmanship opening-strike and target-health trait behavior. */

// Spend the player or pet Opening Strike independently on its first qualifying
// hit and attach Vulnerability plus Alpha Focus when selected.
export function consumeOpeningStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.OPENING_STRIKE)) return;
  const state = professionCoreState(context);
  const player = isPlayerStrike(event);
  const pet = isPetStrike(event);
  if ((!player && !pet) || !(Number(event.coefficient) > 0)) return;
  const ready = player ? state.playerOpeningStrikeReady : state.petOpeningStrikeReady;
  if (!ready) return;
  const openingStrikeProfile = requireBalanceProfileFromContext(context, TRAIT.OPENING_STRIKE);
  const openingStrike = requireEffect(openingStrikeProfile, 'condition', 'Vulnerability');
  const alphaFocusProfile = hasTrait(context, TRAIT.ALPHA_FOCUS)
    ? requireBalanceProfileFromContext(context, TRAIT.ALPHA_FOCUS)
    : undefined;
  const alphaFocus = alphaFocusProfile && requireEffect(alphaFocusProfile, 'condition', 'Crippled');
  // Readiness is spent by a delivered opener; with every opener packet removed it stays armed.
  if (!openingStrike && !alphaFocus) return;
  if (player) state.playerOpeningStrikeReady = false;
  else state.petOpeningStrikeReady = false;
  if (openingStrike)
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.OPENING_STRIKE,
        actorType: 'effect',
        skillId: TRAIT.OPENING_STRIKE,
        skillName: 'Opening Strike',
        name: 'Opening Strike - Vulnerability',
        condition: String(openingStrike.condition),
        duration: effectNumber(openingStrikeProfile, openingStrike, 'duration'),
        stacks: effectNumber(openingStrikeProfile, openingStrike, 'stacks'),
        triggeredBy: event.skillName
      })
    });
  if (alphaFocusProfile && alphaFocus) {
    context.effects.emit({
      kind: 'packet',
      event: buildRangerCondition(
        context,
        event,
        String(alphaFocus.condition),
        effectNumber(alphaFocusProfile, alphaFocus, 'duration'),
        effectNumber(alphaFocusProfile, alphaFocus, 'stacks'),
        TRAIT.ALPHA_FOCUS,
        'Alpha Focus'
      )
    });
  }
}

// Convert the target's current health tier into ICD-bound Might stacks on a
// qualifying player strike, using the resolver's cumulative damage state.
export function triggerHuntersGaze(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event) || !hasTrait(context, TRAIT.HUNTERS_GAZE)) return;
  const health = targetHealthFraction(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.HUNTERS_GAZE);
  const might = requireEffect(profile, 'boon', 'might');
  // The cooldown and proc record exist only for the might packet.
  if (!might) return;
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const stacks =
    health < 0.25
      ? maximumStacks
      : health < 0.5
        ? Math.max(0, maximumStacks - 1)
        : health < 0.75
          ? Math.max(0, maximumStacks - 2)
          : 0;
  // Target health must yield actual Might stacks before this hit claims the interval.
  if (!stacks || !context.procs.claim(TRAIT.HUNTERS_GAZE, 'ranger.core.huntersGaze', event.at)) return;
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.HUNTERS_GAZE, actorType: 'effect' },
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: "Hunter's Gaze",
      at: event.at,
      sourceSkill: event.skillName,
      detail: `${stacks} might`,
      icon: context.helpers.skillsById.get(TRAIT.HUNTERS_GAZE)?.icon || ''
    }
  });
  context.effects.emit({
    kind: 'packet',
    event: buildResolverBuff({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.HUNTERS_GAZE,
      actorType: 'effect',
      skillId: TRAIT.HUNTERS_GAZE,
      skillName: "Hunter's Gaze",
      name: "Hunter's Gaze - Might",
      kind: String(might.boon),
      duration: effectNumber(profile, might, 'duration'),
      stacks,
      triggeredBy: event.skillName
    }),
    durationContext: event
  });
}

export function reactToRangerCoreBuff(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const kind = (event.kind || '').toLowerCase();
  if (kind === 'fury' && event.resolvedAudience?.includesSelf && hasTrait(context, TRAIT.REMORSELESS)) {
    const state = professionCoreState(context);
    state.playerOpeningStrikeReady = true;
    state.petOpeningStrikeReady = true;
  }
}
