import { reactToRighteousInstinctsBuff } from '#gw2/professions/guardian/core/traits/radiance.js';
import { writOfPersistenceEffects, writOfPersistenceFields } from '#gw2/professions/guardian/core/traits/honor.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { guardianRechargeWork } from '#gw2/professions/guardian/core/mechanics/recharge.js';
import { expireSpearIllumination, GUARDIAN_SPEAR_EXPIRY } from '#gw2/professions/guardian/core/mechanics/spear.js';
import {
  applyJusticeBurn,
  CORE_VIRTUES,
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions,
  refreshGuardianVirtues
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianJusticeActions } from '#gw2/professions/guardian/core/skills/profession-skills.js';
import {
  guardianIgnitionActions,
  guardianIgnitionFields,
  reactToSymbolOfIgnition
} from '#gw2/professions/guardian/core/skills/weapons/pistol.js';
import { guardianSpearActions } from '#gw2/professions/guardian/core/skills/weapons/spear.js';
import { guardianTorchActions } from '#gw2/professions/guardian/core/skills/weapons/torch.js';
import {
  applyGuardianVirtueActivationTraits,
  completeHealersResolution,
  completeProtectorsRestoration,
  eternalArmoryMaximumAmmo,
  glacialHeartAvailability,
  guardianResolutionMultiplier,
  masterOfConsecrationsFields,
  radiantFireMaximumAmmo,
  reactToZealDamage,
  triggerGuardianFuriousFocus
} from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_TRAIT_IDS, GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
const readyVirtueActivations = new WeakSet<RuntimeCast<GuardianSkill>>();
/** Virtue state changes once on commitment; report packets do not restore a second copy of that state. */
function completeCoreVirtue(runtime: Runtime, cast: RuntimeCast<GuardianSkill>, virtue: GuardianVirtue): void {
  refreshGuardianVirtues(runtime);
  if (!readyVirtueActivations.has(cast)) return;
  applyGuardianVirtueActivationTraits(runtime, cast, virtue);
  if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
}

/** Eligible completed skills release the post-Fire lockout; flip transitions remain skill-owned. */
function clearTorchLockout(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  const skill = cast.skill;
  // Profession bars and explicitly managed flips retain their specialization's sole transition owner.
  if (
    String(skill.slot ?? '').startsWith('Profession_') ||
    skill.id === ID.FLASH_COMBO ||
    skill.id === ID.REPOSE ||
    skill.radiantForgeSkill ||
    skill.tags?.includes('specialization-managed-flip') ||
    (skill.flipSkillId != null &&
      runtime.helpers.skillsById.get(skill.flipSkillId)?.tags?.includes('specialization-managed-flip'))
  )
    return;
  if (skill.interruptMode === 'per-packet' && castWasInterrupted(cast)) return;
  if (skill.id !== ID.ZEALOTS_FIRE && skill.type !== 'Action')
    runtime.castController.clearLockout('guardian-zealots-flame-after-fire');
}

/** Core hooks: accepted virtues, shared recharge, endurance grants, and temporary weapon state. */
import { guardianBuffPolicies, guardianEffectStates } from '#gw2/professions/guardian/core/effect-state.js';

