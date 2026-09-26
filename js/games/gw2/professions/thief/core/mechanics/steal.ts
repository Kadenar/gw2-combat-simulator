import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import {
  emitThiefBuff,
  emitThiefCondition,
  emitThiefControl,
  emitThiefDamage
} from '#gw2/professions/thief/core/events.js';
import { grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

// Each base Steal offers the same three supported stolen skills for the user to choose from.
export const THIEF_STOLEN_SKILL_IDS: readonly SkillId[] = Object.freeze([
  ID.DETONATE_PLASMA,
  ID.THROW_MAGNETIC_BOMB,
  ID.SOUL_STONE_VENOM
]);

/** The stolen skills currently selectable: the whole pool, or the one skill locked by a forced grant or reuse. */
export function storedStolenSkillChoices(
  state: Pick<ThiefCoreState, 'storedStolenSkillId' | 'storedStolenSkillIds' | 'storedStolenSkillCount'>
): readonly SkillId[] {
  if (Number(state.storedStolenSkillCount || 0) <= 0) return [];
  return state.storedStolenSkillId == null ? state.storedStolenSkillIds || [] : [state.storedStolenSkillId];
}

/** A steal grants a choice pool; Improvisation allows a second use of the selected skill. */
export function storeThiefStolenSkillChoices(
  runtime: ThiefRuntime,
  skillIds: readonly SkillId[],
  forcedSkillId: SkillId | null = null
): void {
  const core = runtime.profession.core;
  const choices = [...new Set(skillIds.map(Number).filter(Number.isFinite))];
  core.storedStolenSkillIds = choices;
  core.storedStolenSkillId = forcedSkillId;
  core.storedStolenSkillCount =
    choices.length === 0
      ? 0
      : hasTrait(runtime, TRAIT.IMPROVISATION)
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.improvisation), 'maximumStacks')
        : 1;
}

/** Stores the steal's choices and grants Core's on-steal initiative; specializations add theirs afterwards. */
export function completeThiefSteal(
  runtime: ThiefRuntime,
  skillIds: readonly SkillId[],
  forcedSkillId: SkillId | null = null
): void {
  storeThiefStolenSkillChoices(runtime, skillIds, forcedSkillId);
  if (hasTrait(runtime, TRAIT.KLEPTOMANIAC))
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.kleptomaniac), 'resourceGain')
    );
}

/** Using a stored skill spends one use; a remaining Improvisation use stays locked to the same skill. */
export function consumeThiefStolenSkill(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  core.storedStolenSkillCount = Math.max(0, Number(core.storedStolenSkillCount || 0) - 1);
  core.storedStolenSkillId = core.storedStolenSkillCount > 0 ? skill.id : null;
  core.storedStolenSkillIds = core.storedStolenSkillCount > 0 ? [skill.id] : [];
}

function stealSkill(cast: RuntimeCast): ThiefSkill {
  return cast.skill as ThiefSkill;
}

/** Serpent's Touch Poison is attributed to its trait while retaining the triggering steal. */
function serpentsTouch(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.SERPENTS_TOUCH)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.serpentsTouch);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  if (!poison) return;
  emitThiefCondition(runtime, null, {
    at: runtime.time,
    source: 'Trait',
    skillId: TRAIT.SERPENTS_TOUCH,
    skillName: "Serpent's Touch",
    triggeredBy: cast.skill.name,
    activationId: cast.id,
    name: "Serpent's Touch — Poison",
    condition: String(poison.condition),
    duration: effectNumber(profile, poison, 'duration'),
    stacks: hasTrait(runtime, TRAIT.POTENT_POISON)
      ? balanceProfileNumber(profile, 'playerStacks')
      : effectNumber(profile, poison, 'stacks')
  });
}

/** Mug is an uncritical strike owned by the steal skill. */
function mug(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.MUG)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.mug);
  const strike = requireEffect(profile, 'strike', 'Mug');
  if (!strike) return;
  emitThiefDamage(runtime, null, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.MUG,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name: 'Mug',
    coefficient: effectNumber(profile, strike, 'coefficient'),
    hits: effectNumber(profile, strike, 'hits'),
    canCrit: false
  });
}

