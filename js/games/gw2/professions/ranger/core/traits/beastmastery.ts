/** Owns Core Ranger Beastmastery command and companion-attack trait behavior. */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GW2_STANDARD_BOONS, isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { eventSkill } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type {
  RangerCastContext,
  RangerResolverContext,
  RangerResolverEvent,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

// Snapshot the Ranger's configured and still-active boons at command completion,
// then mirror their current duration and stacks to the active companion only.
export function applyRangerCommandTraits(context: RangerCastContext, skill: RangerSkill): void {
  if (!professionCoreState(context).petActive || !hasTrait(context, TRAIT.RESOUNDING_TIMBRE)) return;

  const active = new Map<string, { duration: number; stacks: number }>();
  for (const kind of GW2_STANDARD_BOONS) {
    const configured = context.config.boons?.[kind];
    const stacks = kind === 'might' ? Math.min(25, Math.max(0, Number(configured || 0))) : configured ? 1 : 0;
    if (stacks > 0) active.set(kind, { duration: 3600, stacks });
  }

  for (const event of context.events) {
    const kind = String(event.kind || '').toLowerCase();
    const remaining = Number(event.at) + Number(event.duration || 0) - context.effectiveEnd;
    if (
      event.type !== 'buff' ||
      !event.resolvedAudience?.includesSelf ||
      !isStandardBoon(kind) ||
      Number(event.at) > context.effectiveEnd + context.epsilon ||
      !(remaining > 0)
    ) {
      continue;
    }

    const previous = active.get(kind);
    active.set(kind, {
      duration: Math.max(remaining, Number(previous?.duration || 0)),
      stacks: Math.min(
        kind === 'might' || kind === 'stability' ? 25 : 1,
        Number(previous?.stacks || 0) + Math.max(1, Number(event.stacks || 1))
      )
    });
  }

  for (const [kind, application] of active) {
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.RESOUNDING_TIMBRE,
      actorType: 'effect',
      skillId: TRAIT.RESOUNDING_TIMBRE,
      skillName: 'Resounding Timbre',
      name: `Resounding Timbre - ${kind}`,
      kind,
      duration: application.duration,
      stacks: application.stacks,
      audience: {
        recipients: 'summons' as const,
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: [rangerPetCompanionId(context)]
      },
      triggeredBy: skill.name
    });
  }
}

// Trigger Go for the Throat from its qualifying Ranger or pet event and apply the
// profile-owned companion strike with stable ownership.
export function triggerGoForTheThroat(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  const beastSkillId = state.activePetSkillIds.at(-1);
  if (
    event.skillId !== beastSkillId ||
    !skill?.petSkill ||
    skill.petFamilySkill ||
    !hasTrait(context, TRAIT.GO_FOR_THE_THROAT) ||
    !isInternalCooldownReady(event.at, state.goForTheThroatPetReadyAt)
  ) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.goForTheThroat);
  const lesserSicEm = balanceProfileEffect(profile, 'buff', 0);
  state.goForTheThroatPetReadyAt = event.at + Number(profile?.internalCooldown ?? 10);
  const duration = Number(lesserSicEm?.duration ?? 8);
  context.recordProc(
    'trait',
    'Lesser "Sic \'Em!"',
    event.at,
    event.skillName,
    `${duration}s, +40% pet strike damage`,
    context.helpers.skillsById?.get(ID.LESSER_SIC_EM)?.icon || context.helpers.skillsById?.get(ID.SIC_EM)?.icon || ''
  );
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'Trait',
    sourceId: ID.LESSER_SIC_EM,
    actorType: 'effect',
    skillId: ID.LESSER_SIC_EM,
    skillName: 'Lesser "Sic \'Em!"',
    name: 'Lesser "Sic \'Em!"',
    kind: String(lesserSicEm?.kind || 'lesser-sic-em-pet'),
    duration,
    stacks: Number(lesserSicEm?.stacks ?? 1),
    audience: {
      recipients: 'summons' as const,
      affectsSelf: false,
      maximumRecipients: 1,
      eligibleCompanionIds: [rangerPetCompanionId(context)]
    },
    triggeredBy: event.skillName
  });
}
