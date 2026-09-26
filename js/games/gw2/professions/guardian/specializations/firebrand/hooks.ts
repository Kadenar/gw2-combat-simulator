import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { applyGuardianVirtueActivationTraits } from '#gw2/professions/guardian/core/hooks.js';
import { emitGuardianBoon, triggerGuardianFuriousFocus } from '#gw2/professions/guardian/core/traits/index.js';
import { recordGuardianTraitProc } from '#gw2/professions/guardian/core/traits/shared.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';
import { firebrandPageTuning, firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { reactToFirebrandJusticeHit } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import {
  completeFirebrandMantra,
  FIREBRAND_MANTRA_WAKE,
  initializeFirebrandMantras,
  firebrandMantraAvailability,
  firebrandMantraWake,
  refreshFirebrandMantras
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/mantras.js';
import {
  firebrandEffectTasks,
  startFirebrandAshes,
  reactToFirebrandDamage,
  reactToFirebrandBuff,
  reactToFirebrandControl
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const COURAGE = 'guardian.firebrand.courage';
const refundByCast = new WeakMap<RuntimeCast, number>();
const TOMES = new Map<number, GuardianVirtue>([
  [ID.TOME_OF_JUSTICE, 'justice'],
  [ID.TOME_OF_RESOLVE, 'resolve'],
  [ID.TOME_OF_COURAGE, 'courage']
]);
const DORMANCY = { justice: PROFILE.tomeJustice, resolve: PROFILE.tomeResolve, courage: PROFILE.tomeCourage };

/** Selected boon components use application-time attributes and retain their actual trigger's lineage. */
function boon(
  runtime: Runtime,
  profileId: string | number,
  kind: string,
  cause: Gw2ResolverEvent,
  party = false
): boolean {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const effect = requireEffect(profile, 'boon', kind);
  if (!effect) return false;
  emitGuardianBoon(runtime, {
    ...cause,
    type: 'buff',
    at: runtime.time,
    kind,
    duration: effectNumber(profile, effect, 'duration'),
    stacks: effectNumber(profile, effect, 'stacks'),
    audience: { recipients: party ? 'party' : 'self' }
  });
  return true;
}

function causeFor(runtime: Runtime, cast: RuntimeCast): Gw2ResolverEvent {
  return {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
}

/** Tome reopening changes only the current bar; it cannot restart a dormant passive or duplicate its activation traits. */
function openTome(runtime: Runtime, cast: RuntimeCast, virtue: GuardianVirtue): void {
  const state = firebrandState.from(runtime);
  const ready = state.tomeDormantReadyAt[virtue] <= runtime.time;
  state.activeTome = virtue;
  if (state.swiftScholarTome !== virtue) {
    state.swiftScholarTome = virtue;
    state.swiftScholarCount = 0;
  }

  if (ready) {
    const multiplier = hasTrait(runtime, TRAIT.POWER_OF_THE_VIRTUOUS)
      ? balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, CORE_PROFILE.powerOfTheVirtuous),
          'rechargeMultiplier'
        )
      : 1;
    state.tomeDormantReadyAt[virtue] = canonicalTime(
      runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, DORMANCY[virtue]), 'cooldown') * multiplier
    );
    runtime.profession.core.virtueReadyAt[virtue] = state.tomeDormantReadyAt[virtue];
    applyGuardianVirtueActivationTraits(runtime, cast, virtue);
    if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
    if (boon(runtime, PROFILE.swiftScholar, 'quickness', causeFor(runtime, cast)))
      recordGuardianTraitProc(
        runtime,
        TRAIT.SWIFT_SCHOLAR,
        'Swift Scholar',
        runtime.time,
        cast.skill.name,
        'Tome activation'
      );
  }

  runtime.emit({
    ...causeFor(runtime, cast),
    type: 'weapon_set',
    weaponSet: runtime.activeWeaponSet,
    weaponLine: cast.skill.name
  });
}

