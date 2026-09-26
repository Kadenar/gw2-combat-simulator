import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  armSkillFlip,
  consumeSkillFlip,
  expireSkillFlip,
  skillFlipReady
} from '#gw2/platform/engine/skills/skill-flips.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { denySkillCast, selectedSlotSkillAvailability } from '#gw2/professions/shared/availability.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import {
  applyGuardianVirtueActivationTraits,
  CORE_VIRTUES,
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions,
  refreshGuardianVirtues
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { modifyGuardianMaximumAmmo } from '#gw2/professions/guardian/core/mechanics/recharge.js';
import { modifyGuardianRechargeDuration } from '#gw2/professions/guardian/core/mechanics/recharge.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import {
  completeSpearIllumination,
  expireSpearIllumination,
  GUARDIAN_SPEAR_EXPIRY,
  illuminatedSpearEffects
} from '#gw2/professions/guardian/core/mechanics/spear.js';
import {
  completeGuardianHealTraits,
  completeGuardianIgnition,
  guardianComboFields,
  guardianTraitEffects,
  guardianTraitTasks,
  triggerGuardianFuriousFocus,
  reactToGuardianDamage,
  reactToGuardianBuff,
  reactToSymbolOfIgnition
} from '#gw2/professions/guardian/core/traits/index.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const FLIP_EXPIRY = 'guardian.weapon-flip-expiry';
const readyVirtueActivations = new WeakSet<RuntimeCast>();
/** Virtue state changes once on commitment; report packets do not restore a second copy of that state. */
function completeCoreVirtue(runtime: Runtime, cast: RuntimeCast, virtue: GuardianVirtue): void {
  refreshGuardianVirtues(runtime);
  if (virtue === 'justice')
    runtime.profession.core.justiceActiveArmed = Boolean(
      requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.justice), 'condition', 'Burning (active)')
    );
  if (!readyVirtueActivations.has(cast)) return;
  applyGuardianVirtueActivationTraits(runtime, cast, virtue);
  if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
}

/** A completed refresh readies actual recharge and ammo pools; cancellation leaves every existing owner intact. */
function renewedFocus(runtime: Runtime, cast: RuntimeCast): void {
  if (castWasInterrupted(cast)) return;
  for (const skill of runtime.helpers.skills) {
    if (!skill.categories?.includes('Virtue') || !guardianVirtueForSlot(skill.slot)) continue;
    runtime.cooldownController.clear(skill.id);
    runtime.cooldownController.restoreAmmo(skill, Infinity, runtime.time, 'reset');
  }

  runtime.profession.core.virtueReadyAt = { justice: runtime.time, resolve: runtime.time, courage: runtime.time };
}

/** Weapon follow-ups open only on commitment and expire by occurrence identity, independent of parent recharge. */
function completeWeapon(runtime: Runtime, cast: RuntimeCast): void {
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
  if (skill.id === ID.BANISH) runtime.cooldownController.clear(ID.MIGHTY_BLOW);
  if (skill.id === ID.ZEALOTS_FIRE) {
    for (const lockout of runtime.helpers.skillsById.get(ID.ZEALOTS_FLAME)?.lockouts ?? [])
      runtime.lockouts.set(lockout.group, canonicalTime(runtime.time + lockout.durationMs / 1000));
  } else if (skill.type !== 'Action') runtime.lockouts.delete('guardian-zealots-flame-after-fire');
  const flips = runtime.profession.core.availableFlips;
  if (skill.flipSkillId != null && skill.flipSkillId !== skill.nextChainId) {
    const flip = runtime.helpers.skillsById.get(skill.flipSkillId);
    if (flip?.flipParentId === skill.id) {
      const duration =
        skill.id === ID.ZEALOTS_FLAME
          ? hasTrait(runtime, TRAIT.RADIANT_FIRE)
            ? 4.5
            : 3
          : skill.id === ID.SHIELD_OF_ABSORPTION
            ? 4
            : skill.id === ID.BINDING_BLADE
              ? 10
              : Math.max(1, Number(skill.cooldown ?? 5));
      const window = armSkillFlip(flips, flip.id, runtime.time, canonicalTime(runtime.time + duration));
      runtime.schedule(
        FLIP_EXPIRY,
        window.expiresAt!,
        { skillId: flip.id, identity: window.identity },
        undefined,
        -220
      );
    }
  }

  if (skill.flipParentId != null) consumeSkillFlip(flips, skill.id);
}

/** Core hooks: accepted virtues, shared recharge, endurance grants, and temporary weapon state. */
export const guardianCoreHooks: Partial<RuntimeProfession<GuardianRuntimeState>> = {
  endurance: { state: (runtime) => runtime.profession.core, maximum: () => 100, regenerationRate: () => 0 },
  rechargeWork: (runtime, skill, work) =>
    modifyGuardianRechargeDuration({ catalog: runtime.helpers, config: runtime.config, skill }, work),
  maximumAmmo: (runtime, skill, maximum) =>
    modifyGuardianMaximumAmmo({ catalog: runtime.helpers, config: runtime.config, skill }, maximum),
  modifyComboFields: guardianComboFields,
  modifyEffects(runtime, cast, effects) {
    return guardianTraitEffects(runtime, cast, illuminatedSpearEffects(runtime, cast, effects));
  },
  availability(runtime, skill) {
    const selected = selectedSlotSkillAvailability({ config: runtime.config, catalog: runtime.helpers }, skill);
    if (selected) return selected;
    const glacial = hasTrait(runtime, TRAIT.GLACIAL_HEART);
    if (skill.id === ID.MIGHTY_BLOW && glacial)
      return denySkillCast(
        skill,
        'guardian.trait-replacement',
        'Glacial Blow replaces it while Glacial Heart is selected.'
      );
    if (skill.id === ID.GLACIAL_BLOW && !glacial)
      return denySkillCast(skill, 'guardian.trait-replacement', 'requires the Glacial Heart trait.');
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
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    completeWeapon(runtime, cast);
    completeSpearIllumination(runtime, cast);
    completeGuardianHealTraits(runtime, cast);
    completeGuardianIgnition(runtime, cast);
    const virtue = CORE_VIRTUES.find(([id]) => id === cast.skill.id)?.[1];
    if (virtue) completeCoreVirtue(runtime, cast, virtue);
    if (cast.skill.id === ID.RENEWED_FOCUS) renewedFocus(runtime, cast);
  },
  onCooldownReset: refreshGuardianVirtues,
  reactions: {
    'damage.resolved'(runtime, event, details) {
      reactToGuardianDamage(runtime, event, (details as NativeResolvedDamageDetails).hitContext?.damage ?? 0);
      if (runtime.profession.specialization.kind !== 'Core') return;
      refreshGuardianVirtues(runtime);
      reactToJusticeHitWithOptions(runtime, event, details as NativeResolvedDamageDetails);
    },
    'buff.applied'(runtime, event) {
      if (event.kind === 'alacrity') refreshGuardianVirtues(runtime);
      reactToGuardianBuff(runtime, event);
    },
    'condition.applied'(runtime, event) {
      reactToSymbolOfIgnition(runtime, event);
    }
  },
  tasks: {
    ...guardianTraitTasks,
    [GUARDIAN_SPEAR_EXPIRY]: expireSpearIllumination,
    [FLIP_EXPIRY](runtime, data) {
      const { skillId, identity } = data as { skillId: SkillId; identity: number | string };
      expireSkillFlip(runtime.profession.core.availableFlips, skillId, runtime.time, identity);
    }
  }
};
