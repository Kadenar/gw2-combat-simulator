import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import type { SkillId, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefEndurance } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import type { ThiefCastContext, ThiefDodge, ThiefSkill } from '#gw2/professions/thief/types.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';

import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';

// Dodge choice retains trait attribution while the balance profile owns every emitted effect.
const DAREDEVIL_DODGE_PROFILES: Readonly<Partial<Record<ThiefDodge, SkillId>>> = Object.freeze({
  'Bounding Dodger': PROFILE.boundingDodger,
  'Lotus Training': PROFILE.lotusTraining,
  'Unhindered Combatant': PROFILE.unhinderedCombatant
});

// Only the physical utility skills grant Brawler's Tenacity endurance — not all Daredevil skills
const BRAWLERS_TENACITY_PHYSICAL_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.CHANNELED_VIGOR,
  ID.BANDITS_DEFENSE,
  ID.REFLEXIVE_STRIKE,
  ID.DISTRACTING_DAGGERS,
  ID.FIST_FLURRY,
  ID.IMPAIRING_DAGGERS
]);

function emitDodgeEffect(context: ThiefCastContext, skill: ThiefSkill, sourceId: SkillId, effect: SkillEffect): void {
  const state = daredevilState.from(context);
  // Remap trait names to the in-game skill names that appear in logs/UI
  const dodgeSkillName =
    state.selectedDodge === 'Bounding Dodger'
      ? 'Bound'
      : state.selectedDodge === 'Lotus Training'
        ? 'Impaling Lotus'
        : state.selectedDodge;
  const at = effect.atMs == null ? context.effectiveEnd : context.start + effect.atMs / 1000;
  const common = {
    at,
    source: 'Trait',
    sourceId,
    actorType: 'player',
    skillId: skill.id,
    skillName: dodgeSkillName,
    // Dodge damage uses the triggered skill's art while retaining its trait attribution.
    icon: context.catalog.skillsByName.get(dodgeSkillName)?.icon,
    name: dodgeSkillName
  } as const;
  if (effect.type === 'strike') {
    const ticks = effect.ticks;
    if (ticks?.length) {
      for (const [index, tick] of ticks.entries()) {
        const hitIndex = index + 1;
        emitSkillDamage(context, {
          ...common,
          at: context.start + Number(tick.atMs) / 1000,
          source: 'thief',
          coefficient: Number(tick.coefficient),
          hits: 1,
          hitIndex,
          totalHits: ticks.length,
          skillWeapon: 'Unequipped'
        });
      }
    } else {
      emitSkillDamage(context, {
        ...common,
        source: 'thief',
        coefficient: Number(effect.coefficient ?? 0),
        hits: 1,
        skillWeapon: 'Unequipped'
      });
    }
  } else if (effect.type === 'condition') {
    emitSkillCondition(context, {
      ...common,

      name: `${dodgeSkillName} — ${effect.condition}`,
      condition: String(effect.condition || ''),
      stacks: Number(effect.stacks ?? 1),
      duration: Number(effect.duration ?? 0)
    });
  } else if (effect.type === 'boon') {
    // Dodge boons use the canonical scheduled buff event consumed by the resolver.
    emitSkillBuff(context, skill, {
      ...common,
      name: `${dodgeSkillName} — ${effect.boon}`,
      boon: effect.boon,
      kind: String(effect.boon || '').toLowerCase(),
      stacks: Number(effect.stacks ?? 1),
      duration: Number(effect.duration ?? 0)
    });
  }
}

export function applyDaredevilDodge(context: ThiefCastContext, skill: ThiefSkill): void {
  if (skill.id !== ID.DODGE) return;
  // Cancelled dodges spend endurance but do not grant the committed trait effects.
  if (context.action?.cancelled === true) return;
  const state = daredevilState.from(context);
  if (state.selectedDodge === 'Bounding Dodger') {
    // +6 s pads the 5 s in-game bonus window to absorb quickness-compressed cast times
    state.boundingDamageUntil =
      context.effectiveEnd +
      Number(balanceProfileFromContext(context, PROFILE.boundingDodger)?.durationMultiplier ?? 6);
  }

  if (state.selectedDodge === 'Lotus Training') {
    // Same padding as Bounding Dodger — resolver checks > context.time so equality is not enough
    state.lotusConditionDamageUntil =
      context.effectiveEnd + Number(balanceProfileFromContext(context, PROFILE.lotusTraining)?.durationMultiplier ?? 6);
  }

  if (hasTrait(context.config, TRAIT.WEAKENING_STRIKES)) {
    // Arm the one-shot Weakness proc; it fires on the very next attacking skill
    state.weakeningStrikeReady = true;
  }

  emitThiefStateSnapshot(context, context.effectiveEnd, 'daredevil-dodge');
  const profileId = DAREDEVIL_DODGE_PROFILES[state.selectedDodge];
  if (profileId == null) return;
  for (const effect of balanceProfileFromContext(context, profileId)?.effects || []) {
    emitDodgeEffect(context, skill, profileId, effect);
  }
}

function spendDaredevilTraitResources(context: ThiefCastContext, skill: ThiefSkill): void {
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0 && skill.weapon === 'Staff' && hasTrait(context.config, TRAIT.STAFF_MASTER)) {
    // Staff Master refunds 2 endurance per initiative spent, not per cast
    gainThiefEndurance(
      context,
      cost * Number(balanceProfileFromContext(context, PROFILE.staffMaster)?.resourceGain ?? 2),
      context.start,
      'staff-master'
    );
  }

  if (BRAWLERS_TENACITY_PHYSICAL_SKILLS.has(skill.id) && hasTrait(context.config, TRAIT.BRAWLERS_TENACITY)) {
    gainThiefEndurance(
      context,
      Number(balanceProfileFromContext(context, PROFILE.brawlersTenacity)?.resourceGain ?? 15),
      context.start,
      'brawlers-tenacity'
    );
  }
}

function skillAttacks(skill: ThiefSkill): boolean {
  // Dodge itself is excluded so the Weakening Strikes proc from the dodge doesn't immediately consume itself
  return (
    skill.id !== ID.DODGE &&
    (skill.effects || []).some((effect) => effect.type === 'strike' || effect.type === 'condition')
  );
}

function applyWeakeningStrike(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = daredevilState.from(context);
  if (!state.weakeningStrikeReady || !skillAttacks(skill)) return;
  state.weakeningStrikeReady = false;
  const weakness = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.weakeningStrikes), 'condition');
  emitSkillCondition(context, {
    at: context.start,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(weakness?.condition || 'Weakness'),
    duration: Number(weakness?.duration ?? 3),
    stacks: Number(weakness?.stacks ?? 1),
    sourceId: TRAIT.WEAKENING_STRIKES,
    name: 'Weakening Strikes — Weakness'
  });
  emitThiefStateSnapshot(context, context.start, 'weakening-strikes');
}

export function beginDaredevilTraits(context: ThiefCastContext, skill: ThiefSkill): void {
  spendDaredevilTraitResources(context, skill);
  applyWeakeningStrike(context, skill);
}

/** Grants Daredevil's selected on-steal endurance at completion, before the final Core snapshot. */
export function applyEnduranceThief(context: ThiefCastContext): void {
  if (!hasTrait(context.config, TRAIT.ENDURANCE_THIEF)) return;
  gainThiefEndurance(
    context,
    Number(balanceProfileFromContext(context, PROFILE.enduranceThief)?.resourceGain ?? 50),
    context.effectiveEnd,
    'endurance-thief'
  );
}
