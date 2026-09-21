import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import {
  emitGuardianProc,
  guardianTraitIcon,
  isGuardianSymbolSkill
} from '#gw2/professions/guardian/core/traits/shared.js';
import type { GuardianCastContext, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Committed heals create a pulsing Light symbol, sharing one fixed ICD across healing skills. */
export function applyProtectorsRestoration(context: GuardianCastContext, skill: GuardianSkill, at: number): void {
  if (skill.type !== 'Heal' || !hasTrait(context, GUARDIAN_TRAIT_IDS.PROTECTORS_RESTORATION)) return;
  const state = professionCoreState(context);
  if (!isInternalCooldownReady(at, state.protectorsRestorationReadyAt)) return;

  const profile = balanceProfileFromContext(context, PROFILE.protectorsRestoration);
  const strike = balanceProfileEffect(profile, 'strike');
  const protection = balanceProfileEffect(profile, 'boon');
  const ticks = strike?.ticks;
  if (!ticks?.length) throw new Error("Protector's Restoration requires an explicit strike timeline.");
  state.protectorsRestorationReadyAt = at + Number(profile?.internalCooldown ?? 20);
  const symbol = { id: GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION, name: 'Lesser Symbol of Protection' };
  const activationId = context.createActivationId('effect');
  for (const [index, tick] of ticks.entries()) {
    const pulseAt = at + Number(tick.atMs) / 1000;
    context.emit(
      buildGuardianStrike({
        at: pulseAt,
        sourceId: symbol.id,
        skillId: symbol.id,
        skillName: symbol.name,
        name: symbol.name,
        coefficient: Number(tick.coefficient),
        skillWeapon: 'Unequipped',
        activationId,
        hitIndex: index + 1,
        totalHits: ticks.length,
        isSymbol: true,
        // Keep the Light field available from placement through the final pulse.
        comboFields:
          index === 0
            ? [{ ownerId: 'guardian', fieldType: 'Light', duration: Number(ticks.at(-1)!.atMs) / 1000 }]
            : undefined,
        triggeredBy: skill.name
      })
    );
    emitSkillBuff(context, symbol, {
      at: pulseAt,
      source: 'guardian',
      kind: 'protection',
      duration: Number(protection?.duration ?? 1),
      stacks: Number(protection?.stacks ?? 1),
      activationId,
      audience: { recipients: 'party' },
      triggeredBy: skill.name
    });
  }

  emitGuardianProc(context, {
    name: symbol.name,
    at,
    sourceSkill: skill.name,
    detail: "Protector's Restoration",
    icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.PROTECTORS_RESTORATION)
  });
}

/** Extends supported symbols with Writ of Persistence's field and extra pulses. */
export function applyWritOfPersistence(context: GuardianCastContext, skill: GuardianSkill): void {
  if (!isGuardianSymbolSkill(skill) || !hasTrait(context, GUARDIAN_TRAIT_IDS.WRIT_OF_PERSISTENCE)) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.writOfPersistence);
  const extension = Number(balanceProfileEffect(profile, 'buff')?.duration ?? 2);
  const strikeEffects = (skill.effects || []).filter((effect) => effect.type === 'strike');
  const field = skill.comboFields?.[0];
  if (!field) return;
  const fieldStart =
    (field?.startAnchor === 'castEnd' ? context.fullEnd : context.start) + Number(field?.startMs || 0) / 1000;
  const fieldEnd = fieldStart + Number(field?.duration || 0);
  const strikePackets = (profile?.effects || [])
    .filter((effect) => effect.type === 'strike')
    .flatMap((effect) =>
      (effect.ticks || []).map((tick) => ({
        atMs: Number(tick.atMs),
        coefficient: Number(tick.coefficient)
      }))
    );
  const might = balanceProfileEffect(profile, 'boon');

  // Writ adds a contiguous field segment because the original field is already active when cast-state hooks run.
  context.emit({
    type: 'combo_field',
    at: fieldEnd,
    source: 'guardian',
    sourceId: skill.id,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    activationId: context.action.activationId,
    fieldId: `guardian:${String(context.action.activationId)}:writ-extension`,
    fieldType: field?.fieldType || 'Light',
    expiresAt: fieldEnd + extension,
    ownerId: field?.ownerId || 'guardian',
    ownerActorType: 'player',
    triggeredBy: 'Writ of Persistence'
  });

  if (skill.id !== GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT) {
    const pulseEffect = strikeEffects.filter((effect) => strikeEffectTicks(effect).length > 1).at(-1);
    if (!pulseEffect) return;
    const pulseTicks = strikeEffectTicks(pulseEffect);
    const lastPulse = pulseTicks.at(-1)!;
    const pulseOrigin = pulseEffect.timingAnchor === 'castStart' ? context.start : context.fullEnd;
    const lastPulseAt = pulseTicks.length >= 5 ? fieldEnd : pulseOrigin + Number(lastPulse.atMs) / 1000;
    // Writ adds two one-second symbol pulses while the extended field remains active.
    for (let index = 1; index <= 2; index += 1) {
      context.emit(
        buildGuardianStrike({
          at: lastPulseAt + index,
          sourceId: skill.id,
          skillId: skill.id,
          skillName: skill.name,
          name: pulseEffect.name || skill.name,
          coefficient: Number(lastPulse.coefficient),
          skillWeapon: skill.weapon || '',
          hitIndex: pulseTicks.length + index,
          totalHits: pulseTicks.length + 2,
          isSymbol: true,
          triggeredBy: 'Writ of Persistence'
        })
      );
    }

    return;
  }

  for (let index = 0; index < strikePackets.length; index += 1) {
    const packet = strikePackets[index];
    context.emit(
      buildGuardianStrike({
        at: context.start + packet.atMs / 1000,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        name: skill.name,
        coefficient: packet.coefficient,
        skillWeapon: 'Scepter',
        hitIndex: 12 + index,
        totalHits: 11 + strikePackets.length,
        isSymbol: true,
        triggeredBy: 'Writ of Persistence'
      })
    );
  }

  for (let index = 0; index < Number(might?.applications ?? 2); index += 1) {
    emitSkillBuff(context, skill, {
      at: context.start + (Number(might?.atMs ?? 5240) + index * Number(might?.intervalMs ?? 1000)) / 1000,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'might',
      duration: Number(might?.duration ?? 5),
      stacks: Number(might?.stacks ?? 4),
      audience: { recipients: 'party' as const },
      triggeredBy: 'Writ of Persistence'
    });
  }
}
