import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/index.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';
import {
  gainLethalTempo,
  lethalTempoParameters
} from '#gw2/professions/guardian/specializations/willbender/mechanics/lethal-tempo.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

function recordLethalTempo(context: GuardianResolverContext, at: number, sourceSkill: string | undefined): void {
  const state = willbenderState.from(context);
  const stacks = gainLethalTempo(state, at, lethalTempoParameters(context));
  context.recordProc(
    'trait',
    'Lethal Tempo',
    at,
    sourceSkill,
    `${stacks}/5 stacks`,
    guardianTraitIcon(GUARDIAN_TRAIT_IDS.LETHAL_TEMPO)
  );
}

function handleWillbenderVirtueActivation(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const virtue = event.virtue;
  if (!virtue) return;
  const state = willbenderState.from(context);
  state.flameVirtue = virtue;
  // Reopening a window preserves partial hit progress, including across inactive gaps.
  // State and the displayed buff expire on the same absolute effect tick.
  const until = gw2EffectExpiresAt(event.at, Number(event.duration || 0));
  if (virtue === 'justice') state.justiceUntil = until;
  if (virtue === 'resolve') state.resolveUntil = until;
  if (virtue === 'courage') state.courageUntil = until;
  recordLethalTempo(context, event.at, event.skillName);
}

function handleWillbenderVirtueTrigger(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const virtue = event.virtue;
  if (!virtue) return;
  const state = willbenderState.from(context);
  state.triggeredVirtueEffects += 1;
  recordLethalTempo(context, event.at, event.sourceSkill as string | undefined);
  if (virtue !== 'justice') return;
  const active = event.justiceActive !== false;
  const core = professionCoreState(context);
  if (active) core.justiceActiveBurns += 1;
  else core.justicePassiveBurns += 1;
  // Burning is enqueued into the resolver's condition queue rather than emitted
  // directly so it respects the condition-application ordering alongside other burns.
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      priority: 5,
      source: 'guardian',
      sourceId: 'guardian.justice-passive',
      actorType: 'player',
      skillId: ID.WILLBENDER_JUSTICE,
      skillName: 'Justice',
      name: `Justice — ${active ? 'Active' : 'Passive'} Burning`,
      icon: context.helpers.skillsById?.get(ID.RUSHING_JUSTICE)?.icon || '', // WILLBENDER_JUSTICE has no icon; Rushing Justice shares the same visual in-game

      condition: 'Burning',
      stacks: 1,
      duration: Number(event.burningDuration ?? 2),
      triggeredBy: event.sourceSkill
    })
  );
}

export const willbenderEventHandlers = Object.freeze({
  'guardian.willbender-virtue-activated': handleWillbenderVirtueActivation,
  'guardian.willbender-virtue-triggered': handleWillbenderVirtueTrigger
});