/** Passive Courage keeps a single fixed cadence; dormancy suppresses individual pulses without shifting the grid. */
function courage(runtime: Runtime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.passiveCourage);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  if (!(interval > 0) || !requireEffect(profile, 'boon', 'aegis')) return;
  if (runtime.profession.core.virtueReadyAt.courage <= runtime.time || hasTrait(runtime, TRAIT.STOIC_DEMEANOR))
    boon(runtime, PROFILE.passiveCourage, 'aegis', {
      type: 'buff',
      at: runtime.time,
      source: 'guardian',
      sourceId: ID.TOME_OF_COURAGE,
      actorType: 'player',
      skillId: ID.TOME_OF_COURAGE,
      skillName: 'Tome of Courage',
      name: 'Tome of Courage — Passive Aegis'
    });
  runtime.schedule(COURAGE, canonicalTime(runtime.time + interval), undefined, undefined, -200);
}

/** Pages, tome sessions, and mantra charges mutate one live state; report events never restore a snapshot. */
export const firebrandHooks: Partial<RuntimeProfession<GuardianRuntimeState>> = {
  resources: {
    tomePages: {
      kind: 'discrete',
      state: (runtime) => firebrandState.from(runtime).tomePages,
      maximum: (runtime) => firebrandPageTuning(runtime).maximum,
      initial: (runtime) => firebrandPageTuning(runtime).initial,
      recovery: (runtime) => ({ interval: firebrandPageTuning(runtime).interval, amount: 1, start: 'first-spend' })
    }
  },
  initialize(runtime) {
    initializeFirebrandMantras(runtime);
    runtime.schedule(COURAGE, runtime.time, undefined, undefined, -200);
  },
  availability(runtime, skill) {
    const state = firebrandState.from(runtime);
    if (skill.type === 'Weapon' && state.activeTome)
      return denyCast('guardian.tome-weapon-lockout', `${skill.name} requires stowing the active tome.`);
    if (skill.id === ID.STOW_TOME && !state.activeTome)
      return denyCast('guardian.tome-inactive', 'Stow Tome requires an active tome.');
    if (skill.tome) {
      if (skill.tome !== state.activeTome)
        return denyCast('guardian.tome-inactive', `${skill.name} requires its tome to be active.`);
      const cost = Math.max(1, Number(skill.pageCost ?? 1));
      if (runtime.resourceController.value('tomePages') < cost) {
        const at = runtime.resourceController.readyAt('tomePages', cost);
        const reason = `${skill.name} requires ${cost} tome pages.`;
        return at == null ? denyCast('guardian.tome-pages', reason) : retryCast(at, 'guardian.tome-pages', reason);
      }

      return CAST_READY;
    }

    return firebrandMantraAvailability(runtime, skill);
  },
  onCastStart(runtime, cast) {
    if (!cast.skill.tome || cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd))
      return;
    startFirebrandAshes(runtime, cast);
    const state = firebrandState.from(runtime);
    if (state.swiftScholarTome !== cast.skill.tome) {
      state.swiftScholarTome = String(cast.skill.tome);
      state.swiftScholarCount = 0;
    }

    state.swiftScholarCount++;
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.swiftScholar);
    if (state.swiftScholarCount >= balanceProfileNumber(profile, 'minimumStacks')) {
      state.swiftScholarCount = 0;
      // A later concurrent stow cannot revoke the refund already earned by this accepted page.
      refundByCast.set(cast, balanceProfileNumber(profile, 'resourceGain'));
    }
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    completeFirebrandMantra(runtime, cast);
    const state = firebrandState.from(runtime);
    const skill = cast.skill;
    const virtue = TOMES.get(Number(skill.id));
    if (virtue) openTome(runtime, cast, virtue);
    if (skill.id === ID.STOW_TOME) {
      state.activeTome = '';
      state.swiftScholarTome = '';
      state.swiftScholarCount = 0;
      runtime.emit({
        ...causeFor(runtime, cast),
        type: 'weapon_set',
        weaponSet: runtime.activeWeaponSet,
        weaponLine: null
      });
    }

    if (skill.tome) {
      runtime.resourceController.spend('tomePages', Math.max(1, Number(skill.pageCost ?? 1)));
      const refund = refundByCast.get(cast) ?? 0;
      if (refund > 0) {
        runtime.resourceController.grant('tomePages', refund);
        recordGuardianTraitProc(
          runtime,
          TRAIT.SWIFT_SCHOLAR,
          'Swift Scholar',
          runtime.time,
          skill.name,
          `+${refund} tome pages`
        );
      }

      if (hasTrait(runtime, TRAIT.LEGENDARY_LORE))
        boon(
          runtime,
          PROFILE.legendaryLore,
          skill.tome === 'justice' ? 'might' : skill.tome === 'resolve' ? 'regeneration' : 'protection',
          { ...causeFor(runtime, cast), sourceId: TRAIT.LEGENDARY_LORE, name: 'Legendary Lore' }
        );
    }

    if (skill.id === ID.RENEWED_FOCUS && castCompleted(cast)) {
      runtime.resourceController.grant('tomePages', state.tomePages.maximum);
      state.tomeDormantReadyAt = { justice: runtime.time, resolve: runtime.time, courage: runtime.time };
    }

    if (
      skill.type === 'Heal' &&
      hasTrait(runtime, TRAIT.LIBERATORS_VOW) &&
      isInternalCooldownReady(runtime.time, state.liberatorsVowReadyAt)
    ) {
      if (boon(runtime, PROFILE.liberatorsVow, 'quickness', causeFor(runtime, cast), true)) {
        state.liberatorsVowReadyAt = canonicalTime(
          runtime.time +
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.liberatorsVow), 'internalCooldown')
        );
        recordGuardianTraitProc(
          runtime,
          TRAIT.LIBERATORS_VOW,
          "Liberator's Vow",
          runtime.time,
          skill.name,
          'Quickness'
        );
      }
    }

    if (
      hasTrait(runtime, TRAIT.WEIGHTY_TERMS) &&
      MANTRAS.some(({ finalId }) => finalId === skill.id) &&
      castCompleted(cast)
    ) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.weightyTerms);
      const gain = balanceProfileNumber(profile, 'resourceGain');
      runtime.resourceController.grant('tomePages', gain);
      const slow = requireEffect(profile, 'condition', 'Slow');
      if (slow)
        runtime.emit(
          buildResolverCondition({
            ...causeFor(runtime, cast),
            sourceId: TRAIT.WEIGHTY_TERMS,
            name: 'Weighty Terms — Slow',
            condition: String(slow.condition),
            stacks: effectNumber(profile, slow, 'stacks'),
            duration: effectNumber(profile, slow, 'duration')
          })
        );
      recordGuardianTraitProc(
        runtime,
        TRAIT.WEIGHTY_TERMS,
        'Weighty Terms',
        runtime.time,
        skill.name,
        `+${gain} tome pages`
      );
    }
  },
  onCooldownReset: refreshFirebrandMantras,
  reactions: {
    'damage.resolved'(runtime, event, details) {
      reactToFirebrandDamage(runtime, event, details as NativeResolvedDamageDetails);
      reactToFirebrandJusticeHit(runtime, event, details as NativeResolvedDamageDetails);
    },
    'buff.applied'(runtime, event) {
      // Executed history is appended after dispatch; reproject once the applied Alacrity window is queryable.
      if (event.kind === 'alacrity') runtime.schedule(FIREBRAND_MANTRA_WAKE, runtime.time);
      reactToFirebrandBuff(runtime, event);
    },
    'control.resolved': reactToFirebrandControl,
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized' || event.condition === 'Slow') reactToFirebrandControl(runtime, event);
    }
  },
  tasks: { ...firebrandEffectTasks, [COURAGE]: courage, [FIREBRAND_MANTRA_WAKE]: firebrandMantraWake }
};