export const guardianCoreHooks: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [false, true].map((active) => ({
    id: `justice-${active ? 'active' : 'passive'}`,
    name: `Justice (${active ? 'active' : 'passive'})`,
    source: 'Profession' as const,
    unit: 'occurrence' as const,
    sourceIds: [`guardian.justice-${active ? 'active' : 'passive'}`],
    emit: (runtime) => applyJusticeBurn(runtime, damageInputEvent(runtime), { active })
  })),

  /** Initial effect assumptions seed the existing stack owner, which keeps normal expiry and grant behavior. */
  initialize(runtime) {
    for (const buff of runtime.config.initialBuffs ?? []) {
      if (buff.kind !== 'symbolic-avenger') continue;
      runtime.profession.core.symbolicAvengerExpirations = grantTimedStacks([], {
        at: runtime.time,
        expiresAt: runtime.time + buff.duration,
        count: buff.stacks,
        maximumStacks: balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER),
          'maximumStacks'
        ),
        retain: 'latest-expiry'
      });
    }
  },
  buffPolicies: guardianBuffPolicies,
  observeEffects: guardianEffectStates,
  sideEffectHandlers: {
    ...guardianTorchActions,
    ...guardianSpearActions,
    ...guardianIgnitionActions,
    ...guardianJusticeActions,
    // Declared follow-ups retain their selected recharge-derived lifetime without a global completion fallback.
    'guardian.arm-follow-up'(runtime, context) {
      const skill = context.skill;
      runtime.armFlip(skill.flipSkillId!, {
        expiresAt: runtime.time + (skill.flipDuration ?? Math.max(1, skill.cooldown ?? 5)),
        expiryPriority: -220
      });
    },
    // Elite virtue IDs are absent from other catalogs; select live IDs before using the shared reset action.
    'guardian.refresh-virtues'(runtime, context) {
      const virtues = runtime.helpers.skills.filter(
        (skill) => skill.categories?.includes('Virtue') && guardianVirtueForSlot(skill.slot)
      );
      applySideEffect(runtime, context, { type: 'rechargeReset', skillIds: virtues.map((skill) => skill.id) });
      for (const skill of virtues) runtime.cooldownController.restoreAmmo(skill, Infinity, runtime.time);
      runtime.profession.core.virtueReadyAt = { justice: runtime.time, resolve: runtime.time, courage: runtime.time };
    }
  },
  endurance: { state: (runtime) => runtime.profession.core.endurance, maximum: () => 100, regenerationRate: () => 0 },
  rechargeWork: guardianRechargeWork,
  maximumAmmo: (runtime, skill, maximum) =>
    eternalArmoryMaximumAmmo(runtime, skill, radiantFireMaximumAmmo(runtime, skill, maximum)),
  // Select weapon fields before trait extensions; Writ never changes an already executed field.
  modifyComboFields(runtime, cast, fields) {
    if (cast.skill.id === ID.SYMBOL_OF_IGNITION) fields = guardianIgnitionFields(runtime);
    return writOfPersistenceFields(runtime, cast, masterOfConsecrationsFields(runtime, cast, fields));
  },
  // Resolution samples its profession duration rule once when the shared service applies a boon.
  boonDuration(runtime, event, _baseDuration, scaledDuration) {
    return event.kind === 'resolution' ? scaledDuration * guardianResolutionMultiplier(runtime) : scaledDuration;
  },
  // Symbol variants extend authored pulses before shared materialization.
  modifyEffects(runtime, cast, effects) {
    return writOfPersistenceEffects(runtime, cast, effects);
  },
  availability(runtime, skill) {
    const replacement = glacialHeartAvailability(runtime, skill);
    if (replacement) return replacement;
    const flips = runtime.profession.core.availableFlips;
    if (skill.id === ID.ZEALOTS_FLAME && skillFlipReady(flips[ID.ZEALOTS_FIRE], runtime.time))
      return denySkillCast(skill, 'guardian.flip-parent-active', 'use the active flip skill first.');
    if (
      skill.flipParentId != null &&
      !skill.tags?.includes('specialization-managed-flip') &&
      !skillFlipReady(flips[skill.id], runtime.time)
    )
      return denySkillCast(skill, 'guardian.flip-not-armed', 'not currently armed.');
    return { ready: true };
  },
  onCastStart(runtime, cast) {
    const virtue = CORE_VIRTUES.find(([id]) => id === cast.skill.id)?.[1];
    if (!virtue) return;
    refreshGuardianVirtues(runtime);
    if (runtime.profession.core.virtueReadyAt[virtue] <= runtime.time) readyVirtueActivations.add(cast);
  },
  onCastCommit(runtime, cast) {
    clearTorchLockout(runtime, cast);
    completeHealersResolution(runtime, cast);
    completeProtectorsRestoration(runtime, cast);
    const virtue = CORE_VIRTUES.find(([id]) => id === cast.skill.id)?.[1];
    if (virtue) completeCoreVirtue(runtime, cast, virtue);
  },
  onCooldownReset: refreshGuardianVirtues,
  reactions: {
    'damage.resolved'(runtime, event, details) {
      const damage = (details as NativeResolvedDamageDetails).hitContext?.damage ?? 0;
      // Weapon ignition precedes Zeal rewards, which precede Core passive Justice.
      if (event.actorType === 'player' && Number(event.coefficient) > 0 && damage > 0)
        reactToSymbolOfIgnition(runtime, event);
      reactToZealDamage(runtime, event, damage);
      if (runtime.profession.specialization.kind !== 'Core') return;
      refreshGuardianVirtues(runtime);
      reactToJusticeHitWithOptions(runtime, event, details);
    },
    'buff.applied'(runtime, event) {
      if (event.kind === 'alacrity') refreshGuardianVirtues(runtime);
      reactToRighteousInstinctsBuff(runtime, event);
    },
    'condition.applied'(runtime, event) {
      reactToSymbolOfIgnition(runtime, event);
    }
  },
  tasks: {
    [GUARDIAN_SPEAR_EXPIRY]: expireSpearIllumination
  }
};
