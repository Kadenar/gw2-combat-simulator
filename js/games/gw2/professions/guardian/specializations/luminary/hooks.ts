import { CAST_READY, denyCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { buildGuardianStrike, guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianRechargeWork } from '#gw2/professions/guardian/core/mechanics/recharge.js';
import {
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions,
  refreshGuardianVirtues
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import {
  applyGuardianVirtueActivationTraits,
  triggerGuardianFuriousFocus
} from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  countEffulgentHit,
  grantLuminaryAura,
  luminaryEffectTasks,
  startLuminaryEffects
} from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import {
  BLADE_IMMOBILIZE,
  BOON,
  glaringBurstDetail,
  glaringBurstDuration,
  HAMMER,
  luminaryWeaponActions
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { luminaryStanceActions } from '#gw2/professions/guardian/specializations/luminary/skills/stance-skills.js';
import { luminaryVirtueActions } from '#gw2/professions/guardian/specializations/luminary/skills/virtue-skills.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import {
  completeLuminaryEquipTraits,
  completeMasterAtArms,
  startRadiantArmaments
} from '#gw2/professions/guardian/specializations/luminary/traits/behavior.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = Gw2Runtime<GuardianRuntimeState, GuardianSkill>;
const EXIT = 'guardian.luminary.forge-expiry';
const EQUIP = 'guardian.luminary.equip-traits';
const VIRTUES: readonly number[] = [ID.RADIANT_JUSTICE, ID.RADIANT_RESOLVE, ID.RADIANT_COURAGE];
const readyVirtues = new WeakSet<RuntimeCast<GuardianSkill>>();
const equipForge = new WeakMap<RuntimeCast<GuardianSkill>, string | null>();

/** Forge exits start real recharge once, using distinct completed weapon equips and the shared rate controller. */
function exitForge(runtime: Runtime, cast?: RuntimeCast<GuardianSkill>): void {
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
    const work = guardianRechargeWork(runtime, enter, Math.max(0, gw2BaseRecharge(enter) - reduction));
    runtime.cooldownController.startRecharge(enter, runtime.time, work);
  }

  state.radiantForge = false;
  state.radiantForgeEndsAt = 0;
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

  runtime.effects.emit({
    kind: 'packet',
    event: {
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
    }
  });
  lockTransitionInput(runtime, 'forgeExitMs', exit);
}

/** The form has one exact expiry; a stale expiry cannot close a later entry at the same deadline. */
function enterForge(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  runtime.cooldownController.clear(cast.skill.id);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.forge);
  const effect = requireEffect(profile, 'buff', 'radiant-forge');
  if (!effect) return;
  const state = luminaryState.from(runtime);
  state.radiantForge = true;
  state.radiantForgeEndsAt = canonicalTime(runtime.time + effectNumber(profile, effect, 'duration'));
  state.forgeActivationId = cast.id;
  state.radiantWeapon = '';
  state.glaringBurstSwordSlow = false;
  state.radiantWeaponsUsed = {};
  resetAutoattackChains(runtime);
  armSkillFlip(runtime.profession.core.availableFlips, ID.EXIT_RADIANT_FORGE, runtime.time);
  runtime.schedule(EXIT, state.radiantForgeEndsAt, cast.id, undefined, -220);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...guardianCastCause(runtime, cast),
      type: 'weapon_set',
      weaponSet: runtime.activeWeaponSet,
      weaponLine: cast.skill.name
    }
  });
  lockTransitionInput(runtime, 'forgeEntryMs', cast.skill);
}

