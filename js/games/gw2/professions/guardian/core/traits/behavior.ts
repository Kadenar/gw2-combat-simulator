import { durationStackingBoonCapSeconds, remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import type { GuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { SPECIALIZATIONS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';
import {
  GUARDIAN_TRAIT_IDS,
  GUARDIAN_SKILL_IDS as ID,
  GUARDIAN_TRAIT_IDS as TRAIT
} from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export type Runtime = Gw2Runtime<GuardianRuntimeState, GuardianSkill>;

/** Fields are selected before registration, so extensions never rewrite an already executed action. */
export function writOfPersistenceFields(
  runtime: Runtime,
  cast: RuntimeCast<GuardianSkill>,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (isGuardianSymbolSkill(cast.skill) && hasTrait(runtime, TRAIT.WRIT_OF_PERSISTENCE)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.WRIT_OF_PERSISTENCE);
    const window = requireEffect(profile, 'buff', 'symbol-duration-extension');
    if (window)
      fields = fields?.map((field, index) =>
        index === 0 ? { ...field, duration: Number(field.duration) + effectNumber(profile, window, 'duration') } : field
      );
  }

  return fields;
}

/** Select authored trait extensions once and leave cancellation, impact delay, and boon sampling to the common runtime. */
export function writOfPersistenceEffects(
  runtime: Runtime,
  cast: RuntimeCast<GuardianSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const extra: SkillEffect[] = [];
  const skill = cast.skill;
  const field = skill.comboFields?.[0];
  if (field && isGuardianSymbolSkill(skill) && hasTrait(runtime, TRAIT.WRIT_OF_PERSISTENCE)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.WRIT_OF_PERSISTENCE);
    if (skill.id === ID.SYMBOL_OF_PUNISHMENT) {
      for (const effect of profile.effects ?? []) {
        if (effect.type === 'strike') extra.push({ ...effect, name: skill.name, weapon: 'Scepter' });
        else if (effect.type === 'boon') extra.push({ ...effect, audience: { recipients: 'party' } });
      }
    } else {
      const window = requireEffect(profile, 'buff', 'symbol-duration-extension');
      const extension = window ? effectNumber(profile, window, 'duration') : 0;
      const pulse = effects.filter((effect) => effect.type === 'strike' && strikeEffectTicks(effect).length > 1).at(-1);
      if (pulse?.type === 'strike' && extension > 0) {
        const ticks = strikeEffectTicks(pulse);
        const last = ticks.at(-1)!;
        const fieldEnd =
          (field.startAnchor === 'castEnd' ? cast.fullEnd : cast.start) +
          Number(field.startMs ?? 0) / 1000 +
          Number(field.duration);
        const lastAt =
          ticks.length >= 5
            ? fieldEnd
            : (pulse.timingAnchor === 'castStart' ? cast.start : cast.fullEnd) + last.atMs / 1000;
        extra.push({
          type: 'strike',
          name: pulse.name ?? skill.name,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          persistsAfterInterrupt: pulse.persistsAfterInterrupt,
          ticks: Array.from({ length: Math.floor(extension) }, (_, index) => ({
            atMs: (lastAt - cast.start + index + 1) * 1000,
            coefficient: last.coefficient
          }))
        });
      }
    }
  }

  const selected = [...effects, ...extra];
  // A symbol's self boon belongs to each pulse even when its hostile packet misses the target.
  if (skill.id === ID.SYMBOL_OF_RESOLUTION || skill.id === ID.LUMINOUS_STAFF || skill.id === ID.SYMBOL_OF_FAITH)
    for (const effect of extra) {
      if (effect.type !== 'strike') continue;
      for (const tick of strikeEffectTicks(effect))
        selected.push({
          type: 'boon',
          boon: skill.id === ID.SYMBOL_OF_FAITH ? 'regeneration' : 'resolution',
          duration: 1,
          stacks: 1,
          atMs: tick.atMs,
          timingAnchor: effect.timingAnchor,
          timingScale: effect.timingScale,
          persistsAfterInterrupt: effect.persistsAfterInterrupt
        });
    }

  return selected;
}

/** A committed heal claims Protection's interval only when its selected symbol can emit. */
export function completeProtectorsRestoration(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  if (cast.skill.type !== 'Heal') return;
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };

  if (
    hasTrait(runtime, TRAIT.PROTECTORS_RESTORATION) &&
    isInternalCooldownReady(runtime.time, runtime.procs.deadline('guardian.core.protectorsRestoration'))
  ) {
    if (
      emitTraitSymbol(runtime, TRAIT.PROTECTORS_RESTORATION, ID.LESSER_SYMBOL_OF_PROTECTION, cause, {
        party: true,
        fieldDuration: (effect) => (effect.type === 'strike' ? (effect.ticks?.at(-1)?.atMs ?? 0) / 1000 : 0)
      })
    )
      runtime.procs.readyAt['guardian.core.protectorsRestoration'] = canonicalTime(
        runtime.time +
          balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, TRAIT.PROTECTORS_RESTORATION),
            'internalCooldown'
          )
      );
  }
}

