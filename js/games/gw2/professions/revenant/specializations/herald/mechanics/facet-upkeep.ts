import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { consumeSkillFlip, armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { HERALD_MECHANICS as MECHANICS } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import {
  HERALD_ELEVATED_COMPASSION_PROFILE_ID,
  HERALD_DRACONIC_ECHO_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';

interface HeraldFacetPulsePayload {
  readonly skillId: SkillId;
}

export const HERALD_ELEVATED_COMPASSION_TASK = 'revenant.herald-elevated-compassion';
const ELEVATED_COMPASSION_TASK_OWNER = 'revenant.herald-elevated-compassion';

function elevatedCompassionProfile(context: RevenantSchedulerContext) {
  return requireBalanceProfileFromContext(context, HERALD_ELEVATED_COMPASSION_PROFILE_ID);
}

function elevatedCompassionIsActive(context: RevenantSchedulerContext): boolean {
  const threshold = Math.max(0, balanceProfileNumber(elevatedCompassionProfile(context), 'threshold'));
  const upkeep = professionCoreState(context).activeUpkeeps.reduce(
    (total, active) => total + Math.max(0, Number(active.upkeepCost || 0)),
    0
  );
  return hasTrait(context.config, TRAIT.ELEVATED_COMPASSION) && upkeep >= threshold;
}

function grantElevatedCompassionQuickness(context: RevenantSchedulerContext, at: number): void {
  const profile = elevatedCompassionProfile(context);
  const effect = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves the pulse ready.
  if (!effect) return;
  const baseDuration = Math.max(0, effectNumber(profile, effect, 'duration'));
  const skill = { id: TRAIT.ELEVATED_COMPASSION, name: 'Elevated Compassion' } as RevenantSkill;
  const duration = gw2SchedulerBoonDuration(context, skill, String(effect.boon), baseDuration);

  // Emit one self-affecting party boon and reserve the next legal pulse so threshold re-entry cannot bypass the ICD.
  emitSkillBuff(context, {
    at,
    source: 'revenant',
    sourceId: TRAIT.ELEVATED_COMPASSION,
    actorType: 'player',
    skillId: TRAIT.ELEVATED_COMPASSION,
    skillName: 'Elevated Compassion',
    name: 'Elevated Compassion - quickness',
    kind: String(effect.boon),
    duration,
    stacks: Math.max(1, effectNumber(profile, effect, 'stacks')),
    audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
  });

  const cooldown = Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown'));
  heraldState.from(context).elevatedCompassionReadyAt = at + cooldown;
}

/** Starts or stops Elevated Compassion's one-second pulse loop after upkeep-changing casts. */
export function syncElevatedCompassion(context: RevenantCastContext): void {
  const at = context.effectiveEnd;
  if (!elevatedCompassionIsActive(context)) {
    elevatedCompassion.cancelKey(context, 'compassion');
    return;
  }

  if (Number.isFinite(context.tasks.nextAt(HERALD_ELEVATED_COMPASSION_TASK))) return;
  const readyAt = Math.max(at, Number(heraldState.from(context).elevatedCompassionReadyAt || 0));
  if (readyAt <= at + EPSILON) {
    grantElevatedCompassionQuickness(context, at);
    elevatedCompassion.start(context, {
      key: 'compassion',
      at: heraldState.from(context).elevatedCompassionReadyAt,
      ownerId: ELEVATED_COMPASSION_TASK_OWNER,
      captured: {}
    });
    return;
  }

  elevatedCompassion.start(context, {
    key: 'compassion',
    at: readyAt,
    ownerId: ELEVATED_COMPASSION_TASK_OWNER,
    captured: {}
  });
}

/** Grants a recurring Elevated Compassion pulse only while the configured upkeep threshold remains met. */
export const elevatedCompassion = timedEffect({
  id: HERALD_ELEVATED_COMPASSION_TASK,
  effectsAt(context: RevenantSchedulerContext, at: number) {
    if (!elevatedCompassionIsActive(context)) return false;
    grantElevatedCompassionQuickness(context, at);
  },
  nextAt: (context: RevenantSchedulerContext) => heraldState.from(context).elevatedCompassionReadyAt
});

/** Removes the active facet and consumes its temporary flip. */
export function consumeRevenantFacet(context: RevenantCastContext, skill: RevenantSkill): void {
  if (context.action?.cancelled) return;
  const state = professionCoreState(context);
  // Use cast completion time so cooldowns start after the animation finishes, consistent with other skills.
  const at = context.effectiveEnd;
  const facetByConsume = MECHANICS.facetSkillByConsumeId as Readonly<Record<SkillId, SkillId>>;
  const facetId = facetByConsume[skill.id];
  const facet = facetId == null ? undefined : context.catalog.skillsById.get(facetId);
  const wasActive = state.activeUpkeeps.some((upkeep) => upkeep.skillId === facet?.id);
  state.activeUpkeeps = state.activeUpkeeps.filter((upkeep) => upkeep.skillId !== facet?.id);
  // Remove the consume flip itself from availableFlips so it can't be cast a second time.
  consumeSkillFlip(state.availableFlips, skill.id);
  if (facet) {
    // Parent ownership also makes Facet of Nature's 20-second cooldown shared by every legend-specific True Nature ID.
    const cooldown = Math.max(0, Number(context.rechargeDuration || 0));
    if (cooldown > 0) {
      context.state.cooldowns.set(facet.id, at + cooldown);
    }

    // Cancel the recurring upkeep-pulse task; without this the pulse loop would continue firing after the facet is gone.
    context.tasks.cancelOwner(`revenant.upkeep:${facet.id}`);
    if (wasActive && hasTrait(context.config, TRAIT.DRACONIC_ECHO)) {
      const passive = heraldState.from(context);
      const profile = requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID);
      const expiresAt = at + balanceProfileNumber(profile, 'duration');
      // Retention preserves the pulse phase, but never keeps an Energy-draining upkeep alive.
      passive.lingeringFacets[facet.id] = { startsAt: at, expiresAt, legendId: state.activeLegendId };
      const ownerId = `revenant.echo:${facet.id}`;
      context.tasks.cancelOwner(ownerId);
      const nextAt = passive.facetPulseReadyAt[facet.id];
      if (facet.upkeepPulse && nextAt >= at && nextAt < expiresAt) {
        facetPulses.start(context, {
          key: String(facet.id),
          at: nextAt,
          ownerId,
          captured: { skillId: facet.id }
        });
      }

      facetExpiry.start(context, {
        key: String(facet.id),
        count: 1,
        at: expiresAt,
        ownerId,
        captured: { skillId: facet.id }
      });
    }
  }

  emitRevenantStateSnapshot(context, at, 'facet-consumed');
}

export function heraldFacetConsumeId(skill: RevenantSkill, activeLegendId: string): SkillId | undefined {
  if (skill.id === ID.FACET_OF_NATURE) {
    return (MECHANICS.trueNatureConsumeByLegendId as Readonly<Record<string, SkillId>>)[activeLegendId];
  }

  return (MECHANICS.facetConsumeBySkillId as Readonly<Record<SkillId, SkillId>>)[skill.id];
}

/** Arms the consume flip and starts Herald's own recurring boon pulse task. */
export function afterHeraldFacetCast(context: RevenantCastContext, skill: RevenantSkill): void {
  if (!skill.facet) return;
  const state = professionCoreState(context);
  const active = state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id);
  if (!active) return;
  const passive = heraldState.from(context);
  delete passive.lingeringFacets[skill.id];
  context.tasks.cancelOwner(`revenant.echo:${skill.id}`);
  const consumeId = heraldFacetConsumeId(skill, state.activeLegendId);
  if (consumeId != null) armSkillFlip(state.availableFlips, consumeId, context.effectiveEnd);
  if (!skill.upkeepPulse) return;
  passive.facetPulseReadyAt[skill.id] = context.effectiveEnd + Math.max(EPSILON, Number(skill.pulseInterval ?? 3));
  facetPulses.start(context, {
    key: String(skill.id),
    at: passive.facetPulseReadyAt[skill.id],
    ownerId: `revenant.upkeep:${skill.id}`,
    captured: { skillId: skill.id }
  });
}

