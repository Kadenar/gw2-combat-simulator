import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/mesmer/specializations/troubadour/profiles.js';
import { troubadourState } from '#gw2/content/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerSchedulerContext, MesmerSkill } from '#gw2/content/professions/mesmer/types.js';

interface TroubadourTaleInvocation {
  readonly context: MesmerSchedulerContext;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly castStart: number;
}

const TALE_PROFILE_IDS: Readonly<Record<number, string>> = Object.freeze({
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: PROFILE.honorableRogue,
  [ID.TALE_OF_THE_SOULKEEPER]: PROFILE.soulkeeper,
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: PROFILE.valiantMarshal
});

const TALE_INSTRUMENTS: Readonly<Record<number, string>> = Object.freeze({
  [ID.TALE_OF_THE_SOULKEEPER]: 'Lute',
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: 'Drum',
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: 'Harp',
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: 'Flute'
});

/** Restores one Troubadour dodge charge, the scheduler representation of 50 endurance. */
function restoreHonorableRogueEndurance(context: MesmerSchedulerContext, at: number): void {
  const runtime = mesmerRuntimeFor(context);
  const dodge = runtime.skillsById.get(ID.DODGE_TROUBADOUR);
  const ammo = dodge ? context.cooldownController.refreshAmmo(dodge, at) : null;
  if (!dodge || !ammo || ammo.charges >= ammo.maximum) return;
  ammo.charges += 1;
  if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
  context.state.cooldowns.delete(dodge.id);
}

/** Resolves a Tale's profile boons, matching-instrument note, and Troubadour trait effects together. */
export function resolveTroubadourTale({ context, skill, at, castStart }: TroubadourTaleInvocation): void {
  const runtime = mesmerRuntimeFor(context);
  const profileId = TALE_PROFILE_IDS[skill.id];
  const profile = profileId ? runtime.balanceProfile(profileId) : null;
  const partyRecipients = { recipients: 'party' as const, maximumRecipients: 5 };

  for (const boon of (profile?.effects || []).filter((effect) => effect.type === 'boon')) {
    runtime.addEvent({
      type: 'buff',
      at,
      kind: String(boon.boon || ''),
      stacks: Number(boon.stacks || 1),
      duration: gw2SchedulerBoonDuration(context, skill, String(boon.boon || ''), Number(boon.duration || 0)),
      skillName: skill.name,
      sourceSkill: skill.name,
      ...partyRecipients
    });
  }

  const requiredInstrument = TALE_INSTRUMENTS[skill.id];
  if (requiredInstrument && Number(troubadourState.from(context).instruments[requiredInstrument] || 0) > castStart) {
    runtime.resources.queueResources(
      at + context.epsilon,
      Number(profile?.resourceGain || 1),
      runtime.activePrimaryWeapon(),
      skill.name
    );
  }

  if (skill.id === ID.TALE_OF_THE_HONORABLE_ROGUE) {
    restoreHonorableRogueEndurance(context, at);
  }

  if (runtime.traits.has(TRAIT.RACONTEUR)) {
    const protection = runtime.balanceProfile(TRAIT.RACONTEUR)?.effects?.find((effect) => effect.type === 'boon');
    runtime.addEvent({
      type: 'buff',
      at,
      kind: String(protection?.boon || 'protection'),
      stacks: Number(protection?.stacks || 1),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        String(protection?.boon || 'protection'),
        Number(protection?.duration || 3)
      ),
      skillName: skill.name,
      sourceSkill: skill.name,
      ...partyRecipients
    });
    runtime.addTraitProc('Raconteur', at, skill.name);
  }
}
