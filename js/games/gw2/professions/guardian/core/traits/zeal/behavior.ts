import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { emitTraitSymbol } from '#gw2/professions/guardian/core/traits/symbols.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Ready Justice activations claim symbol recharge at the permanent Alacrity rate. */
export function triggerGuardianFuriousFocus(
  runtime: Runtime,
  cast: { id: string; skill: Pick<RuntimeCast<GuardianSkill>['skill'], 'id' | 'name'> }
): void {
  if (!hasTrait(runtime, TRAIT.FURIOUS_FOCUS)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FURIOUS_FOCUS);
  if (!requireEffect(profile, 'strike', 'Strike')) return;
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };
  // The symbol reserves shared player recharge before its effects can trigger another activation.
  emitTraitSymbol(runtime, TRAIT.FURIOUS_FOCUS, ID.LESSER_SYMBOL_OF_BLADES, cause, {
    cooldownKey: 'guardian.core.furiousFocus',
    fieldDuration: () => 4
  });
}

/** Only accepted positive player impacts grant symbol traits; the threshold-crossing hit cannot trigger its own reward. */
export function reactToZealDamage(runtime: Runtime, event: Gw2ResolverEvent, damage: number): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !(damage > 0)) return;
  const state = runtime.profession.core;
  if (event.metadata?.guardianSymbol === true) {
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
        ? (runtime.combat.targetHealthLoss() - damage) / health
        : 0;
  if (!(lostFraction > balanceProfileNumber(profile, 'threshold'))) return;
  // The profile owns this symbol's Alacrity-aware recharge; removed symbols do not consume it.
  emitTraitSymbol(runtime, TRAIT.ZEALOTS_RESOLUTION, ID.LESSER_SYMBOL_OF_RESOLUTION, event, {
    cooldownKey: 'guardian.core.zealotsResolution'
  });
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
export function eternalArmoryMaximumAmmo(context: MaximumAmmoContext<object>, skill: Skill, maximum: number): number {
  return skill.categories?.includes('SpiritWeapon') && context.hasTrait(TRAIT.ETERNAL_ARMORY)
    ? maximum + balanceProfileNumber(context.requireBalanceProfile(TRAIT.ETERNAL_ARMORY), 'resourceGain')
    : maximum;
}

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
