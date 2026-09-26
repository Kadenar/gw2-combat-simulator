import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { CAST_READY, denyCast } from '#gw2/platform/engine/skills/availability.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { gw2EffectExpiresAt, projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import {
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { applyGuardianVirtueActivationTraits, refreshGuardianVirtues } from '#gw2/professions/guardian/core/live.js';
import { emitGuardianLiveBoon, triggerGuardianFuriousFocus } from '#gw2/professions/guardian/core/live-traits.js';
import { recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/shared.js';
import { modifyGuardianRechargeDuration } from '#gw2/professions/guardian/core/traits/modifiers.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  countEffulgentHit,
  grantLuminaryAura,
  luminaryCause,
  luminaryEffectTasks,
  luminaryImpactAt,
  startLuminaryEffects
} from '#gw2/professions/guardian/specializations/luminary/live-effects.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const EXIT = 'guardian.luminary.forge-expiry';
const EQUIP = 'guardian.luminary.equip-traits';
const HAMMER = 'guardian.luminary.hammer';
const BOON = 'guardian.luminary.weapon-boon';
const VIRTUES: readonly number[] = [ID.RADIANT_JUSTICE, ID.RADIANT_RESOLVE, ID.RADIANT_COURAGE];
const readyVirtues = new WeakSet<RuntimeCast>();
const equipForge = new WeakMap<RuntimeCast, string | null>();

/** Forge exits start real recharge once, using distinct completed weapon equips and the shared rate controller. */
function exitForge(runtime: Runtime, cast?: RuntimeCast): void {
  const state = luminaryState.from(runtime);
  if (!state.radiantForge) return;
  const enter = runtime.helpers.skillsById.get(ID.ENTER_RADIANT_FORGE)!;
  const exit = runtime.helpers.skillsById.get(ID.EXIT_RADIANT_FORGE)!;
  if (
    runtime.hasExplicitCombatStart &&
    (runtime.combatStartPending ||
      runtime.cursor.command?.type === 'combat-start' ||
      runtime.combatStartTime == null ||
      runtime.time < runtime.combatStartTime)
  )
    runtime.cooldownController.clear(enter.id);
  else {
    const used = Object.keys(state.radiantWeaponsUsed).filter((weapon) =>
      ['hammer', 'staff', 'blade', 'bulwark'].includes(weapon)
    ).length;
    const reduction =
      used <= 1
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.forge), 'rechargeReduction')
        : 0;
    const work = modifyGuardianRechargeDuration(
      { catalog: runtime.helpers, config: runtime.config, skill: enter },
      Math.max(0, gw2BaseRecharge(enter) - reduction)
    );
    runtime.cooldownController.startRecharge(enter, runtime.time, work);
  }

  state.radiantForge = false;
  state.radiantForgeEndsAt = 0;
  state.radiantForgeEnteredAt = 0;
  state.forgeActivationId = null;
  state.radiantWeapon = '';
  state.glaringBurstSwordSlow = false;
  resetAutoattackChains(runtime);
  // Leaving the forge dismisses only its own bar; ordinary weapon follow-ups retain their independent lifetimes.
  for (const id of Object.keys(runtime.profession.core.availableFlips)) {
    const skill = runtime.helpers.skillsById.get(Number(id));
    if (skill?.radiantForgeSkill || skill?.id === ID.EXIT_RADIANT_FORGE)
      consumeSkillFlip(runtime.profession.core.availableFlips, id);
  }

  runtime.emit({
    type: 'weapon_set',
    at: runtime.time,
    source: 'guardian',
    sourceId: exit.id,
    actorType: 'player',
    skillId: exit.id,
    skillName: exit.name,
    weaponSet: runtime.activeWeaponSet,
    weaponLine: exit.name,
    activationId: cast?.id,
    automatic: !cast
  });
  lockTransitionInput(runtime, 'forgeExitMs', exit);
}