// Apply Guardian's Burning-specific skill and trait multipliers before general
// condition-duration scaling.
export function modifyGuardianConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  if (context.condition !== 'Burning') return duration;
  let result = duration;
  if (
    (context.sourceId === ID.ZEALOTS_FLAME || context.event?.skillId === ID.ZEALOTS_FLAME) &&
    hasTrait(context, TRAIT.RADIANT_FIRE)
  ) {
    const radiantFireProfile = requireBalanceProfileFromContext(context, TRAIT.RADIANT_FIRE);
    result *= balanceProfileNumber(radiantFireProfile, 'durationMultiplier');
  }

  if (
    (context.sourceId === 'guardian.justice-passive' || context.event?.sourceId === 'guardian.justice-passive') &&
    hasTrait(context, TRAIT.AMPLIFIED_WRATH)
  ) {
    const amplifiedWrathProfile = requireBalanceProfileFromContext(context, TRAIT.AMPLIFIED_WRATH);
    result *= balanceProfileNumber(amplifiedWrathProfile, 'durationMultiplier');
  }

  return result;
}

/** A committed heal claims Resolution's interval only when its selected boon can emit. */
export function completeHealersResolution(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  if (cast.skill.type !== 'Heal') return;
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };

  if (hasTrait(runtime, TRAIT.HEALERS_RESOLUTION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.HEALERS_RESOLUTION);
    const effect = requireEffect(profile, 'boon', 'resolution');
    // Only a surviving Resolution packet consumes this trait's interval.
    if (effect && runtime.procs.claim(TRAIT.HEALERS_RESOLUTION, 'guardian.core.healersResolution', runtime.time)) {
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...cause,
          type: 'buff',
          sourceId: TRAIT.HEALERS_RESOLUTION,
          name: profile.name,
          kind: 'resolution',
          stacks: effectNumber(profile, effect, 'stacks'),
          duration: effectNumber(profile, effect, 'duration')
        }
      });
    }
  }
}

export const MIGHT = 'guardian.righteous-might';

export const RESOLUTION_EXPIRY = 'guardian.resolution-expiry';

/** Resolution readiness follows the accepted self-boon pool, including its cap and extension records. */
export function resolutionDeadline(runtime: Runtime): number {
  const remaining = remainingDurationStackSeconds(runtime.boons.get('resolution') ?? [], runtime.time, {
    includes: (application) => application.resolvedAudience.includesSelf,
    maximum: durationStackingBoonCapSeconds('resolution'),
    ordered: true
  });
  return remaining > 0 ? canonicalTime(runtime.time + remaining) : 0;
}

export function righteousMight(runtime: Runtime, event: Gw2ResolverEvent): boolean {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.RIGHTEOUS_INSTINCTS);
  const effect = requireEffect(profile, 'boon', 'might');
  if (!effect) return false;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.RIGHTEOUS_INSTINCTS,
      actorType: 'player',
      skillId: TRAIT.RIGHTEOUS_INSTINCTS,
      skillName: profile.name,
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      kind: 'might',
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks')
    }
  });
  {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: profile.name,
        at: runtime.time,
        sourceSkill: 'Resolution',
        detail: 'Resolution active',
        icon: guardianTraitIcon(TRAIT.RIGHTEOUS_INSTINCTS)
      }
    });
  }

  return true;
}