function evenTheOdds(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.EVEN_THE_ODDS)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.evenTheOdds);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  emitThiefCondition(runtime, stealSkill(cast), {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.EVEN_THE_ODDS,
    activationId: cast.id,
    name: 'Even the Odds — Vulnerability',
    condition: String(vulnerability.condition),
    duration: effectNumber(profile, vulnerability, 'duration'),
    stacks: effectNumber(profile, vulnerability, 'stacks')
  });
}

function deadlyAmbush(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.DEADLY_AMBUSH)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.deadlyAmbush);
  const bleeding = requireEffect(profile, 'condition', 'Bleeding');
  if (!bleeding) return;
  emitThiefCondition(runtime, null, {
    at: runtime.time,
    source: 'Trait',
    skillId: TRAIT.DEADLY_AMBUSH,
    skillName: 'Deadly Ambush',
    triggeredBy: cast.skill.name,
    activationId: cast.id,
    name: 'Deadly Ambush — Bleeding',
    condition: String(bleeding.condition),
    duration: effectNumber(profile, bleeding, 'duration'),
    stacks: effectNumber(profile, bleeding, 'stacks')
  });
}

/** Emits a steal-owned boon attributed to its trait source, scaled by boon duration when it applies. */
function stealBoon(runtime: ThiefRuntime, cast: RuntimeCast, boon: string, duration: number, stacks: number): void {
  emitThiefBuff(runtime, stealSkill(cast), {
    at: runtime.time,
    source: 'Trait',
    sourceId: `thief.steal.${boon}`,
    activationId: cast.id,
    name: `Steal — ${boon}`,
    kind: boon,
    boon,
    duration,
    stacks
  });
}

function thrillOfTheCrime(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.THRILL_OF_THE_CRIME)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.thrillOfTheCrime);
  for (const effect of (profile.effects || []).filter((entry) => entry.type === 'boon'))
    stealBoon(
      runtime,
      cast,
      String(effect.boon),
      effectNumber(profile, effect, 'duration'),
      effectNumber(profile, effect, 'stacks')
    );
}

/** The boonless target grants both independent packets; removing either leaves its sibling intact. */
function bountifulTheft(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.BOUNTIFUL_THEFT)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.bountifulTheft);
  for (const name of ['Vigor', 'Might']) {
    const effect = requireEffect(profile, 'boon', name);
    if (effect)
      stealBoon(
        runtime,
        cast,
        String(effect.boon),
        effectNumber(profile, effect, 'duration'),
        effectNumber(profile, effect, 'stacks')
      );
  }
}

function sleightOfHand(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.SLEIGHT_OF_HAND)) return;
  const control = requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.sleightOfHand), 'control', 'daze');
  if (!control) return;
  emitThiefControl(runtime, stealSkill(cast), {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.SLEIGHT_OF_HAND,
    activationId: cast.id,
    name: 'Sleight of Hand - Daze',
    controlKind: String(control.kind)
  });
}

/** Hidden Thief claims its cooldown before either condition so a removed packet cannot re-arm it. */
function hiddenThief(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.HIDDEN_THIEF)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.hiddenThief);
  const blindness = requireEffect(profile, 'condition', 'Blindness');
  const weakness = requireEffect(profile, 'condition', 'Weakness');
  if (
    !tryConsumeProcCooldown(
      runtime.profession.core.traitProcReadyAt,
      TRAIT.HIDDEN_THIEF,
      runtime.time,
      balanceProfileNumber(profile, 'internalCooldown')
    )
  )
    return;
  for (const [condition, effect] of [
    ['Blindness', blindness],
    ['Weakness', weakness]
  ] as const)
    if (effect)
      emitThiefCondition(runtime, stealSkill(cast), {
        at: runtime.time,
        source: 'Trait',
        sourceId: TRAIT.HIDDEN_THIEF,
        activationId: cast.id,
        name: `Hidden Thief - ${condition}`,
        condition,
        duration: effectNumber(profile, effect, 'duration'),
        stacks: effectNumber(profile, effect, 'stacks')
      });
}

/** Selected on-steal traits apply in the cross-line order shared by every steal variant. */
export function emitThiefStealTraits(runtime: ThiefRuntime, cast: RuntimeCast): void {
  serpentsTouch(runtime, cast);
  mug(runtime, cast);
  evenTheOdds(runtime, cast);
  deadlyAmbush(runtime, cast);
  thrillOfTheCrime(runtime, cast);
  bountifulTheft(runtime, cast);
  sleightOfHand(runtime, cast);
  hiddenThief(runtime, cast);
}
