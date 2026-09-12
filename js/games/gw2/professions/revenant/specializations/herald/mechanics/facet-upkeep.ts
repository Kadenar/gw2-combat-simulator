import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import { HERALD_MECHANICS as MECHANICS } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import {
  HERALD_ELEVATED_COMPASSION_PROFILE_ID,
  HERALD_DRACONIC_ECHO_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';

interface HeraldFacetPulsePayload extends SchedulerRecord {
  readonly skillId: SkillId;
}

export const HERALD_ELEVATED_COMPASSION_TASK = 'revenant.herald-elevated-compassion';
const ELEVATED_COMPASSION_TASK_OWNER = 'revenant.herald-elevated-compassion';

function elevatedCompassionProfile(context: RevenantSchedulerContext) {
  const profile = context.catalog.balanceProfilesById.get(HERALD_ELEVATED_COMPASSION_PROFILE_ID);
  if (!profile) throw new Error('Missing Elevated Compassion balance profile.');
  return profile;
}

function elevatedCompassionIsActive(context: RevenantSchedulerContext): boolean {
  const threshold = Math.max(0, Number(elevatedCompassionProfile(context).threshold || 0));
  const upkeep = professionCoreState(context).activeUpkeeps.reduce(
    (total, active) => total + Math.max(0, Number(active.upkeepCost || 0)),
    0
  );
  return hasTrait(context.config, TRAIT.ELEVATED_COMPASSION) && upkeep >= threshold;
}

function grantElevatedCompassionQuickness(context: RevenantSchedulerContext, at: number): void {
  const profile = elevatedCompassionProfile(context);
  const effect = profile.effects?.find((candidate) => candidate.type === 'boon');
  if (!effect) throw new Error('Elevated Compassion is missing its quickness effect.');
  const baseDuration = Math.max(0, Number(effect.duration || 0));
  const skill = { id: TRAIT.ELEVATED_COMPASSION, name: 'Elevated Compassion' } as RevenantSkill;
  const duration = gw2SchedulerBoonDuration(context, skill, String(effect.boon || 'quickness'), baseDuration);

  // Emit one self-affecting party boon and reserve the next legal pulse so threshold re-entry cannot bypass the ICD.
  emitSkillBuff(context, {
    at,
    source: 'revenant',
    sourceId: TRAIT.ELEVATED_COMPASSION,
    actorType: 'player',
    skillId: TRAIT.ELEVATED_COMPASSION,
    skillName: 'Elevated Compassion',
    name: 'Elevated Compassion - quickness',
    kind: String(effect.boon || 'quickness'),
    duration,
    stacks: Math.max(1, Number(effect.stacks ?? 1)),
    audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
  });

  const cooldown = Math.max(context.epsilon, Number(profile.cooldown || 0));
  heraldState.from(context).elevatedCompassionReadyAt = at + cooldown;
  context.tasks.schedule({
    type: HERALD_ELEVATED_COMPASSION_TASK,
    at: at + cooldown,
    ownerId: ELEVATED_COMPASSION_TASK_OWNER
  });
}

/** Starts or stops Elevated Compassion's one-second pulse loop after upkeep-changing casts. */
export function syncElevatedCompassion(context: RevenantCastContext): void {
  const at = context.effectiveEnd;
  if (!elevatedCompassionIsActive(context)) {
    context.tasks.cancelOwner(ELEVATED_COMPASSION_TASK_OWNER);
    return;
  }

  if (Number.isFinite(context.tasks.nextAt(HERALD_ELEVATED_COMPASSION_TASK))) return;
  const readyAt = Math.max(at, Number(heraldState.from(context).elevatedCompassionReadyAt || 0));
  if (readyAt <= at + context.epsilon) {
    grantElevatedCompassionQuickness(context, at);
    return;
  }

  context.tasks.schedule({
    type: HERALD_ELEVATED_COMPASSION_TASK,
    at: readyAt,
    ownerId: ELEVATED_COMPASSION_TASK_OWNER
  });
}

/** Grants a recurring Elevated Compassion pulse only while the configured upkeep threshold remains met. */
export function handleElevatedCompassionPulse(context: RevenantSchedulerContext, task: RevenantScheduledTask): void {
  if (!elevatedCompassionIsActive(context)) return;
  grantElevatedCompassionQuickness(context, task.at);
}

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
  delete state.availableFlips[skill.id];
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
      const profile = context.catalog.balanceProfilesById.get(HERALD_DRACONIC_ECHO_PROFILE_ID);
      if (!profile) throw new Error('Missing Draconic Echo balance profile.');
      const expiresAt = at + Number(profile.duration);
      // Retention preserves the pulse phase, but never keeps an Energy-draining upkeep alive.
      passive.lingeringFacets[facet.id] = { startsAt: at, expiresAt, legendId: state.activeLegendId };
      const ownerId = `revenant.echo:${facet.id}`;
      context.tasks.cancelOwner(ownerId);
      const nextAt = passive.facetPulseReadyAt[facet.id];
      if (facet.upkeepPulse && nextAt >= at && nextAt < expiresAt) {
        context.tasks.schedule({
          type: 'revenant.herald-facet-pulse',
          at: nextAt,
          ownerId,
          payload: { skillId: facet.id }
        });
      }

      context.tasks.schedule({
        type: 'revenant.herald-echo-expiry',
        at: expiresAt,
        ownerId,
        payload: { skillId: facet.id }
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
  if (consumeId != null) state.availableFlips[consumeId] = true;
  if (!skill.upkeepPulse) return;
  passive.facetPulseReadyAt[skill.id] =
    context.effectiveEnd + Math.max(context.epsilon, Number(skill.pulseInterval ?? 3));
  context.tasks.schedule({
    type: 'revenant.herald-facet-pulse',
    at: passive.facetPulseReadyAt[skill.id],
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId: skill.id }
  });
}

/** Emits one Herald facet boon pulse and keeps its specialization-owned cadence running. */
export function handleHeraldFacetPulse(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<HeraldFacetPulsePayload>
): void {
  const skillId = task.payload?.skillId;
  const state = heraldState.from(context);
  const core = professionCoreState(context);
  if (skillId == null || !heraldFacetPassiveActive(core, state, skillId, task.at)) {
    return;
  }

  const skill = context.catalog.skillsById.get(skillId);
  const pulse = skill?.upkeepPulse as
    { readonly kind: string; readonly duration: number; readonly stacks: number } | undefined;
  if (!skill || !pulse) return;
  emitSkillBuff(context, skill, {
    at: task.at,
    name: `${skill.name} - ${pulse.kind}`,
    kind: pulse.kind,
    duration: pulse.duration,
    stacks: pulse.stacks,
    audience: { recipients: 'party' as const }
  });
  const nextAt = task.at + Math.max(context.epsilon, Number(skill.pulseInterval ?? 3));
  state.facetPulseReadyAt[skillId] = nextAt;
  if (!heraldFacetPassiveActive(core, state, skillId, nextAt)) return;
  context.tasks.schedule({
    type: 'revenant.herald-facet-pulse',
    at: nextAt,
    ownerId: task.ownerId,
    payload: { skillId }
  });
}

/** Expire retained bonuses in both phases, even when no attack occurs at the boundary. */
export function expireHeraldEcho(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<HeraldFacetPulsePayload>
): void {
  const skillId = task.payload?.skillId;
  if (skillId == null) return;
  const state = heraldState.from(context);
  if (state.lingeringFacets[skillId]?.expiresAt !== task.at) return;
  delete state.lingeringFacets[skillId];
  context.tasks.cancelOwner(`revenant.echo:${skillId}`);
  emitRevenantStateSnapshot(context, task.at, 'facet-passive-expired');
}