/** A new self Resolution window starts one cadence; additional applications extend its pool without duplicating ticks. */
export function reactToRighteousInstinctsBuff(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (
    event.kind !== 'resolution' ||
    event.resolvedAudience?.includesSelf !== true ||
    !hasTrait(runtime, TRAIT.RIGHTEOUS_INSTINCTS)
  )
    return;
  const state = runtime.profession.core;
  const active = state.resolutionUntil > runtime.time;
  state.resolutionUntil = resolutionDeadline(runtime);
  if (!(state.resolutionUntil > runtime.time)) return;
  runtime.schedule(RESOLUTION_EXPIRY, state.resolutionUntil, state.resolutionUntil, undefined, -220);
  if (active) return;
  state.righteousInstinctsGeneration++;
  if (!righteousMight(runtime, event)) return;
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.RIGHTEOUS_INSTINCTS),
    'pulseInterval'
  );
  if (interval > 0)
    runtime.schedule(
      MIGHT,
      canonicalTime(runtime.time + interval),
      { generation: state.righteousInstinctsGeneration, event },
      undefined,
      -10
    );
}

/** Signet passives keep their ordinary cooldown rule unless Perfect Inscriptions retains them. */
export function guardianSignetPassiveActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS) || !context.timeline?.skillOnCooldownAt(skillId, context.time);
}

/** Build and live signet grants read the same selected multiplier, including disabled-trait previews. */
export function perfectInscriptionsMultiplier(context: unknown): number {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PERFECT_INSCRIPTIONS), 'attributeMultiplier')
    : 1;
}

/** Torch recharge keeps the common compiler's live lookup and numeric validation. */
export const radiantFireRecharge = compileRechargeRules<GuardianRuntimeState>([
  {
    trait: TRAIT.RADIANT_FIRE,
    when: (_runtime, skill) => skill.weapon === 'Torch',
    multiplier: { profile: TRAIT.RADIANT_FIRE, field: 'rechargeMultiplier' }
  }
]);

/** Select the same duration multiplier for the torch flip window and its Burning packets. */
export function radiantFireDurationMultiplier(context: unknown): number {
  return hasTrait(context, TRAIT.RADIANT_FIRE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RADIANT_FIRE), 'durationMultiplier')
    : 1;
}

/** Selected Radiant Fire raises Zealot's Flame capacity without reducing a larger authored capacity. */
export function radiantFireMaximumAmmo(runtime: Runtime, skill: Skill, maximum: number): number {
  return skill.id === ID.ZEALOTS_FLAME && hasTrait(runtime, TRAIT.RADIANT_FIRE)
    ? Math.max(
        maximum,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.RADIANT_FIRE), 'maximumStacks')
      )
    : maximum;
}

/** Luminary checks this Core trait at its existing aura-grant boundary. */
export function justiceIsBlindEligible(runtime: Runtime, skill: Skill): boolean {
  return Boolean(
    skill.categories?.includes('Virtue') && skill.slot === 'Profession_1' && hasTrait(runtime, TRAIT.JUSTICE_IS_BLIND)
  );
}

/** Emit the surviving Blind packet after Luminary schedules its independent aura grant. */
export function emitJusticeIsBlind(runtime: Runtime, event: Gw2ResolverEvent, skill: Skill): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.JUSTICE_IS_BLIND);
  const blind = requireEffect(profile, 'blind', 'Blind');
  if (blind)
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...event,
        type: 'blind',
        sourceId: TRAIT.JUSTICE_IS_BLIND,
        skillId: TRAIT.JUSTICE_IS_BLIND,
        actorType: 'effect',
        skillName: 'Justice is Blind',
        triggeredBy: skill.name,
        duration: effectNumber(profile, blind, 'duration')
      }
    });
}

/** Focus recharge retains the selected live multiplier before the final virtue adjustment. */
export const focusMasteryRecharge = compileRechargeRules<GuardianRuntimeState>([
  {
    trait: TRAIT.FOCUS_MASTERY,
    when: (_runtime, skill) => skill.weapon === 'Focus',
    multiplier: { profile: TRAIT.FOCUS_MASTERY, field: 'rechargeMultiplier' }
  }
]);

/** Committed activation boons sample live attributes and retain their selected component and party ownership. */
function virtueBuff(
  runtime: Runtime,
  cast: RuntimeCast<GuardianSkill>,
  trait: number,
  kind: string,
  party = false
): void {
  if (!hasTrait(runtime, trait)) return;
  const profile = requireBalanceProfileFromContext(runtime, trait);
  const type = kind === 'guardian-inspiring-virtue' ? 'buff' : 'boon';
  const effect = requireEffect(profile, type, kind);
  if (!effect) return;
  const duration = effectNumber(profile, effect, 'duration');
  const event = {
    type: 'buff' as const,
    at: runtime.time,
    source: 'Trait',
    sourceId: trait,
    actorType: 'player' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    name: profile.name,
    kind,
    stacks: effectNumber(profile, effect, 'stacks'),
    duration,
    audience: { recipients: party ? ('party' as const) : ('self' as const) }
  };
  runtime.effects.emit({ kind: 'packet', event: event });
}

