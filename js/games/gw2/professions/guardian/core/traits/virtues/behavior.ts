import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SelectedContentContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_TRAIT_IDS, GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';

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
export function guardianResolutionMultiplier(context: SelectedContentContext): number {
  return context.hasTrait(GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)
    ? balanceProfileNumber(context.requireBalanceProfile(GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION), 'durationMultiplier')
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
  runtime: MechanicQueriesOf<Runtime>,
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
export function glacialHeartAvailability(runtime: MechanicQueriesOf<Runtime>, skill: Skill) {
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

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
