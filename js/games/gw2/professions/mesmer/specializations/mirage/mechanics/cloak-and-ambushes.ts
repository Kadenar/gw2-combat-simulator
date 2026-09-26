import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/** Mirage-owned cloak, ambush, and deception behavior. */
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { BalanceProfile, ConditionEffect, StatusEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MIRAGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerAmbushAttack
} from '#gw2/professions/mesmer/types.js';
import type {
  MesmerMirageCloakOptions,
  MesmerMirageController
} from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type {
  MesmerClone,
  MesmerCloneAttack,
  MesmerQueueResources
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

import type { MesmerConditionApplication, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';

interface MirageActionControllerOptions {
  readonly state: MesmerRuntime;
  readonly config: MesmerRuntime['config'];
  readonly traits: ReadonlySet<number>;
  readonly ambushAttacks: Readonly<Record<string, MesmerAmbushAttack>>;
  readonly cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
  readonly skillsById: ReadonlyMap<SkillId, MesmerSkill>;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
  readonly balanceProfile: (id: SkillId) => BalanceProfile | undefined;
  readonly reduceSkillRecharge: (skill: MesmerSkill, reduction: number, at: number) => number;
}

/**
 * Owns Mirage cloak, ambush, and shatter reactions.
 */
export function createMirageActionController({
  state,
  config,
  traits,
  ambushAttacks,
  cloneAttacks,
  skillsById,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  activePrimaryWeapon,
  queueResources,
  balanceProfile,
  reduceSkillRecharge
}: MirageActionControllerOptions): MesmerMirageController {
  // The selected effect already owns its identity and validated balance values.
  const statusFromEffect = (effect: ConditionEffect | StatusEffect): MesmerConditionApplication => ({
    name: String(effect.condition ?? effect.boon),
    duration: effect.duration,
    stacks: effect.stacks
  });

  // Ground mirrors use exact half-open pickup windows; skill metadata owns any creation delay.
  const createMirrors = (at: number, count: number, source: string) => {
    const mechanicsProfile = requireBalanceProfileFromContext(balanceProfile, PROFILE.mechanics);
    const mirror = requireEffect(mechanicsProfile, 'buff', 'mirage-mirror');
    if (!mirror) return;
    at = canonicalTime(at);
    for (let index = 0; index < Math.max(0, count); index += 1) {
      mirageState.from(state).mirrors.push({
        availableAt: at,
        expiresAt: canonicalTime(at + Number(mirror.duration)),
        source
      });
      state.schedule('mesmer.mirror-expire', canonicalTime(at + Number(mirror.duration)), undefined);
    }
  };

  // Adds a boon to the event log at the specified time, with the given source skill and actor type, optionally for party recipients.
  const addBoon = (
    at: number,
    boon: MesmerConditionApplication,
    sourceSkill: string,
    actorType: 'player' | 'summon' = 'player',
    recipients: 'self' | 'party' = 'self'
  ) => {
    const boonRecipients = actorType === 'summon' ? 'party' : recipients;
    addEvent({
      type: 'buff',
      at,
      source: actorType === 'summon' ? 'Clone' : 'Player',
      actorType,
      kind: String(boon.name || '').toLowerCase(),
      stacks: Number(boon.stacks),
      duration: Number(boon.duration),
      skillName: sourceSkill,
      sourceSkill,
      audience: {
        recipients: boonRecipients,
        ...(boonRecipients === 'party' ? { maximumRecipients: 5 } : {})
      }
    });
  };

  const addAmbushVulnerability = (at: number, ambush: MesmerAmbushAttack) => {
    if (!ambush.vulnerability) return;
    // Ambush Vulnerability uses the canonical condition envelope and application metadata.
    addCondition(
      ambush.name,
      at,
      {
        name: 'Vulnerability',
        stacks: ambush.vulnerability.stacks,
        duration: ambush.vulnerability.duration
      },
      'Player',
      '',
      { source: 'Player', sourceId: ambush.id, skillId: ambush.id, actorType: 'player' }
    );
  };

  // Executes clone ambush attacks at the specified time, optionally for a given set of clones.
  const executeCloneAmbushes = (at: number, clones: readonly MesmerClone[] = professionCoreState(state).clones) => {
    if (!traits.has(TRAIT.INFINITE_HORIZON) || !clones.length) return;
    addTraitProc(
      'Infinite Horizon',
      at,
      activePrimaryWeapon(),
      `${clones.length} clone${clones.length === 1 ? '' : 's'}`
    );
    for (const clone of clones) {
      const weapon = clone.weapon || activePrimaryWeapon();
      const ambush = ambushAttacks[weapon];
      if (!ambush) continue;
      const attack = cloneAttacks[weapon] || cloneAttacks.Sword;
      // Keep catalog identity on summon packets so ownership, rather than a synthetic skill ID, separates actors.
      const pseudo = {
        id: ambush.id,
        name: ambush.name,
        weapon,
        blade: false
      };
      // Explicit summon ownership keeps clone ambush packets independent of their display labels.
      const impactAt = at + Number(ambush.clone.castTimeMs || 0) / 1000;
      // Clone ambushes use the weapon's authored control and retain summon ownership.
      const skill = skillsById.get(ambush.id);
      for (const effect of skill?.effects || []) {
        if (effect.type !== 'control') continue;
        for (const application of materializeSkillEffectApplications({
          skill: skill!,
          effect,
          start: at,
          fullEnd: impactAt,
          baseEvent: {
            source: 'Clone',
            sourceId: ambush.id,
            skillId: ambush.id,
            skillName: ambush.name,
            actorType: 'summon',
            summonKind: 'clone',
            metadata: { cloneId: clone.id }
          }
        }))
          addEvent({ ...application.event, summonKind: 'clone' });
      }

      if (ambush.clone.type === 'strike')
        addDamage(
          pseudo,
          ambush.clone.ticks?.length ? at : impactAt,
          {
            ...(ambush.clone.ticks?.length
              ? {
                  ticks: ambush.clone.ticks,
                  timingAnchor: 'castStart' as const,
                  timingScale: 'fixed' as const
                }
              : {
                  ...ambush.clone,
                  name: undefined,
                  summonKind: undefined
                }),
            source: 'Clone'
          },
          {
            metadata: { cloneId: clone.id },
            weaponStrength: attack.weaponStrength,
            source: 'Clone',
            actorType: 'summon',
            summonKind: 'clone',
            name: `${ambush.name} — Clone`
          }
        );
      for (const condition of ambush.clone.conditions || []) {
        addCondition(`${ambush.name} — Clone`, impactAt, condition, 'Clone', '', {
          metadata: { cloneId: clone.id },
          skillId: ambush.id,
          actorType: 'summon',
          summonKind: 'clone'
        });
      }

      for (const boon of ambush.clone.boons || []) {
        addBoon(impactAt, boon, `${ambush.name} — Clone`, 'summon');
      }
    }
  };

  // Refresh the exact ambush deadline without shortening an existing window or snapping it to a buff tick.
  const grantAmbushWindow = (
    at: number,
    source: string,
    duration = balanceProfileNumber(
      requireBalanceProfileFromContext(balanceProfile, PROFILE.mechanics),
      'durationPerTier'
    )
  ) => {
    if (config.specialization !== 'Mirage') return;
    at = canonicalTime(at);
    mirageState.from(state).ambushUntil = Math.max(mirageState.from(state).ambushUntil, canonicalTime(at + duration));
    mirageState.from(state).ambushSource = source;
    addEvent({
      type: 'marker',
      at,
      name: 'Ambush Window',
      detail: `${source} (${duration}s)`
    });
  };

  // Reduces the recharge of Mind Wrack and Cry of Frustration by 1 second if the Dune Cloak trait is present.
  const reduceDuneCloakShatters = (at: number, source: string) => {
    if (!traits.has(TRAIT.DUNE_CLOAK)) return;
    for (const id of [ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION]) {
      const shatter = skillsById.get(id);
      const readyAt = shatter ? state.cooldowns.get(shatter.id) : null;
      if (shatter && readyAt != null) {
        const duneCloakProfile = requireBalanceProfileFromContext(balanceProfile, PROFILE.duneCloak);
        reduceSkillRecharge(shatter, balanceProfileNumber(duneCloakProfile, 'rechargeReduction'), at);
      }
    }

    addTraitProc('Dune Cloak', at, source, 'Mind Wrack and Cry of Frustration recharge reduced by 1s');
  };

  // Grants Mirage Cloak at the specified time
  const grantMirageCloak = (
    at: number,
    source: string,
    {
      duration = balanceProfileNumber(
        requireBalanceProfileFromContext(balanceProfile, PROFILE.mechanics),
        'durationMultiplier'
      ),
      grantCloneCloak = true
    }: MesmerMirageCloakOptions = {}
  ) => {
    if (config.specialization !== 'Mirage') return;
    at = canonicalTime(at);
    grantAmbushWindow(at, source);
    addEvent({
      type: 'buff',
      at,
      kind: 'mirage-cloak',
      stacks: 1,
      duration,
      sourceSkill: source
    });
    const renewingOasis = traits.has(TRAIT.RENEWING_OASIS)
      ? requireEffect(requireBalanceProfileFromContext(balanceProfile, PROFILE.renewingOasis), 'boon', 'regeneration')
      : undefined;
    if (renewingOasis) {
      addBoon(at, statusFromEffect(renewingOasis), source);
      addTraitProc('Renewing Oasis', at, source, '4s regeneration');
    }

    if (traits.has(TRAIT.ELUSIVE_MIND)) {
      const elusiveMindProfile = requireBalanceProfileFromContext(balanceProfile, PROFILE.elusiveMind);
      addTraitProc(
        'Elusive Mind',
        at,
        source,
        `${balanceProfileNumber(elusiveMindProfile, 'maximumStacks')} conditions removed`
      );
    }

    reduceDuneCloakShatters(at, source);
    if (grantCloneCloak && traits.has(TRAIT.INFINITE_HORIZON)) {
      mirageState.from(state).cloneAmbushUntil = canonicalTime(at + duration);
      executeCloneAmbushes(at, professionCoreState(state).clones);
    }
  };

  // Executes a player ambush attack at the specified time
  const executePlayerAmbush = (skill: MesmerSkill, at: number, castStart = at) => {
    // The ambush keeps the weapon selected when its cast began, even if the
    // rotation swaps weapons before completion mechanics are dispatched.
    const weapon = skill.weapon || activePrimaryWeapon();
    const ambush = ambushAttacks[weapon];
    if (!ambush || skill.id !== ambush.id) return;
    // Player ambushes retain their catalog ID so hit-driven traits can resolve the weapon skill.
    const pseudo = {
      id: ambush.id,
      name: ambush.name,
      weapon,
      blade: false
    };
    const impactAt = ambush.player.damageAtMs == null ? at : castStart + Number(ambush.player.damageAtMs) / 1000;
    // Packetized ambushes resolve each hit and its repeated statuses at the measured beam timestamps.
    const statusAtMs = ambush.player.ticks?.map((tick) => tick.atMs) ?? ambush.player.statusAtMs;
    const impactTimes = statusAtMs?.length ? statusAtMs.map((atMs) => castStart + atMs / 1000) : [impactAt];
    if (ambush.player.ticks?.length) {
      addDamage(pseudo, castStart, {
        ticks: ambush.player.ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'Player'
      });
    } else if (ambush.player.type === 'strike') {
      addDamage(pseudo, impactAt, {
        ...ambush.player,
        name: undefined,
        summonKind: undefined,
        source: 'Player'
      });
    }

    for (const condition of ambush.player.conditions || []) {
      addCondition(ambush.name, impactAt, condition);
    }

    const riddleOfSand =
      mirageState.from(state).riddleOfSandReady && traits.has(TRAIT.RIDDLE_OF_SAND)
        ? requireEffect(
            requireBalanceProfileFromContext(balanceProfile, PROFILE.riddleOfSand),
            'condition',
            'Confusion'
          )
        : undefined;
    if (riddleOfSand) {
      addCondition(ambush.name, impactAt, statusFromEffect(riddleOfSand), 'Player', `${ambush.name} — Riddle of Sand`);
      addTraitProc('Riddle of Sand', impactAt, ambush.name, '2 confusion');
      mirageState.from(state).riddleOfSandReady = false;
    }

    for (const boon of ambush.player.boons || []) {
      for (const packetAt of impactTimes) {
        addBoon(packetAt, boon, ambush.name, 'player', ambush.id === ID.CHAOS_VORTEX ? 'party' : 'self');
      }
    }

    const mirageMantle = traits.has(TRAIT.MIRAGE_MANTLE)
      ? requireEffect(requireBalanceProfileFromContext(balanceProfile, PROFILE.mirageMantle), 'boon', 'alacrity')
      : undefined;
    if (mirageMantle) {
      addBoon(impactAt, statusFromEffect(mirageMantle), ambush.name, 'player', 'party');
      addTraitProc('Mirage Mantle', impactAt, ambush.name, '4s alacrity');
    }

    for (const packetAt of impactTimes) {
      addAmbushVulnerability(packetAt, ambush);
    }

    if (ambush.createsClone) {
      queueResources(impactAt, 1, weapon, ambush.name, {
        sourceSkillId: skill.id
      });
    }

    mirageState.from(state).ambushUntil = 0;
    mirageState.from(state).ambushSource = '';
  };

  // Handles Mirage-only shatter effects after Core resolves the shared shatter packet and resource spend.
  const handleMirageShatter = (skill: MesmerSkill, at: number, spent: number) => {
    if (config.specialization !== 'Mirage') return;
    if (
      traits.has(TRAIT.RIDDLE_OF_SAND) &&
      requireEffect(requireBalanceProfileFromContext(balanceProfile, PROFILE.riddleOfSand), 'condition', 'Confusion')
    ) {
      mirageState.from(state).riddleOfSandReady = true;
      addTraitProc('Riddle of Sand', at, skill.name, 'ambush primed');
    }

    const nominalEndurance = traits.has(TRAIT.NOMADS_ENDURANCE)
      ? requireEffect(requireBalanceProfileFromContext(balanceProfile, PROFILE.nominalEndurance), 'boon', 'vigor')
      : undefined;
    if (nominalEndurance) {
      addBoon(at, statusFromEffect(nominalEndurance), skill.name);
      addTraitProc("Nomad's Endurance", at, skill.name, '3s vigor');
    }

    if (traits.has(TRAIT.PHANTOM_PAIN)) {
      const phantomPainProfile = requireBalanceProfileFromContext(balanceProfile, PROFILE.phantomPain);
      addEvent({
        type: 'buff',
        at,
        // Phantom Pain starts after the same-time shatter packets resolve.
        priority: 5,
        kind: 'phantom-pain',
        stacks: Math.min(balanceProfileNumber(phantomPainProfile, 'maximumStacks'), spent + 1),
        duration: balanceProfileNumber(phantomPainProfile, 'durationMultiplier')
      });
      addTraitProc('Phantom Pain', at, skill.name);
    }

    if (skill.id === ID.DISTORTION && traits.has(TRAIT.DESERT_DISTORTION)) {
      grantAmbushWindow(at, 'Desert Distortion');
      const desertDistortionProfile = requireBalanceProfileFromContext(balanceProfile, PROFILE.desertDistortion);
      createMirrors(at, spent * balanceProfileNumber(desertDistortionProfile, 'resourceGain'), 'Desert Distortion');
      addTraitProc('Desert Distortion', at, skill.name, `${spent} Mirage Mirror${spent === 1 ? '' : 's'} created`);
    }

    if (
      traits.has(TRAIT.DUNE_CLOAK) &&
      spent >= balanceProfileNumber(requireBalanceProfileFromContext(balanceProfile, PROFILE.duneCloak), 'threshold')
    ) {
      const duneCloakProfile = requireBalanceProfileFromContext(balanceProfile, PROFILE.duneCloak);
      grantMirageCloak(at, 'Dune Cloak', {
        duration: balanceProfileNumber(duneCloakProfile, 'durationMultiplier')
      });
    }
  };

  // Attempts to pick up a Mirage Mirror at the given time, applying damage and granting Mirage Cloak if successful.
  const pickUpMirror = (at: number, source: string) => {
    const mirrors = mirageState.from(state).mirrors;
    const index = mirrors.findIndex((mirror) => isTimeInWindow(at, mirror.availableAt, mirror.expiresAt));
    if (index < 0) return false;
    mirrors.splice(index, 1);
    const pseudo = {
      id: ID.MIRAGE_MIRROR_DAMAGE,
      name: 'Mirage Mirror',
      weapon: activePrimaryWeapon(),
      blade: false
    };
    const mechanicsProfile = requireBalanceProfileFromContext(balanceProfile, PROFILE.mechanics);
    const strike = requireEffect(mechanicsProfile, 'strike', 'Strike');
    if (strike)
      addDamage(pseudo, at, {
        ...strike,
        name: undefined,
        summonKind: undefined,
        source: 'Player'
      });
    // Only a consumed, available mirror applies its authored Weakness.
    const weakness = requireEffect(mechanicsProfile, 'condition', 'Weakness');
    if (weakness)
      addCondition(pseudo.name, at, statusFromEffect(weakness), 'Player', '', {
        skillId: pseudo.id,
        sourceId: pseudo.id,
        actorType: 'player'
      });
    grantMirageCloak(at, source);
    return true;
  };

  return {
    createMirrors,
    executeCloneAmbushes,
    executePlayerAmbush,
    grantMirageCloak,
    handleMirageShatter,
    pickUpMirror
  };
}