/** Both emission paths read one trait multiplier without applying ordinary boon-duration scaling twice. */
export function guardianResolutionMultiplier(runtime: Runtime): number {
  return hasTrait(runtime, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION),
        'durationMultiplier'
      )
    : 1;
}

/** Selected consecrations extend the live skill packets before effect materialization. */
export const masterOfConsecrationsEffects: NonNullable<Skill['effectVariants']>[number] = {
  when: (runtime) => hasTrait(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS),
  profileId: GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS,
  transform: (_runtime, cast, effects) => [
    ...(cast.skill.effects ?? []),
    ...effects
      .filter((effect) => effect.type === 'strike' || effect.type === 'condition')
      .map((effect) => {
        if (!effect.ticks?.length) throw new Error('Master of Consecrations requires explicit packet timelines.');
        return {
          ...effect,
          name: effect.type === 'strike' ? cast.skill.name : `${cast.skill.name} \u2014 Burning`,
          weapon: 'Unequipped'
        };
      })
  ]
};

/** Extend Purging Flames before Writ's separate symbol-field adjustment. */
export function masterOfConsecrationsFields(
  runtime: Runtime,
  cast: RuntimeCast<GuardianSkill>,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (cast.skill.id !== ID.PURGING_FLAMES || !hasTrait(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS))
    return fields;
  const multiplier = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS),
    'durationMultiplier'
  );
  return fields?.map((field) => ({ ...field, duration: Number(field.duration) * multiplier }));
}

/** Core and Willbender count accepted hits against their own base threshold unless Justice is traited. */
export function permeatingWrathThreshold(
  context: GuardianResolverContext,
  virtue: GuardianVirtue,
  baseProfile: string
): number {
  return balanceProfileNumber(
    requireBalanceProfileFromContext(
      context,
      virtue === 'justice' && hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
        ? GUARDIAN_TRAIT_IDS.PERMEATING_WRATH
        : baseProfile
    ),
    'threshold'
  );
}

/** Dragonhunter keeps pulse scheduling and passive readiness while this owner selects its interval. */
export function indomitableCourageInterval(runtime: Runtime, baseProfile: BalanceProfile): number {
  return balanceProfileNumber(
    hasTrait(runtime, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)
      ? requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)
      : baseProfile,
    'pulseInterval'
  );
}

/** Ordinary virtue recharge and Firebrand dormancy share the current trait multiplier. */
export function powerOfTheVirtuousRechargeMultiplier(runtime: Runtime): number {
  return hasTrait(runtime, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS),
        'rechargeMultiplier'
      )
    : 1;
}

/** Keep this adjustment at the shared recharge boundary used by casts and Luminary's manual recharge. */
export const powerOfTheVirtuousRecharge = compileRechargeRules<GuardianRuntimeState>([
  {
    trait: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS,
    when: (_runtime, skill) =>
      Boolean(skill.categories?.includes('Virtue')) && /^Profession_[1-3]$/.test(String(skill.slot || '')),
    multiplier: { profile: GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS, field: 'rechargeMultiplier' }
  }
]);

/** Resolve hammer replacement before the Core weapon-flip availability checks. */
export function glacialHeartAvailability(runtime: Runtime, skill: Skill) {
  const glacial = hasTrait(runtime, GUARDIAN_TRAIT_IDS.GLACIAL_HEART);
  if (skill.id === ID.MIGHTY_BLOW && glacial)
    return denySkillCast(
      skill,
      'guardian.trait-replacement',
      'Glacial Blow replaces it while Glacial Heart is selected.'
    );
  if (skill.id === ID.GLACIAL_BLOW && !glacial)
    return denySkillCast(skill, 'guardian.trait-replacement', 'requires the Glacial Heart trait.');
  return null;
}

/** Battle Presence shares Phoenix Protocol's boons without adding other simulated healing behavior. */
export function battlePresenceSharesBoons(context: unknown): boolean {
  return hasTrait(context, GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE);
}

