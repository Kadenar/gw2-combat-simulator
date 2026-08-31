import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildGuardianStrike } from '#gw2/content/professions/guardian/core/mechanics/event-handlers.js';
import {
  GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE,
  guardianBalanceProfile,
  guardianBalanceProfileEffect
} from '#gw2/content/professions/guardian/core/profiles.js';
import type { GuardianCastContext, GuardianSkill } from '#gw2/content/professions/guardian/types.js';

/** Extends Symbol of Punishment with Writ of Persistence's field, strikes, and party Might. */
export function applyWritOfPersistence(context: GuardianCastContext, skill: GuardianSkill): void {
  if (
    skill.id !== GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.WRIT_OF_PERSISTENCE)
  ) {
    return;
  }

  const profile = guardianBalanceProfile(context, PROFILE.writOfPersistence);
  const extension = Number(guardianBalanceProfileEffect(profile, 'buff')?.duration || 2);
  const field = skill.comboFields?.[0];
  const fieldStart = context.start + Number(field?.startMs || 0) / 1000;
  const fieldEnd = fieldStart + Number(field?.duration || 0);
  const strikePackets = (profile?.effects || [])
    .filter((effect) => effect.type === 'strike')
    .flatMap((effect) =>
      (effect.ticks || []).map((tick) => ({
        atMs: Number(tick.atMs),
        coefficient: Number(tick.coefficient)
      }))
    );
  const might = guardianBalanceProfileEffect(profile, 'boon');

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
        hitIndex: 13 + index,
        totalHits: 12 + strikePackets.length,
        isSymbol: true,
        triggeredBy: 'Writ of Persistence'
      })
    );
  }

  for (let index = 0; index < Number(might?.applications || 2); index += 1) {
    emitSkillBuff(context, skill, {
      at: context.start + (Number(might?.atMs || 5240) + index * Number(might?.intervalMs || 1000)) / 1000,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'might',
      duration: Number(might?.duration || 5),
      stacks: Number(might?.stacks || 4),
      recipients: 'party',
      triggeredBy: 'Writ of Persistence'
    });
  }
}