/** Emits one Herald facet boon pulse and keeps its specialization-owned cadence running. */
function emitFacetPulse(
  context: RevenantSchedulerContext,
  at: number,
  { skillId }: HeraldFacetPulsePayload
): void | false {
  const state = heraldState.from(context);
  const core = professionCoreState(context);
  if (skillId == null || !heraldFacetPassiveActive(core, state, skillId, at)) {
    return false;
  }

  const skill = context.catalog.skillsById.get(skillId);
  const pulse = skill?.upkeepPulse as
    { readonly kind: string; readonly duration: number; readonly stacks: number } | undefined;
  if (!skill || !pulse) return false;
  emitSkillBuff(context, skill, {
    at: at,
    name: `${skill.name} - ${pulse.kind}`,
    kind: pulse.kind,
    duration: pulse.duration,
    stacks: pulse.stacks,
    audience: { recipients: 'party' as const }
  });
}

/** Preserve the phase through Draconic Echo while the shared sequence owns pulse recurrence. */
export const facetPulses = timedEffect({
  id: 'revenant.herald-facet-pulse',
  effectsAt: emitFacetPulse,
  nextAt(context: RevenantSchedulerContext, at: number, { skillId }: HeraldFacetPulsePayload) {
    const state = heraldState.from(context);
    const skill = context.catalog.skillsById.get(skillId);
    const nextAt = at + Math.max(EPSILON, Number(skill?.pulseInterval ?? 3));
    state.facetPulseReadyAt[skillId] = nextAt;
    return heraldFacetPassiveActive(professionCoreState(context), state, skillId, nextAt) ? nextAt : null;
  }
});

/** Expire retained bonuses in both phases, even when no attack occurs at the boundary. */
export const facetExpiry = timedEffect({
  id: 'revenant.herald-echo-expiry',
  effectsAt(context: RevenantSchedulerContext, at: number, { skillId }: HeraldFacetPulsePayload) {
    delete heraldState.from(context).lingeringFacets[skillId];
    facetPulses.cancelKey(context, String(skillId));
    emitRevenantStateSnapshot(context, at, 'facet-passive-expired');
  }
});