/** Ready Justice activations claim symbol recharge at the permanent Alacrity rate. */
export function triggerGuardianFuriousFocus(
  runtime: Runtime,
  cast: { id: string; skill: Pick<RuntimeCast<GuardianSkill>['skill'], 'id' | 'name'> }
): void {
  if (!hasTrait(runtime, TRAIT.FURIOUS_FOCUS)) return;
  const state = runtime.profession.core;
  const symbol = symbols[ID.LESSER_SYMBOL_OF_BLADES];
  if (state.furiousFocusRecharge)
    state.furiousFocusReadyAt = runtime.cooldownController.project(symbol, state.furiousFocusRecharge);
  if (!isInternalCooldownReady(runtime.time, state.furiousFocusReadyAt)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS_FOCUS);
  if (!requireEffect(profile, 'strike', 'Strike')) return;
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };
  if (!emitTraitSymbol(runtime, TRAIT.FURIOUS_FOCUS, ID.LESSER_SYMBOL_OF_BLADES, cause, { fieldDuration: () => 4 }))
    return;
  state.furiousFocusRecharge = { startedAt: runtime.time, work: balanceProfileNumber(profile, 'cooldown') };
  state.furiousFocusReadyAt = runtime.cooldownController.project(symbol, state.furiousFocusRecharge);
}

/** Only accepted positive player impacts grant symbol traits; the threshold-crossing hit cannot trigger its own reward. */
export function reactToZealDamage(runtime: Runtime, event: Gw2ResolverEvent, damage: number): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !(damage > 0)) return;
  const state = runtime.profession.core;
  const skill = event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId);
  if (event.isSymbol || isGuardianSymbolSkill(skill, event.skillName)) {
    if (hasTrait(runtime, TRAIT.SYMBOLIC_AVENGER)) {
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.SYMBOLIC_AVENGER);
      state.symbolicAvengerExpirations = grantTimedStacks(state.symbolicAvengerExpirations, {
        at: runtime.time,
        expiresAt: canonicalTime(runtime.time + balanceProfileNumber(profile, 'pulseInterval')),
        count: 1,
        maximumStacks: balanceProfileNumber(profile, 'maximumStacks'),
        retain: 'latest-expiry'
      });
      {
        runtime.effects.emit({
          kind: 'announcement',
          announcement: {
            type: 'trait',
            name: profile.name,
            at: runtime.time,
            sourceSkill: event.skillName,
            detail: `${state.symbolicAvengerExpirations.length}/${balanceProfileNumber(profile, 'maximumStacks')} stacks`,
            icon: guardianTraitIcon(TRAIT.SYMBOLIC_AVENGER)
          }
        });
      }
    }
  }

  if (!hasTrait(runtime, TRAIT.ZEALOTS_RESOLUTION) || event.skillId === ID.LESSER_SYMBOL_OF_RESOLUTION) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ZEALOTS_RESOLUTION);
  const health = runtime.config.target?.health ?? 0;
  // Detached previews pin target health; ordinary simulations still evaluate the health before this hit.
  const lostFraction =
    runtime.config.target?.fixedHealthFraction != null
      ? 1 - runtime.config.target.fixedHealthFraction
      : health > 0
        ? (targetHealthLoss(runtime.config, runtime) - damage) / health
        : 0;
  if (
    !(lostFraction > balanceProfileNumber(profile, 'threshold')) ||
    !isInternalCooldownReady(runtime.time, runtime.procs.deadline('guardian.core.zealotsResolution'))
  )
    return;
  // Claim before the first queued symbol impact so same-time children cannot recursively claim it.
  if (emitTraitSymbol(runtime, TRAIT.ZEALOTS_RESOLUTION, ID.LESSER_SYMBOL_OF_RESOLUTION, event))
    runtime.procs.readyAt['guardian.core.zealotsResolution'] = canonicalTime(
      runtime.time + balanceProfileNumber(profile, 'cooldown')
    );
}

/** Greatsword recharge uses the selected trait profile before the later weapon and virtue adjustments. */
export const zealousBladeRecharge = compileRechargeRules<GuardianRuntimeState>([
  {
    trait: TRAIT.ZEALOUS_BLADE,
    when: (_runtime, skill) => skill.weapon === 'Greatsword',
    multiplier: { profile: TRAIT.ZEALOUS_BLADE, field: 'rechargeMultiplier' }
  }
]);

/** Spirit weapons gain their extra capacity before the runtime constructs ammunition pools. */
export function eternalArmoryMaximumAmmo(runtime: Runtime, skill: Skill, maximum: number): number {
  return skill.categories?.includes('SpiritWeapon') && hasTrait(runtime, TRAIT.ETERNAL_ARMORY)
    ? maximum + balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_ARMORY), 'resourceGain')
    : maximum;
}

