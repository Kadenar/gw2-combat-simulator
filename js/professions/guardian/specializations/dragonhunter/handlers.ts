import { augmentSkill } from '../../../../platform/gw2/authoring/mechanics.js';
import { GUARDIAN_SKILL_IDS as ID } from '../../data/ids.js';
import { emitGuardianEvent } from '../../core/events.js';
import { guardianVirtueSkillHandlers } from '../../core/virtues.js';
import type { GuardianCastContext, GuardianSkill } from '../../types.js';
import type { SimulationEvent } from '../../../../platform/engine/types.js';
import { dragonhunterState } from './state.js';
import { applySoaringDevastation, bigGameHunterTetherDuration } from './traits.js';
import { gw2PrimaryWeapon } from '../../../../platform/gw2/equipment/weapons/loadout.js';

function activePrimaryWeapon(context: GuardianCastContext): string {
  // Soaring Devastation's strike uses the active weapon's power scaling, so
  // we must resolve which weapon set is live at cast time rather than always using set 1.
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  return String(gw2PrimaryWeapon(context.config, weaponSet) || gw2PrimaryWeapon(context.config, 1) || '');
}

function activateDragonhunterVirtue(context: GuardianCastContext, skill: GuardianSkill): boolean {
  // Delegates virtue state transitions to the shared core handler first,
  // then appends Dragonhunter-specific logic only for Wings of Resolve.
  guardianVirtueSkillHandlers['guardian.virtue'](context, skill);
  if (skill.id !== ID.WINGS_OF_RESOLVE) return false;
  applySoaringDevastation(context, skill, activePrimaryWeapon(context));
  return false;
}

function activateSpearOfJustice(context: GuardianCastContext, skill: GuardianSkill): boolean {
  const at = context.effectiveEnd;
  const tetherDuration = bigGameHunterTetherDuration(context);
  const tetherUntil = at + tetherDuration;
  // Write tetherUntil to scheduler state now so modifier rules that read it
  // during the same advance tick see the correct window immediately.
  dragonhunterState.from(context).tetherUntil = tetherUntil;

  emitGuardianEvent(context, skill, 'guardian.dragonhunter-tethered', {
    at,
    tetherUntil
  });
  // All pulses are scheduled up-front for the entire tether window; the resolver
  // discards any that fall after Hunter's Verdict breaks the tether early.
  for (let index = 0; index < tetherDuration; index += 1) {
    emitGuardianEvent(context, skill, 'guardian.dragonhunter-justice-pulse', {
      at: at + index,
      applicationIndex: index + 1,
      totalApplications: tetherDuration
    });
  }

  return true;
}

function prepareSpearOfJustice(context: GuardianCastContext, skill: GuardianSkill): boolean {
  guardianVirtueSkillHandlers['guardian.virtue'](context, skill);
  return false;
}

function decorateSpearOfJusticeStrike(
  context: GuardianCastContext,
  _skill: GuardianSkill,
  event: SimulationEvent
): void {
  if (event.type !== 'damage') return;
  context.replaceEvent(event, {
    skillWeapon: activePrimaryWeapon(context)
  });
}

function activateHuntersVerdict(context: GuardianCastContext, skill: GuardianSkill): boolean {
  // Collapses the tether window to the current cast end so the resolver skips
  // any pre-emitted justice pulses that would have fired after this point.
  dragonhunterState.from(context).tetherUntil = context.effectiveEnd;
  emitGuardianEvent(context, skill, 'guardian.dragonhunter-tether-broken');
  return false;
}

export const dragonhunterSkillHandlers = Object.freeze({
  // replaceSkill: handler fully owns the emitted event profile (no declarative effects run)
  'guardian.dragonhunter-justice': augmentSkill({
    beforeEffects: prepareSpearOfJustice,
    afterEffect: decorateSpearOfJusticeStrike,
    afterEffects: activateSpearOfJustice
  }),
  // augmentSkill: handler runs then the skill's declarative effects also run
  'guardian.dragonhunter-virtue': augmentSkill({
    beforeEffects: activateDragonhunterVirtue
  }),
  'guardian.hunters-verdict': augmentSkill({
    beforeEffects: activateHuntersVerdict
  })
});
