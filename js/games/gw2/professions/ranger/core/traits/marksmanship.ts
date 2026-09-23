import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverCondition, buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
/** Owns Core Ranger Marksmanship opening-strike and target-health trait behavior. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import {
  isPetStrike,
  isPlayerStrike,
  queueCondition,
  targetHealthFraction
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

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
  const openingStrikeProfile = requireBalanceProfileFromContext(context, PROFILE.openingStrike);
  const openingStrike = requireEffect(openingStrikeProfile, 'condition', 'Vulnerability');
  const alphaFocusProfile = hasTrait(context, TRAIT.ALPHA_FOCUS)
    ? requireBalanceProfileFromContext(context, PROFILE.alphaFocus)
    : undefined;
  const alphaFocus = alphaFocusProfile && requireEffect(alphaFocusProfile, 'condition', 'Crippled');
  // Readiness is spent by a delivered opener; with every opener packet removed it stays armed.
  if (!openingStrike && !alphaFocus) return;
  if (player) state.playerOpeningStrikeReady = false;
  else state.petOpeningStrikeReady = false;
  if (openingStrike)
    context.queue.enqueue(
      buildResolverCondition({
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
    );
  if (alphaFocusProfile && alphaFocus) {
    queueCondition(
      context,
      event,
      String(alphaFocus.condition),
      effectNumber(alphaFocusProfile, alphaFocus, 'duration'),
      effectNumber(alphaFocusProfile, alphaFocus, 'stacks'),
      TRAIT.ALPHA_FOCUS,
      'Alpha Focus'
    );
  }
}

// Convert the target's current health tier into ICD-bound Might stacks on a
// qualifying player strike, using the resolver's cumulative damage state.
export function triggerHuntersGaze(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event) || !hasTrait(context, TRAIT.HUNTERS_GAZE)) return;
  const state = professionCoreState(context);
  if (!isInternalCooldownReady(event.at, state.huntersGazeReadyAt)) return;
  const health = targetHealthFraction(context);
  const profile = requireBalanceProfileFromContext(context, PROFILE.huntersGaze);
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
  if (!stacks) return;
  state.huntersGazeReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
  context.recordProc(
    'trait',
    "Hunter's Gaze",
    event.at,
    event.skillName,
    `${stacks} might`,
    context.helpers.skillsById?.get(TRAIT.HUNTERS_GAZE)?.icon || ''
  );
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
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
    })
  );
}

export function reactToRangerCoreBuff(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const kind = String(event.kind || '').toLowerCase();
  if (kind === 'fury' && event.resolvedAudience?.includesSelf && hasTrait(context, TRAIT.REMORSELESS)) {
    const state = professionCoreState(context);
    state.playerOpeningStrikeReady = true;
    state.petOpeningStrikeReady = true;
  }
}