const TRAIT_BY_ID = new Map(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ]).map((trait) => [Number(trait.id), trait])
);

/** Provides shared Guardian trait metadata and resolver emissions without making trait lines import the dispatcher. */
export function guardianTraitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || '';
}

export function isGuardianSymbolSkill(skill: GuardianSkill | undefined, fallbackName = ''): boolean {
  const name = skill?.name || fallbackName;
  const description = skill?.description || '';
  return (
    /^Symbol of /.test(name) ||
    /^Lesser Symbol of /.test(name) ||
    /^Symbol\./.test(description) ||
    /\bcreat(?:e|ing) a symbol\b/i.test(description)
  );
}

export function guardianResolverState(context: GuardianResolverContext): GuardianCoreState {
  return professionCoreState(context);
}

// These child effects have packet identities but no player-selectable catalog entry.
export const symbols: Readonly<Record<SkillId, Skill>> = {
  [ID.LESSER_SYMBOL_OF_BLADES]: {
    id: ID.LESSER_SYMBOL_OF_BLADES,
    name: 'Lesser Symbol of Blades',
    weapon: 'Unequipped'
  },
  [ID.LESSER_SYMBOL_OF_PROTECTION]: {
    id: ID.LESSER_SYMBOL_OF_PROTECTION,
    name: 'Lesser Symbol of Protection',
    weapon: 'Unequipped'
  },
  [ID.LESSER_SYMBOL_OF_RESOLUTION]: {
    id: ID.LESSER_SYMBOL_OF_RESOLUTION,
    name: 'Lesser Symbol of Resolution',
    weapon: 'Unequipped'
  }
};

/** A triggered symbol owns a distinct activation and schedules only its surviving selected components. */
export function emitTraitSymbol(
  runtime: Gw2Runtime<GuardianRuntimeState, GuardianSkill>,
  trait: number,
  symbolId: SkillId,
  cause: Gw2ResolverEvent,
  options: { party?: boolean; fieldDuration?: (effect: SkillEffect) => number } = {}
): boolean {
  const profile = requireBalanceProfileFromContext(runtime, trait);
  const components = (profile.effects ?? []).filter((effect) => effect.type === 'strike' || effect.type === 'boon');
  if (!components.length) return false;
  const symbol = symbols[symbolId];
  const activationId = `guardian.symbol:${symbolId}:${cause.activationId ?? cause.eventOrder}:${runtime.time}`;
  for (const component of components) {
    if (component.type === 'strike' && !component.ticks?.length)
      throw new Error(`${profile.name} requires an explicit strike timeline.`);
    const effect = {
      ...component,
      ...(component.type === 'strike' ? { name: symbol.name, weapon: 'Unequipped' } : {}),
      ...(options.party && component.type === 'boon' ? { audience: { recipients: 'party' as const } } : {})
    };
    // Selected symbol components retain their field and activation while transport stays shared.
    const fieldDuration = options.fieldDuration?.(component) ?? 0;
    runtime.effects.emit({
      kind: 'profile',
      profile: symbol,
      effects: [effect],
      cause,
      attribution: {
        source: 'Trait',
        sourceId: trait,
        actorType: 'player',
        skillId: symbolId,
        skillName: symbol.name,
        activationId
      },
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        triggeredBy: cause.skillName,
        ...(event.type === 'damage'
          ? {
              isSymbol: true,
              ...(event.hitIndex === 1 && fieldDuration > 0
                ? { comboFields: [{ ownerId: 'guardian', fieldType: 'Light' as const, duration: fieldDuration }] }
                : {})
            }
          : {})
      })
    });
  }

  {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: symbol.name,
        at: runtime.time,
        sourceSkill: cause.skillName,
        detail: profile.name,
        icon: guardianTraitIcon(trait)
      }
    });
  }

  return true;
}

/** Core and elite owners invoke the same activation boons after admitting their own passive-readiness gate. */
export function applyGuardianVirtueActivationTraits(
  runtime: Runtime,
  cast: RuntimeCast<GuardianSkill>,
  virtue: GuardianVirtue
): void {
  virtueBuff(
    runtime,
    cast,
    GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
    virtue === 'justice' ? 'might' : virtue === 'resolve' ? 'regeneration' : 'protection',
    true
  );
  virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION, 'resolution');
  virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE, 'guardian-inspiring-virtue');
  if (virtue === 'courage') virtueBuff(runtime, cast, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE, 'stability');
}
