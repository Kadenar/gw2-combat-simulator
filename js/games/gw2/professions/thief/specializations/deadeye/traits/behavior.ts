import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { boonActive, countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/mechanics/stolen-skills.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applyBeQuickOrBeKilledAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  if (hasTrait(context, TRAIT.BE_QUICK_OR_BE_KILLED) && boonActive(context, 'quickness')) {
    const beQuickOrBeKilledProfile = requireBalanceProfileFromContext(context, TRAIT.BE_QUICK_OR_BE_KILLED);
    const bonus = balanceProfileNumber(beQuickOrBeKilledProfile, 'attributeBonus');
    result.power += bonus;
    result.precision += bonus;
  }
}

/** Applies Be Quick or Be Killed at its established mechanical boundary. */
export function grantBeQuickOrBeKilled(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (hasTrait(runtime, TRAIT.BE_QUICK_OR_BE_KILLED))
    traitBoons(runtime, cast, 'Be Quick or Be Killed', TRAIT.BE_QUICK_OR_BE_KILLED, false, 'Quickness');
}

/** Builds a Deadeye trait boon package attributed to its trait source and triggering skill. */
export function traitBoons(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill> | null,
  source: string,
  profileId: SkillId,
  party: boolean,
  only?: string
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  // Materialize the selected boons at this owner's deferred boundary, retaining its audience and attribution.
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.filter((effect) => effect.type === 'boon' && (only == null || effect.name === only)),
    attribution: {
      source: 'Trait',
      sourceId: `thief.deadeye.${source.toLowerCase().replaceAll(' ', '-')}`,
      actorType: 'player',
      ...(cast ? { skillId: cast.skill.id, skillName: cast.skill.name, activationId: cast.id } : {})
    },
    transform: (event, effect) => ({
      ...event,
      actorType: 'player',
      name: `${source} \u2014 ${effect.boon}`,
      boon: String(effect.boon),
      audience: party ? { recipients: 'party', maximumRecipients: 5 } : undefined
    })
  });
}

/** Fire for Effect replaces Deadeye's stolen-skill choice pool with Steal Time. */
export function stolenSkillGrant(runtime: ThiefRuntime): {
  skillIds: readonly SkillId[];
  forcedSkillId: SkillId | null;
} {
  return hasTrait(runtime, TRAIT.FIRE_FOR_EFFECT)
    ? { skillIds: [ID.STEAL_TIME], forcedSkillId: ID.STEAL_TIME }
    : { skillIds: DEADEYE_STOLEN_SKILL_IDS, forcedSkillId: null };
}

/** Applies Fire for Effect at its established mechanical boundary. */
export function grantFireForEffect(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;
  if (STOLEN_SKILLS.has(skill.id) && hasTrait(runtime, TRAIT.FIRE_FOR_EFFECT))
    traitBoons(runtime, cast, 'Fire for Effect', TRAIT.FIRE_FOR_EFFECT, true);
}

export const STOLEN_SKILLS = new Set<SkillId>(DEADEYE_STOLEN_SKILL_IDS);

/** Reaching maximum malice grants Maleficent Seven's initiative and boons once per malice cycle. */
export function applyMaleficentSeven(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill> | null): void {
  const state = deadeyeState.from(runtime);
  if (
    state.malice.value !== state.malice.maximum ||
    state.maleficentSevenTriggered ||
    !hasTrait(runtime, TRAIT.MALEFICENT_SEVEN)
  )
    return;
  state.maleficentSevenTriggered = true;
  grantThiefInitiative(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MALEFICENT_SEVEN), 'resourceGain')
  );
  traitBoons(runtime, cast, 'Maleficent Seven', TRAIT.MALEFICENT_SEVEN, false);
}

/** The replacement cap is resolved from the active patch during initialization. */
export function maximumDeadeyeMalice(runtime: ThiefRuntime): number {
  return balanceProfileNumber(
    requireBalanceProfileFromContext(
      runtime,
      hasTrait(runtime, TRAIT.MALEFICENT_SEVEN) ? TRAIT.MALEFICENT_SEVEN : PROFILE.resources
    ),
    'maximumStacks'
  );
}

/** Malicious Intent seeds a fresh mark (and each spent cycle) with its starting malice. */
export function initialMalice(runtime: ThiefRuntime): number {
  return hasTrait(runtime, TRAIT.MALICIOUS_INTENT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_INTENT), 'resourceGain')
    : 0;
}

/** Applies Malicious Intent at its established mechanical boundary. */
export function restoreMaliciousIntent(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.MALICIOUS_INTENT)) {
    runtime.resourceController.grant(
      'malice',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_INTENT), 'resourceGain')
    );
    applyMaleficentSeven(runtime, null);
  }
}

/** Applies One In The Chamber at its established mechanical boundary. */
export function grantOneInTheChamber(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.ONE_IN_THE_CHAMBER)) {
    const grant = stolenSkillGrant(runtime);
    storeThiefStolenSkillChoices(runtime, grant.skillIds, grant.forcedSkillId);
  }
}

export function activeBoonCount(context: Gw2ModifierContext): number {
  return countActiveBoons(context);
}

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applyPremeditationAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  if (hasTrait(context, TRAIT.PREMEDITATION)) {
    const premeditationProfile = requireBalanceProfileFromContext(context, TRAIT.PREMEDITATION);
    result.concentration += balanceProfileNumber(premeditationProfile, 'attributeBonus');
  }
}

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applySilentScopeAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  if (hasTrait(context, TRAIT.SILENT_SCOPE)) {
    const silentScopeProfile = requireBalanceProfileFromContext(context, TRAIT.SILENT_SCOPE);
    result.precision += balanceProfileNumber(silentScopeProfile, 'attributeBonus');
  }
}

/** Applies Silent Scope at its established mechanical boundary. */
export function grantSilentScope(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;
  const state = deadeyeState.from(runtime);
  if (skill.id === SHARED_SKILL_IDS.DODGE && hasTrait(runtime, TRAIT.SILENT_SCOPE)) {
    const silentScope = requireBalanceProfileFromContext(runtime, TRAIT.SILENT_SCOPE);
    if (state.malice.value > balanceProfileNumber(silentScope, 'threshold')) {
      state.stealthAttackCharges = 1;
      state.stealthAttackExpiresAt = runtime.time + balanceProfileNumber(silentScope, 'durationMultiplier');
    }
  }
}
