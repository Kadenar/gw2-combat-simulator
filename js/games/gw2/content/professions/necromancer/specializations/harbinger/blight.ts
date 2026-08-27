import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '../../../../../platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../../../platform/engine/events/state-snapshots.js';
import type { EmitSkillBuffOptions } from '../../../../../platform/scheduler/skill-events.js';
import { addBlight, consumeBlight, harbingerState, purgeHarbingerTimedState } from './state.js';
import { professionCoreState } from '../../../../../platform/engine/profession/state.js';
import { snapshotNecromancerState } from '../../state.js';
/**
 * Harbinger blight skill handlers.
 *
 * Elixirs and blight ("shroud") skills consume accumulated blight to fire an
 * empowered variant (higher coefficient, extra conditions/boons), then add
 * fresh blight. Consuming blight also feeds the Cascading Corruption trait,
 * which procs Meltdown every 20 stacks. Exports `necromancerBlightSkillHandlers`.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import type { NecromancerCastContext, NecromancerSchedulerContext, NecromancerSkill } from '../../types.js';
import type { BalanceProfile, SkillEffect } from '../../../../../platform/engine/types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID } from './profiles.js';

export const MELTDOWN_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png';

const CASCADING_CORRUPTION_EFFECT: NecromancerSkill = Object.freeze({
  id: ID.CASCADING_CORRUPTION,
  name: 'Cascading Corruption',
  type: 'Trait',
  skillWeapon: 'Unequipped'
});

export function advanceHarbingerBlight(context: NecromancerSchedulerContext, target: number): void {
  const state = harbingerState.from(context);
  const coreState = professionCoreState(context);
  purgeHarbingerTimedState(state, target);
  // Blight only accrues while inside Harbinger Shroud; reset the cursor after every exit path.
  if (coreState.activeShroud !== 'harbinger') {
    state.nextBlightAt = Number.POSITIVE_INFINITY;
    return;
  }

  const start = Number(coreState.lastResourceAt || 0);
  const end = Math.max(start, Number(target || 0));
  // Life force drains at 5% of maximum per second inside Harbinger Shroud.
  const resources = necromancerBalanceProfile(context, PROFILE.resources);
  const drainRate = (Number(coreState.maximumLifeForce || 100) * Number(resources?.lifeForceDrain || 5)) / 100;
  // exitAt is the moment life force would hit 0 — Blight stops accruing if shroud exits before `end`.
  const exitAt =
    drainRate > 0 && drainRate * (end - start) >= coreState.lifeForce ? start + coreState.lifeForce / drainRate : end;
  // Doom Approaches doubles the passive Blight gain rate (2 → 4 stacks/s).
  const stacksPerSecond = Number(
    hasTrait(context, TRAIT.DOOM_APPROACHES)
      ? necromancerBalanceProfile(context, PROFILE.doomApproaches)?.blightGain || 4
      : resources?.blightGain || 2
  );
  // nextBlightAt is a whole-second cursor; each tick adds stacksPerSecond stacks and advances the cursor by 1 s.
  while (Number(state.nextBlightAt ?? Number.POSITIVE_INFINITY) <= exitAt + context.epsilon) {
    const nextBlightAt = Number(state.nextBlightAt);
    addBlight(state, stacksPerSecond, nextBlightAt);
    state.nextBlightAt = nextBlightAt + 1;
  }
}

function applyCascadingCorruption(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  consumed: number,
  at: number
): void {
  if (
    !hasTrait(context, TRAIT.CASCADING_CORRUPTION) ||
    !consumed ||
    // Pre-combat Blight consumption (e.g. from initialBlight config) must not trigger Meltdown before the fight starts.
    (context.hasExplicitCombatStart && (context.combatStartTime == null || at < Number(context.combatStartTime)))
  )
    return;
  const state = harbingerState.from(context);
  const profile = necromancerBalanceProfile(context, PROFILE.cascadingCorruption);
  const threshold = Number(profile?.minimumStacks || 20);
  state.cascadingCorruptionStacks += consumed;
  // Every 20 accumulated stacks triggers exactly one Meltdown; remainder carries over to the next threshold.
  if (state.cascadingCorruptionStacks < threshold) return;
  state.cascadingCorruptionStacks -= threshold;
  // Meltdown lasts 10 s and grants the Cascading Corruption damage bonus during that window.
  state.meltdownUntil = at + Number(balanceProfileEffect(profile, 'buff')?.duration || 10);
  context.emit({
    type: 'proc',
    procType: 'trait',
    at,
    name: 'Meltdown',
    sourceSkill: skill.name,
    detail: `Consumed ${threshold} Cascading Corruption stacks`,
    icon: MELTDOWN_ICON,
    source: 'Trait',
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: 'effect'
  });
  emitSkillDamage(context, CASCADING_CORRUPTION_EFFECT, {
    at,
    source: 'Trait',
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: 'effect',
    coefficient: Number(balanceProfileEffect(profile, 'strike')?.coefficient || 4.5),
    metadata: {
      parentSkillName: skill.name
    }
  });
  const torment = balanceProfileEffect(profile, 'condition');
  emitSkillCondition(context, CASCADING_CORRUPTION_EFFECT, {
    at,
    source: 'Trait',
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: 'effect',
    condition: String(torment?.condition || 'Torment'),
    stacks: Number(torment?.stacks || 6),
    duration: Number(torment?.duration || 6),
    metadata: {
      parentSkillName: skill.name
    }
  });
}

// Materialize either the base or Blight-empowered elixir profile while retaining
// Blight metadata and party-boon routing on every supported effect type.
function emitElixirEffects(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  source: NecromancerSkill | BalanceProfile,
  impactAt: number,
  boonOptions: Pick<EmitSkillBuffOptions, 'metadata'> | undefined,
  blight: number
): void {
  for (const effect of (source.effects || []) as readonly SkillEffect[]) {
    if (effect.type === 'strike') {
      emitSkillDamage(context, skill, {
        at: impactAt,
        coefficient: Number(effect.coefficient || 0),
        hits: Number(effect.hits || 1),
        metadata: {
          blightEmpowered: source !== skill,
          necromancerBlight: blight
        }
      });
    } else if (effect.type === 'condition') {
      emitSkillCondition(context, skill, {
        at: impactAt,
        condition: String(effect.condition || ''),
        stacks: Number(effect.stacks || 1),
        duration: Number(effect.duration || 0)
      });
    } else if (effect.type === 'boon') {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        kind: String(effect.boon || ''),
        duration: Number(effect.duration || 0),
        stacks: Number(effect.stacks || 1),
        ...(boonOptions || {})
      });
    } else if (effect.type === 'blind') {
      context.emit({
        type: 'blind',
        at: context.effectiveEnd,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      });
    }
  }
}

function elixir(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const at = context.effectiveEnd;
  // These three elixirs have a mid-cast impact time; others (Bliss, Ignorance, Anguish) impact at cast end.
  // The fraction represents hit-frame / total-cast-time from wiki frame data.
  const impactProgress =
    (
      {
        [ID.ELIXIR_OF_PROMISE]: 10 / 17,
        [ID.ELIXIR_OF_RISK]: 20 / 27,
        [ID.ELIXIR_OF_AMBITION]: 10 / 17
      } as Readonly<Record<string | number, number>>
    )[skill.id] ?? 1;
  const impactAt = context.start + (context.fullEnd - context.start) * impactProgress;
  const commitAt = skill.interruptCommitMs == null ? impactAt : context.start + Number(skill.interruptCommitMs) / 1000;
  // A canceled throw must reach its launch/impact commit before it can consume Blight or apply any effects.
  if (Math.round((at - context.start) * 1000) < Math.round((commitAt - context.start) * 1000)) return true;
  const state = harbingerState.from(context);
  const ambition = skill.id === ID.ELIXIR_OF_AMBITION;
  const empoweredProfile = necromancerBalanceProfile(
    context,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(skill.id)]
  );
  const threshold = Number(empoweredProfile?.blightCost || skill.blightCost || 5);
  const empowered = state.blight >= threshold;
  const consumed = empowered ? consumeBlight(state, threshold, at) : 0;
  applyCascadingCorruption(context, skill, consumed, at);
  emitStateSnapshot(context, 'necromancer', at, 'blight-consumed', snapshotNecromancerState(context.state.profession), {
    dedupeAcrossSourceIds: true
  });
  const boonOptions = hasTrait(context, TRAIT.TWISTED_MEDICINE)
    ? { metadata: { recipients: 'party', maximumRecipients: 5 } }
    : undefined;
  if (hasTrait(context, TRAIT.BOLSTERING_BREW)) {
    const protection = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.bolsteringBrew), 'boon');
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      kind: String(protection?.boon || 'protection'),
      duration: Number(protection?.duration || 3),
      stacks: Number(protection?.stacks || 1),
      ...(boonOptions || {})
    });
  }

  emitElixirEffects(
    context,
    skill,
    empowered && empoweredProfile ? empoweredProfile : skill,
    impactAt,
    boonOptions,
    state.blight
  );
  // Elixir of Ambition grants more Blight than other elixirs, consistent with its higher empowerment threshold.
  addBlight(state, Number((empoweredProfile || skill).blightGain || (ambition ? 15 : 10)), at);
  emitStateSnapshot(context, 'necromancer', at, 'blight-gained', snapshotNecromancerState(context.state.profession), {
    dedupeAcrossSourceIds: true
  });
  return true;
}

function blightSkill(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const at = context.effectiveEnd;
  // Devouring Cut must reach its declared commit frame before spending Blight or landing its packet.
  if (skill.id === ID.DEVOURING_CUT && Math.round((at - context.start) * 1000) < Number(skill.interruptCommitMs || 0)) {
    return true;
  }

  // Blight skills have mid-cast hit frames; these fractions come from wiki frame data, not approximations.
  const impactProgress = skill.id === ID.DEVOURING_CUT ? 0.75 : skill.id === ID.VORACIOUS_ARC ? 20 / 21 : 1;
  const impactAt = context.start + (context.fullEnd - context.start) * impactProgress;
  const state = harbingerState.from(context);
  const empoweredProfile = necromancerBalanceProfile(
    context,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(skill.id)]
  );
  const cost = Number(empoweredProfile?.blightCost || skill.blightCost || 5);
  const empowered = state.blight >= cost;
  const consumed = empowered ? consumeBlight(state, cost, at) : 0;
  // The strike snapshots Blight after the five-stack activation cost. Blight
  // generated during the cast is advanced afterward and affects later skills.
  const damageBlight = state.blight;
  applyCascadingCorruption(context, skill, consumed, at);
  emitStateSnapshot(context, 'necromancer', at, 'blight-skill', snapshotNecromancerState(context.state.profession), {
    dedupeAcrossSourceIds: true
  });
  const source = empowered && empoweredProfile ? empoweredProfile : skill;
  const strike = balanceProfileEffect(source, 'strike');
  if (!strike) return false;
  emitSkillDamage(context, skill, {
    at: impactAt,
    coefficient: Number(strike.coefficient || 0),
    metadata: {
      blightEmpowered: empowered,
      necromancerBlight: damageBlight
    }
  });
  if (empowered) {
    const condition = balanceProfileEffect(source, 'condition');
    if (condition) {
      emitSkillCondition(context, skill, {
        at: impactAt,
        condition: String(condition.condition || 'Torment'),
        stacks: Number(condition.stacks || 1),
        duration: Number(condition.duration || 0)
      });
    }
  }

  // Devouring Cut has no CC; Voracious Arc normally dazes but Doom Approaches upgrades the daze to a fear.
  if (skill.id !== ID.DEVOURING_CUT) {
    emitSkillControl(context, skill, {
      at: impactAt,
      controlKind: hasTrait(context, TRAIT.DOOM_APPROACHES) ? 'fear' : 'daze',
      duration: 0.5
    });
  }

  return true;
}

export const necromancerBlightSkillHandlers = Object.freeze({
  'necromancer.elixir': elixir,
  'necromancer.blight-skill': blightSkill
});
