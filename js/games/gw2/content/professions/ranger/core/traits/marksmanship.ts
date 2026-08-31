/** Owns Core Ranger Marksmanship opening-strike and target-health trait behavior. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import {
  isPetStrike,
  isPlayerStrike,
  queueCondition,
  targetHealthFraction
} from '#gw2/content/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerResolverContext, RangerResolverEvent } from '#gw2/content/professions/ranger/types.js';
import {
  rangerBalanceProfile,
  rangerBalanceProfileEffect,
  RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/content/professions/ranger/core/profiles.js';

function profileEffect(context: unknown, id: number | string, type: string, index = 0) {
  return rangerBalanceProfileEffect(rangerBalanceProfile(context, id), type, index);
}

// Spend the player or pet Opening Strike independently on its first qualifying
// hit and attach Vulnerability plus Alpha Focus when selected.
export function consumeOpeningStrike(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!hasTrait(context, TRAIT.OPENING_STRIKE)) return;
  const state = professionCoreState(context);
  const player = isPlayerStrike(event);
  const pet = isPetStrike(event);
  if ((!player && !pet) || !(Number(event.coefficient) > 0)) return;
  const ready = player ? state.playerOpeningStrikeReady : state.petOpeningStrikeReady;
  if (!ready) return;
  if (player) state.playerOpeningStrikeReady = false;
  else state.petOpeningStrikeReady = false;
  const openingStrike = profileEffect(context, PROFILE.openingStrike, 'condition');
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.OPENING_STRIKE,
    actorType: 'effect',
    skillId: TRAIT.OPENING_STRIKE,
    skillName: 'Opening Strike',
    name: 'Opening Strike - Vulnerability',
    condition: 'Vulnerability',
    duration: Number(openingStrike?.duration ?? 5),
    stacks: Number(openingStrike?.stacks ?? 5),
    triggeredBy: event.skillName
  });
  if (hasTrait(context, TRAIT.ALPHA_FOCUS)) {
    const alphaFocus = profileEffect(context, PROFILE.alphaFocus, 'condition');
    queueCondition(
      context,
      event,
      String(alphaFocus?.condition || 'Crippled'),
      Number(alphaFocus?.duration ?? 2),
      Number(alphaFocus?.stacks ?? 1),
      TRAIT.ALPHA_FOCUS,
      'Alpha Focus'
    );
  }
}

// Convert the target's current health tier into ICD-bound Might stacks on a
// qualifying player strike, using the resolver's cumulative damage state.
export function triggerHuntersGaze(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!isPlayerStrike(event) || !hasTrait(context, TRAIT.HUNTERS_GAZE)) return;
  const state = professionCoreState(context);
  if (!isInternalCooldownReady(event.at, state.huntersGazeReadyAt)) return;
  const health = targetHealthFraction(context);
  const profile = rangerBalanceProfile(context, PROFILE.huntersGaze);
  const maximumStacks = Number(profile?.maximumStacks ?? 3);
  const stacks =
    health < 0.25
      ? maximumStacks
      : health < 0.5
        ? Math.max(0, maximumStacks - 1)
        : health < 0.75
          ? Math.max(0, maximumStacks - 2)
          : 0;
  if (!stacks) return;
  state.huntersGazeReadyAt = event.at + Number(profile?.internalCooldown ?? 1);
  const might = rangerBalanceProfileEffect(profile, 'boon');
  context.recordProc(
    'trait',
    "Hunter's Gaze",
    event.at,
    event.skillName,
    `${stacks} might`,
    context.helpers.skillsById?.get(TRAIT.HUNTERS_GAZE)?.icon || ''
  );
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.HUNTERS_GAZE,
    actorType: 'effect',
    skillId: TRAIT.HUNTERS_GAZE,
    skillName: "Hunter's Gaze",
    name: "Hunter's Gaze - Might",
    kind: String(might?.boon || 'might'),
    duration: gw2ResolverBoonDuration(context, event, String(might?.boon || 'might'), Number(might?.duration ?? 5)),
    stacks,
    triggeredBy: event.skillName
  });
}

export function reactToRangerCoreBuff(context: RangerResolverContext, event: RangerResolverEvent): void {
  const kind = String(event.kind || '').toLowerCase();
  const affectsSelf = event.affectsSelf !== false;
  if (kind === 'fury' && affectsSelf && hasTrait(context, TRAIT.REMORSELESS)) {
    const state = professionCoreState(context);
    state.playerOpeningStrikeReady = true;
    state.petOpeningStrikeReady = true;
  }
}