/** Justice is sampled at hammer impact, allowing a concurrent virtue to empower an already accepted cast. */
function hammerImpact(runtime: Runtime, data: unknown): void {
  const state = luminaryState.from(runtime);
  if (!state.radiantJusticeArmed) return;
  state.radiantJusticeArmed = false;
  const { cast } = data as { cast: RuntimeCast<GuardianSkill> };
  const cause = guardianCastCause(runtime, cast);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.radiantJusticeImpact);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  if (strike)
    runtime.effects.emit({
      kind: 'packet',
      cause: cause,
      event: buildGuardianStrike({
        at: canonicalTime(runtime.time + effectNumber(profile, strike, 'atMs') / 1000),
        sourceId: cast.skill.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        name: 'Dazzling Hammer — Radiant Justice Impact',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        offTarget: cast.command.offTarget === true
      })
    });
  if (condition)
    runtime.effects.emit({
      kind: 'packet',
      cause: cause,
      event: buildResolverCondition({
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
    });
}

/** Luminary owns its live form, virtue entitlements, finite stance work, and actual combo-derived auras. */
export const luminaryHooks: Partial<RuntimeProfession<GuardianRuntimeState, GuardianSkill>> = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    const state = luminaryState.from(runtime);
    state.radiantForge = Boolean(skill?.radiantForgeSkill);
    state.radiantForgeEndsAt = Infinity;
    state.radiantWeapon = skill?.radiantWeapon ?? '';
    if (inputs.radiantHammer)
      runtime.effects.emit({
        kind: 'packet',
        event: {
          type: 'buff',
          at: runtime.time,
          source: 'Assumption',
          sourceId: 'assumption.radiant-armaments',
          actorType: 'player',
          skillName: 'Radiant Armaments',
          kind: 'guardian-radiant-armaments',
          duration: 3600,
          stacks: 1,
          metadata: { radiantWeapon: 'hammer' }
        }
      });
  },

  sideEffectHandlers: {
    ...luminaryWeaponActions,
    ...luminaryVirtueActions,
    ...luminaryStanceActions,
    // Form transitions share expiry/recharge ownership; declarations choose when to invoke them.
    'guardian.enter-forge'(runtime, context) {
      if (context.kind === 'cast') enterForge(runtime, context.cast);
    },
    'guardian.exit-forge'(runtime, context) {
      if (context.kind === 'cast') exitForge(runtime, context.cast);
    },
    'guardian.snapshot-forge'(runtime, context) {
      if (context.kind === 'cast') equipForge.set(context.cast, luminaryState.from(runtime).forgeActivationId);
    },
    'guardian.equip-forge'(runtime, context) {
      if (context.kind !== 'cast') return;
      const cast = context.cast;
      const state = luminaryState.from(runtime);
      if (state.radiantForge && equipForge.get(cast) === state.forgeActivationId) {
        state.radiantWeapon = String(cast.skill.radiantWeapon);
        state.radiantWeaponsUsed[String(cast.skill.radiantWeapon)] = true;
        if (cast.skill.radiantWeapon === 'blade') state.glaringBurstSwordSlow = false;
        const flips = runtime.profession.core.availableFlips;
        for (const id of Object.keys(flips)) {
          const skill = runtime.helpers.skillsById.get(Number(id));
          if (skill?.radiantWeapon && skill.flipParentId != null) consumeSkillFlip(flips, id);
        }

        if (cast.skill.flipSkillId != null) armSkillFlip(flips, cast.skill.flipSkillId, runtime.time);
        runtime.effects.emit({
          kind: 'packet',
          event: { ...guardianCastCause(runtime, cast), type: 'sigil_swap', weaponSet: runtime.activeWeaponSet }
        });
        runtime.scheduleForCast(EQUIP, canonicalTime(runtime.time + 0.001), cast);
      }
    },
    'guardian.hammer-aura'(runtime, context) {
      if (context.kind === 'effect')
        grantLuminaryAura(runtime, { ...context.trigger.event, type: 'combo', duration: undefined });
    }
  },
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
    return skill.id === ID.GLARING_BURST ? glaringBurstDuration(runtime, skill, duration) : duration;
  },
  castDetail(runtime, cast) {
    return cast.skill.id === ID.GLARING_BURST ? glaringBurstDetail(runtime) : undefined;
  },
  onCastStart(runtime, cast) {
    if (cast.cancelled) return;
    startLuminaryEffects(runtime, cast);
    if (VIRTUES.includes(Number(cast.skill.id))) {
      refreshGuardianVirtues(runtime);
      const virtue = guardianVirtueForSlot(cast.skill.slot)!;
      if (runtime.profession.core.virtueReadyAt[virtue] <= runtime.time) readyVirtues.add(cast);
    }

    startRadiantArmaments(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    if (!VIRTUES.includes(Number(cast.skill.id))) return;
    const virtue = guardianVirtueForSlot(cast.skill.slot)!;
    refreshGuardianVirtues(runtime);
    if (readyVirtues.has(cast)) {
      applyGuardianVirtueActivationTraits(runtime, cast, virtue);
      if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
    }

    completeMasterAtArms(runtime, cast);
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      countEffulgentHit(runtime, event, (details as NativeResolvedDamageDetails).hitContext?.damage ?? 0);
      refreshGuardianVirtues(runtime);
      reactToJusticeHitWithOptions(runtime, event, details, {
        skillId: ID.RADIANT_JUSTICE,
        skillName: 'Radiant Justice',
        passiveBurnDuration: 2
      });
    },
    'aura.applied'(runtime, event) {
      if (event.aura === 'Light Aura') grantLuminaryAura(runtime, event);
    }
  },
  tasks: {
    ...luminaryEffectTasks,
    [EXIT](runtime, data) {
      if (luminaryState.from(runtime).forgeActivationId === data) exitForge(runtime);
    },
    [EQUIP]: completeLuminaryEquipTraits,
    [HAMMER]: hammerImpact,
    [BLADE_IMMOBILIZE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast<GuardianSkill> };
      runtime.effects.emit({
        kind: 'profile',
        profile: requireBalanceProfileFromContext(runtime, PROFILE.radiantCourageImmobilize),
        attribution: guardianCastCause(runtime, cast),
        transform: (event) => ({ ...event, offTarget: cast.command.offTarget === true })
      });
    },
    [BOON](runtime, data) {
      const { cast, kind, duration, party } = data as {
        cast: RuntimeCast<GuardianSkill>;
        kind: string;
        duration: number;
        party?: boolean;
      };
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...guardianCastCause(runtime, cast),
          priority: kind === 'guardian-radiant-courage-sword' ? -5 : 0,
          kind,
          duration,
          stacks: 1,
          audience: { recipients: party ? 'party' : 'self' }
        }
      });
    }
  }
};