/** The form has one exact expiry; a stale expiry cannot close a later entry at the same deadline. */
function enterForge(runtime: Runtime, cast: RuntimeCast): void {
  runtime.cooldownController.clear(cast.skill.id);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.forge);
  const effect = requireEffect(profile, 'buff', 'radiant-forge');
  if (!effect) return;
  const state = luminaryState.from(runtime);
  state.radiantForge = true;
  state.radiantForgeEndsAt = canonicalTime(runtime.time + effectNumber(profile, effect, 'duration'));
  state.radiantForgeEnteredAt = runtime.time;
  state.forgeActivationId = cast.id;
  state.radiantWeapon = '';
  state.glaringBurstSwordSlow = false;
  state.radiantWeaponsUsed = {};
  resetAutoattackChains(runtime);
  armSkillFlip(runtime.profession.core.availableFlips, ID.EXIT_RADIANT_FORGE, runtime.time);
  runtime.schedule(EXIT, state.radiantForgeEndsAt, cast.id, undefined, -220);
  runtime.emit({
    ...luminaryCause(runtime, cast),
    type: 'weapon_set',
    weaponSet: runtime.activeWeaponSet,
    weaponLine: cast.skill.name
  });
  lockTransitionInput(runtime, 'forgeEntryMs', cast.skill);
}

/** Equip rewards use their real delayed boundary; future boons cannot pre-fill the current state or cooldowns. */
function equipTraits(runtime: Runtime, data: unknown): void {
  const cast = data as RuntimeCast;
  const cause = luminaryCause(runtime, cast);
  const state = luminaryState.from(runtime);
  if (hasTrait(runtime, TRAIT.RESPLENDENT_WEAPONRY)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.resplendentWeaponry);
    for (const effect of profile.effects ?? []) {
      if (effect.type !== 'boon') continue;
      emitGuardianLiveBoon(runtime, {
        ...cause,
        sourceId: TRAIT.RESPLENDENT_WEAPONRY,
        skillName: 'Resplendent Weaponry',
        kind: effect.boon,
        duration: effect.duration,
        stacks: effectNumber(profile, effect, 'stacks'),
        audience: { recipients: 'party' }
      });
    }
  }

  if (hasTrait(runtime, TRAIT.EMPOWERED_ARMAMENTS)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.empoweredArmaments);
    const duration = Math.min(
      balanceProfileNumber(profile, 'maximumStacks'),
      Math.max(0, state.empoweredArmamentsUntil - runtime.time) + balanceProfileNumber(profile, 'resourceGain')
    );
    state.empoweredArmamentsUntil = gw2EffectExpiresAt(runtime.time, duration);
    emitGuardianLiveBoon(runtime, { ...cause, kind: 'guardian-empowered-armaments', duration, stacks: 1 });
    recordGuardianTraitProc(
      runtime,
      TRAIT.EMPOWERED_ARMAMENTS,
      'Empowered Armaments',
      runtime.time,
      cast.skill.name,
      'Radiant weapon equipped'
    );
  }

  if (hasTrait(runtime, TRAIT.ILLUMINATING_INSPIRATION)) {
    const reduction = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.illuminatingInspiration),
      'rechargeReduction'
    );
    for (const id of VIRTUES)
      runtime.cooldownController.reduceSkillRecharge(runtime.helpers.skillsById.get(id)!, reduction, runtime.time);
    refreshGuardianVirtues(runtime);
    recordGuardianTraitProc(
      runtime,
      TRAIT.ILLUMINATING_INSPIRATION,
      'Illuminating Inspiration',
      runtime.time,
      cast.skill.name,
      `Virtue recharges reduced by ${reduction} seconds`
    );
  }
}

