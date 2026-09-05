import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import type { SkillId, StrikeTick } from '#gw2/platform/engine/skills/types.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefEndurance } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import type { ThiefCastContext, ThiefDodge, ThiefSkill } from '#gw2/professions/thief/types.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';

import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';

interface DaredevilDodgeEffectBase {
  sourceId: SkillId;
  stacks?: number;
  duration?: number;
  atMs?: number;
}

type DaredevilDodgeEffect = Readonly<
  | (DaredevilDodgeEffectBase & {
      type: 'strike';
      coefficient?: number;
      hits?: 1;
      ticks?: readonly StrikeTick[];
    })
  | (DaredevilDodgeEffectBase & {
      type: 'condition';
      condition: string;
    })
  | (DaredevilDodgeEffectBase & {
      type: 'boon';
      boon: string;
    })
>;

const DAREDEVIL_DODGE_EFFECTS: Readonly<Partial<Record<ThiefDodge, readonly DaredevilDodgeEffect[]>>> = Object.freeze({
  'Bounding Dodger': Object.freeze([
    Object.freeze({
      type: 'strike',
      sourceId: TRAIT.BOUNDING_DODGER,
      coefficient: 3.5,
      hits: 1
    })
  ]),
  'Lotus Training': Object.freeze([
    Object.freeze({
      type: 'strike',
      sourceId: TRAIT.LOTUS_TRAINING,
      ticks: [
        { atMs: 200, coefficient: 0.1875 },
        { atMs: 360, coefficient: 0.1875 },
        { atMs: 520, coefficient: 0.1875 }
      ]
    }),
    Object.freeze({
      type: 'condition',
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: 'Bleeding',
      stacks: 2,
      duration: 4,
      atMs: 200
    }),
    Object.freeze({
      type: 'condition',
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: 'Torment',
      stacks: 2,
      duration: 4,
      atMs: 360
    }),
    Object.freeze({
      type: 'condition',
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: 'Crippled',
      stacks: 1,
      duration: 3,
      atMs: 520
    })
  ]),
  'Unhindered Combatant': Object.freeze([
    Object.freeze({
      type: 'boon',
      sourceId: TRAIT.UNHINDERED_COMBATANT,
      boon: 'Swiftness',
      stacks: 1,
      duration: 8
    })
  ])
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

function emitDodgeEffect(context: ThiefCastContext, skill: ThiefSkill, effect: DaredevilDodgeEffect): void {
  const state = daredevilState.from(context);
  const profile = balanceProfileFromContext(context, effect.sourceId);
  const authoredEffect =
    effect.type === 'condition'
      ? profile?.effects?.find((entry) => entry.type === 'condition' && entry.condition === effect.condition)
      : balanceProfileEffect(profile, effect.type);
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
    sourceId: effect.sourceId,
    actorType: 'player',
    skillId: skill.id,
    skillName: dodgeSkillName,
    name: dodgeSkillName
  } as const;
  if (effect.type === 'strike') {
    const authoredStrike = balanceProfileEffect(profile, 'strike');
    const ticks = authoredStrike?.ticks?.length ? authoredStrike.ticks : effect.ticks;
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
        coefficient: Number(authoredStrike?.coefficient ?? effect.coefficient ?? 0),
        hits: 1,
        skillWeapon: 'Unequipped'
      });
    }
  } else if (effect.type === 'condition') {
    emitSkillCondition(context, {
      ...common,

      name: `${dodgeSkillName} — ${effect.condition}`,
      condition: effect.condition,
      stacks: Number(authoredEffect?.stacks ?? effect.stacks ?? 1),
      duration: Number(authoredEffect?.duration ?? effect.duration ?? 0)
    });
  } else {
    // Dodge boons use the canonical scheduled buff event consumed by the resolver.
    emitSkillBuff(context, skill, {
      ...common,
      name: `${dodgeSkillName} — ${effect.boon}`,
      boon: effect.boon,
      kind: effect.boon.toLowerCase(),
      stacks: Number(authoredEffect?.stacks ?? effect.stacks ?? 1),
      duration: Number(authoredEffect?.duration ?? effect.duration ?? 0)
    });
  }
}

export function applyDaredevilDodge(context: ThiefCastContext, skill: ThiefSkill): void {
  if (skill.id !== ID.DODGE) return;
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
  for (const effect of DAREDEVIL_DODGE_EFFECTS[state.selectedDodge] || []) {
    emitDodgeEffect(context, skill, effect);
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