/** Justice is sampled at hammer impact, allowing a concurrent virtue to empower an already accepted cast. */
function hammerImpact(runtime: Runtime, data: unknown): void {
  const state = luminaryState.from(runtime);
  if (!state.radiantJusticeArmed) return;
  state.radiantJusticeArmed = false;
  const cast = data as RuntimeCast;
  const cause = luminaryCause(runtime, cast);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.radiantJusticeImpact);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  if (strike)
    runtime.emitDerived(
      cause,
      buildGuardianStrike({
        at: canonicalTime(runtime.time + effectNumber(profile, strike, 'atMs') / 1000),
        sourceId: cast.skill.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        name: 'Dazzling Hammer — Radiant Justice Impact',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        offTarget: cast.command.offTarget === true
      })
    );
  if (condition)
    runtime.emitDerived(
      cause,
      buildResolverCondition({
        at: canonicalTime(runtime.time + effectNumber(profile, condition, 'atMs') / 1000),
        source: 'guardian',
        sourceId: cast.skill.id,
        actorType: 'effect',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        condition: 'Vulnerability',
        stacks: effectNumber(profile, condition, 'stacks'),
        duration: effectNumber(profile, condition, 'duration'),
        offTarget: cast.command.offTarget === true
      })
    );
}

/** Capture the Glaring Burst variant once per accepted attack, then use normal packet materialization. */
function burstEffects(runtime: Runtime, cast: RuntimeCast): readonly SkillEffect[] {
  const state = luminaryState.from(runtime);
  const weapon = state.radiantWeapon;
  const slow = state.glaringBurstSwordSlow;
  const runtimeMs = (cast.fullEnd - cast.start) * 1000;
  const atMs =
    weapon === 'blade'
      ? runtimeMs * ((slow ? 440 : 360) / (slow ? 680 : 440))
      : projectCastRelativeEffectTimingMs(cast.skill, runtimeMs, 480);
  const profileId =
    weapon === 'hammer'
      ? PROFILE.glaringBurstHammer
      : weapon === 'blade'
        ? PROFILE.glaringBurstBlade
        : weapon === 'staff'
          ? PROFILE.glaringBurstStaff
          : weapon === 'bulwark'
            ? PROFILE.glaringBurstBulwark
            : null;
  const profile = profileId == null ? null : requireBalanceProfileFromContext(runtime, profileId);
  if (weapon === 'blade') state.glaringBurstSwordSlow = !slow;
  const vulnerability = requireEffect(
    requireBalanceProfileFromContext(runtime, PROFILE.glaringBurstVulnerability),
    'condition',
    'Vulnerability'
  );
  return [...(profile?.effects ?? []), ...(vulnerability ? [vulnerability] : [])].map((effect) => ({
    ...effect,
    ...(effect.type === 'strike' ? { name: cast.skill.name } : {}),
    atMs,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { radiantWeapon: weapon }
  }));
}

/** Luminary owns its live form, virtue entitlements, finite stance work, and actual combo-derived auras. */
export const luminaryLiveMechanics: Partial<RuntimeProfession<GuardianRuntimeState>> = {
  availability(runtime, skill) {
    const active = luminaryState.from(runtime).radiantForge;
    if (skill.type === 'Weapon' && active)
      return denyCast(
        'guardian.radiant-forge-weapon-lockout',
        `${skill.name} is unavailable — exit Radiant Forge first.`
      );
    if ((skill.radiantForgeSkill || skill.id === ID.EXIT_RADIANT_FORGE) && !active)
      return denyCast('guardian.radiant-forge-inactive', `${skill.name} is unavailable — requires Radiant Forge.`);
    if (skill.id === ID.ENTER_RADIANT_FORGE && active)
      return denyCast(
        'guardian.radiant-forge-active',
        `${skill.name} is unavailable — Radiant Forge is already active.`
      );
    return CAST_READY;
  },
  castDurationMs(runtime, skill, duration) {
    const state = luminaryState.from(runtime);
    return skill.id === ID.GLARING_BURST && state.radiantWeapon === 'blade'
      ? duration * ((state.glaringBurstSwordSlow ? 680 : 440) / Number(skill.castTimeMs ?? 600))
      : duration;
  },
  castDetail(runtime, cast) {
    if (cast.skill.id !== ID.GLARING_BURST) return undefined;
    const state = luminaryState.from(runtime);
    const label =
      state.radiantWeapon === 'blade'
        ? `Sword (${state.glaringBurstSwordSlow ? 'slow' : 'fast'})`
        : { hammer: 'Hammer', staff: 'Staff', bulwark: 'Shield' }[state.radiantWeapon];
    return label ? `Variant: ${label}` : undefined;
  },
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.id === ID.GLARING_BURST)
      return cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)
        ? []
        : burstEffects(runtime, cast);
    if (cast.skill.id !== ID.LUMINOUS_STAFF) return effects;
    // Symbol pulses grant their self boon even when the hostile pulse misses.
    return [
      ...effects,
      ...effects.flatMap((effect): SkillEffect[] =>
        effect.type !== 'strike'
          ? []
          : strikeEffectTicks(effect).map((tick) => ({
              type: 'boon',
              boon: 'resolution',
              stacks: 1,
              duration: 1,
              atMs: tick.atMs,
              timingAnchor: effect.timingAnchor,
              timingScale: effect.timingScale,
              persistsAfterInterrupt: effect.persistsAfterInterrupt
            }))
      )
    ];
  },
  onCastStart(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    startLuminaryEffects(runtime, cast);
    const state = luminaryState.from(runtime);
    if (VIRTUES.includes(Number(cast.skill.id))) {
      refreshGuardianVirtues(runtime);
      const virtue = guardianVirtueForSlot(cast.skill.slot)!;
      if (runtime.profession.core.virtueReadyAt[virtue] <= runtime.time) readyVirtues.add(cast);
    }

    if (!cast.skill.radiantWeapon || cast.skill.flipParentId != null) return;
    // A committed impact can outlive its form, but cannot equip a weapon into a different forge entry.
    equipForge.set(cast, state.forgeActivationId);
    // Armament damage starts with the accepted equip animation, independently of its completion rewards.
    if (hasTrait(runtime, TRAIT.RADIANT_ARMAMENTS)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.radiantArmaments);
      const effect = requireEffect(profile, 'buff', 'radiant-armaments');
      if (effect) {
        emitGuardianLiveBoon(runtime, {
          ...luminaryCause(runtime, cast),
          kind: 'guardian-radiant-armaments',
          duration: effectNumber(profile, effect, 'duration'),
          stacks: 1,
          metadata: { radiantWeapon: String(cast.skill.radiantWeapon) }
        });
        recordGuardianTraitProc(
          runtime,
          TRAIT.RADIANT_ARMAMENTS,
          'Radiant Armaments',
          runtime.time,
          cast.skill.name,
          String(cast.skill.radiantWeapon)
        );
      }
    }

    const impact = luminaryImpactAt(cast);
    if (cast.skill.id === ID.DAZZLING_HAMMER) runtime.schedule(HAMMER, impact, cast);
    if (cast.skill.id === ID.GLEAMING_BLADE && state.radiantCourageSwordArmed) {
      state.radiantCourageSwordArmed = false;
      runtime.schedule(BOON, impact, { cast, kind: 'guardian-radiant-courage-sword', duration: 0.001 }, undefined, -10);
    }

    if (cast.skill.id === ID.LUMINOUS_STAFF && state.radiantResolveArmed) {
      state.radiantResolveArmed = false;
      runtime.schedule(BOON, impact, { cast, kind: 'regeneration', duration: 4, party: true });
    }

    if (cast.skill.id === ID.RADIANT_BULWARK) state.radiantCourageShieldArmed = false;
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    const state = luminaryState.from(runtime);
    if (cast.skill.id === ID.ENTER_RADIANT_FORGE) enterForge(runtime, cast);
    if (cast.skill.id === ID.EXIT_RADIANT_FORGE) exitForge(runtime, cast);
    if (
      cast.skill.radiantWeapon &&
      cast.skill.flipParentId == null &&
      state.radiantForge &&
      equipForge.get(cast) === state.forgeActivationId
    ) {
      state.radiantWeapon = String(cast.skill.radiantWeapon);
      state.radiantWeaponsUsed[String(cast.skill.radiantWeapon)] = true;
      if (cast.skill.radiantWeapon === 'blade') state.glaringBurstSwordSlow = false;
      const flips = runtime.profession.core.availableFlips;
      for (const id of Object.keys(flips)) {
        const skill = runtime.helpers.skillsById.get(Number(id));
        if (skill?.radiantWeapon && skill.flipParentId != null) consumeSkillFlip(flips, id);
      }

      if (cast.skill.flipSkillId != null) armSkillFlip(flips, cast.skill.flipSkillId, runtime.time);
      runtime.emit({ ...luminaryCause(runtime, cast), type: 'sigil_swap', weaponSet: runtime.activeWeaponSet });
      runtime.schedule(EQUIP, canonicalTime(runtime.time + 0.001), cast);
    } else if (cast.skill.radiantForgeSkill && cast.skill.flipParentId != null)
      consumeSkillFlip(runtime.profession.core.availableFlips, cast.skill.id);
    if (!VIRTUES.includes(Number(cast.skill.id))) return;
    const virtue = guardianVirtueForSlot(cast.skill.slot)!;
    refreshGuardianVirtues(runtime);
    if (readyVirtues.has(cast)) {
      applyGuardianVirtueActivationTraits(runtime, cast, virtue);
      if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
    }

    if (hasTrait(runtime, TRAIT.MASTER_AT_ARMS)) {
      for (const id of virtue === 'justice'
        ? [ID.DAZZLING_HAMMER]
        : virtue === 'resolve'
          ? [ID.LUMINOUS_STAFF]
          : [ID.GLEAMING_BLADE, ID.RADIANT_BULWARK])
        runtime.cooldownController.clear(id);
      recordGuardianTraitProc(
        runtime,
        TRAIT.MASTER_AT_ARMS,
        'Master-at-Arms',
        runtime.time,
        cast.skill.name,
        'Radiant weapons recharged'
      );
    }

    if (virtue === 'justice') {
      state.radiantJusticeArmed = true;
      runtime.recordProc(
        'skill',
        'Empowered Hammer',
        runtime.time,
        cast.skill.name,
        'Next Dazzling Hammer creates a delayed secondary impact',
        cast.skill.icon
      );
    }

    if (virtue === 'resolve') state.radiantResolveArmed = true;
    if (virtue === 'courage') {
      state.radiantCourageSwordArmed = state.radiantCourageShieldArmed = true;
      runtime.recordProc(
        'skill',
        'Empowered Sword',
        runtime.time,
        cast.skill.name,
        'Next Gleaming Blade deals 50% more damage',
        cast.skill.icon
      );
    }
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      countEffulgentHit(runtime, event, (details as NativeResolvedDamageDetails).hitContext?.damage ?? 0);
      refreshGuardianVirtues(runtime);
      reactToJusticeHitWithOptions(runtime, event, details as NativeResolvedDamageDetails, {
        skillId: ID.RADIANT_JUSTICE,
        skillName: 'Radiant Justice',
        passiveBurnDuration: 2
      });
    },
    'aura.applied'(runtime, event) {
      if (event.aura === 'Light Aura') grantLuminaryAura(runtime, event);
    },
    'combo.resolved'(runtime, event) {
      if (event.skillId === ID.DAZZLING_HAMMER)
        grantLuminaryAura(runtime, { ...event, type: 'combo', duration: undefined });
    }
  },
  tasks: {
    ...luminaryEffectTasks,
    [EXIT](runtime, data) {
      if (luminaryState.from(runtime).forgeActivationId === data) exitForge(runtime);
    },
    [EQUIP]: equipTraits,
    [HAMMER]: hammerImpact,
    [BOON](runtime, data) {
      const { cast, kind, duration, party } = data as {
        cast: RuntimeCast;
        kind: string;
        duration: number;
        party?: boolean;
      };
      emitGuardianLiveBoon(runtime, {
        ...luminaryCause(runtime, cast),
        priority: kind === 'guardian-radiant-courage-sword' ? -5 : 0,
        kind,
        duration,
        stacks: 1,
        audience: { recipients: party ? 'party' : 'self' }
      });
    }
  }
};
