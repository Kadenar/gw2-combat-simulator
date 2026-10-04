import type { MesmerResourceGain } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import {
  createMesmerResources,
  createMesmerActions,
  mesmerActivePrimaryWeapon
} from '#gw2/professions/mesmer/family-mechanics.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import { buildMesmerConditions, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { statusFromEffect } from '#gw2/professions/mesmer/specializations/mirage/mechanics/boons.js';
import { createMirageMechanics } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type { MesmerAmbushAttack, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Cloak rewards reduce the supported shatters through the shared cooldown controller. */
function reduceDuneCloakShatters(
  state: MesmerRuntime,
  at: number,
  source: string,
  delivery: EffectDelivery = {}
): void {
  if (!hasTrait(state, TRAIT.DUNE_CLOAK)) return;
  for (const id of [ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION]) {
    const shatter = state.helpers.skillsById.get(id);
    const readyAt = shatter ? state.cooldownController.readyAt(shatter.id) : null;
    if (shatter && readyAt != null) {
      const duneCloakProfile = requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK);
      state.cooldownController.reduceSkillRecharge(
        shatter,
        balanceProfileNumber(duneCloakProfile, 'rechargeReduction'),
        at
      );
    }
  }

  state.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.DUNE_CLOAK, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Dune Cloak',
      at: at,
      sourceSkill: source,
      detail: 'Mind Wrack and Cry of Frustration recharge reduced by 1s'
    }
  });
}

/** Selection gates clone ambushes before any packets or diagnostic proc are emitted. */
export function beginInfiniteHorizonAmbush(
  state: MesmerRuntime,
  at: number,
  count: number,
  weapon: string,
  delivery: EffectDelivery = {}
): boolean {
  if (!hasTrait(state, TRAIT.INFINITE_HORIZON) || !count) return false;
  state.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.INFINITE_HORIZON, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Infinite Horizon',
      at: at,
      sourceSkill: weapon,
      detail: `${count} clone${count === 1 ? '' : 's'}`
    }
  });
  return true;
}

/** Resolve Regeneration, cleanse reporting, Dune Cloak recharge, then Infinite Horizon at the cloak boundary. */
export function applyMirageCloakTraits(
  state: MesmerRuntime,
  at: number,
  source: string,
  duration: number,
  executeCloneAmbushes: MesmerMirageController['executeCloneAmbushes'],
  delivery: EffectDelivery = {}
): void {
  const renewingOasis = hasTrait(state, TRAIT.RENEWING_OASIS)
    ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.RENEWING_OASIS), 'boon', 'regeneration')
    : undefined;
  if (renewingOasis) {
    {
      const grants: readonly MesmerEventExtra[] = [
        { kind: String(renewingOasis.boon), stacks: renewingOasis.stacks, duration: renewingOasis.duration }
      ];
      const traitProfile = requireBalanceProfileFromContext(state, TRAIT.RENEWING_OASIS);
      const traitSource = {
        source: 'Trait',
        sourceId: TRAIT.RENEWING_OASIS,
        actorType: 'player' as const,
        skillId: TRAIT.RENEWING_OASIS,
        skillName: traitProfile.name
      };
      {
        const proc = state.effects.emit({
          ...delivery,
          kind: 'announcement',
          log: true,
          attribution: { ...traitSource, actorType: 'effect' },
          announcement: { type: 'trait', name: traitProfile.name, at: at, sourceSkill: source, detail: '' }
        });
        for (const grant of grants)
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            cause: proc,
            event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: source }
          });
      }
    }
  }

  if (hasTrait(state, TRAIT.ELUSIVE_MIND)) {
    const elusiveMindProfile = requireBalanceProfileFromContext(state, TRAIT.ELUSIVE_MIND);
    state.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.ELUSIVE_MIND, actorType: 'effect' },
      announcement: {
        type: 'trait',
        name: 'Elusive Mind',
        at: at,
        sourceSkill: source,
        detail: `${balanceProfileNumber(elusiveMindProfile, 'maximumStacks')} conditions removed`
      }
    });
  }

  reduceDuneCloakShatters(state, at, source, delivery);
  if (hasTrait(state, TRAIT.INFINITE_HORIZON)) {
    mirageState.from(state).cloneAmbushUntil = canonicalTime(at + duration);
    executeCloneAmbushes(at, professionCoreState(state).clones, delivery);
  }
}

/** Accepted ambushes consume Riddle of Sand and emit Mirage Mantle before their window closes. */
export function applyMirageAmbushTraits(
  state: MesmerRuntime,
  ambush: MesmerAmbushAttack,
  impactAt: number,
  delivery: EffectDelivery = {}
): void {
  const riddleOfSand =
    mirageState.from(state).riddleOfSandReady && hasTrait(state, TRAIT.RIDDLE_OF_SAND)
      ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion')
      : undefined;
  if (riddleOfSand) {
    buildMesmerConditions(
      state,
      ambush.name,
      impactAt,
      statusFromEffect(riddleOfSand),
      'Player',
      `${ambush.name} — Riddle of Sand`,
      { skillId: ambush.id }
    ).forEach((packet) => {
      state.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
    state.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.RIDDLE_OF_SAND, actorType: 'effect' },
      announcement: {
        type: 'trait',
        name: 'Riddle of Sand',
        at: impactAt,
        sourceSkill: ambush.name,
        detail: '2 confusion'
      }
    });
    mirageState.from(state).riddleOfSandReady = false;
  }

  const mirageMantle = hasTrait(state, TRAIT.MIRAGE_MANTLE)
    ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.MIRAGE_MANTLE), 'boon', 'alacrity')
    : undefined;
  if (mirageMantle) {
    {
      const grants: readonly MesmerEventExtra[] = [
        {
          kind: String(mirageMantle.boon),
          stacks: mirageMantle.stacks,
          duration: mirageMantle.duration,
          audience: { recipients: 'party', maximumRecipients: 5 }
        }
      ];
      const traitProfile = requireBalanceProfileFromContext(state, TRAIT.MIRAGE_MANTLE);
      const traitSource = {
        source: 'Trait',
        sourceId: TRAIT.MIRAGE_MANTLE,
        actorType: 'player' as const,
        skillId: TRAIT.MIRAGE_MANTLE,
        skillName: traitProfile.name
      };
      {
        const proc = state.effects.emit({
          ...delivery,
          kind: 'announcement',
          log: true,
          attribution: { ...traitSource, actorType: 'effect' },
          announcement: { type: 'trait', name: traitProfile.name, at: impactAt, sourceSkill: ambush.name, detail: '' }
        });
        for (const grant of grants)
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            cause: proc,
            event: {
              ...grant,
              ...traitSource,
              type: 'buff',
              at: impactAt,
              name: traitProfile.name,
              sourceSkill: ambush.name
            }
          });
      }
    }
  }
}

/** Preserve priming, Vigor, Phantom Pain, mirrors, and Dune Cloak after the shared shatter has resolved. */
export function applyMirageShatterTraits(
  state: MesmerRuntime,
  skill: MesmerSkill,
  at: number,
  spent: number,
  grantAmbushWindow: (at: number, source: string, duration?: number, delivery?: EffectDelivery) => void,
  createMirrors: MesmerMirageController['createMirrors'],
  grantMirageCloak: MesmerMirageController['grantMirageCloak'],
  delivery: EffectDelivery = {}
): void {
  if (state.config.specialization !== 'Mirage') return;
  if (
    hasTrait(state, TRAIT.RIDDLE_OF_SAND) &&
    requireEffect(requireBalanceProfileFromContext(state, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion')
  ) {
    mirageState.from(state).riddleOfSandReady = true;
    state.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.RIDDLE_OF_SAND, actorType: 'effect' },
      announcement: { type: 'trait', name: 'Riddle of Sand', at: at, sourceSkill: skill.name, detail: 'ambush primed' }
    });
  }

  const nominalEndurance = hasTrait(state, TRAIT.NOMADS_ENDURANCE)
    ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.NOMADS_ENDURANCE), 'boon', 'vigor')
    : undefined;
  if (nominalEndurance) {
    {
      const grants: readonly MesmerEventExtra[] = [
        { kind: String(nominalEndurance.boon), stacks: nominalEndurance.stacks, duration: nominalEndurance.duration }
      ];
      const traitProfile = requireBalanceProfileFromContext(state, TRAIT.NOMADS_ENDURANCE);
      const traitSource = {
        source: 'Trait',
        sourceId: TRAIT.NOMADS_ENDURANCE,
        actorType: 'player' as const,
        skillId: TRAIT.NOMADS_ENDURANCE,
        skillName: traitProfile.name
      };
      {
        const proc = state.effects.emit({
          ...delivery,
          kind: 'announcement',
          log: true,
          attribution: { ...traitSource, actorType: 'effect' },
          announcement: { type: 'trait', name: traitProfile.name, at: at, sourceSkill: skill.name, detail: '' }
        });
        for (const grant of grants)
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            cause: proc,
            event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: skill.name }
          });
      }
    }
  }

  if (hasTrait(state, TRAIT.PHANTOM_PAIN)) {
    const phantomPainProfile = requireBalanceProfileFromContext(state, TRAIT.PHANTOM_PAIN);
    {
      const grants: readonly MesmerEventExtra[] = [
        {
          // Phantom Pain starts after the same-time shatter packets resolve.
          priority: 5,
          kind: 'phantom-pain',
          stacks: Math.min(balanceProfileNumber(phantomPainProfile, 'maximumStacks'), spent + 1),
          duration: balanceProfileNumber(phantomPainProfile, 'durationMultiplier')
        }
      ];
      const traitProfile = requireBalanceProfileFromContext(state, TRAIT.PHANTOM_PAIN);
      const traitSource = {
        source: 'Trait',
        sourceId: TRAIT.PHANTOM_PAIN,
        actorType: 'player' as const,
        skillId: TRAIT.PHANTOM_PAIN,
        skillName: traitProfile.name
      };
      {
        const proc = state.effects.emit({
          ...delivery,
          kind: 'announcement',
          log: true,
          attribution: { ...traitSource, actorType: 'effect' },
          announcement: { type: 'trait', name: traitProfile.name, at: at, sourceSkill: skill.name, detail: '' }
        });
        for (const grant of grants)
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            cause: proc,
            event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: skill.name }
          });
      }
    }
  }

  if (skill.id === ID.DISTORTION && hasTrait(state, TRAIT.DESERT_DISTORTION)) {
    grantAmbushWindow(at, 'Desert Distortion', undefined, delivery);
    const desertDistortionProfile = requireBalanceProfileFromContext(state, TRAIT.DESERT_DISTORTION);
    createMirrors(at, spent * balanceProfileNumber(desertDistortionProfile, 'resourceGain'));
    state.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.DESERT_DISTORTION, actorType: 'effect' },
      announcement: {
        type: 'trait',
        name: 'Desert Distortion',
        at: at,
        sourceSkill: skill.name,
        detail: `${spent} Mirage Mirror${spent === 1 ? '' : 's'} created`
      }
    });
  }

  if (
    hasTrait(state, TRAIT.DUNE_CLOAK) &&
    spent >= balanceProfileNumber(requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK), 'threshold')
  ) {
    const duneCloakProfile = requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK);
    grantMirageCloak(
      at,
      'Dune Cloak',
      {
        duration: balanceProfileNumber(duneCloakProfile, 'durationMultiplier')
      },
      delivery
    );
  }
}

/** Infinite Horizon reacts to the committed gain directly, without per-run callback registration. */
export function reactToMirageResourceGain(
  context: MesmerRuntime,
  { at, cause, createdClones }: MesmerResourceGain
): void {
  const traitId = Number(cause.traitId);
  const triggersCloneAmbush =
    traitId === TRAIT.DECEPTIVE_EVASION ||
    (traitId === TRAIT.SELF_DECEPTION && cause.sourceSkillId === ID.ILLUSIONARY_AMBUSH);
  // Preserve the inclusive clone-gain deadline, but never treat the zero sentinel as an active cloak.
  const cloneAmbushUntil = mirageState.from(context).cloneAmbushUntil;
  if (
    triggersCloneAmbush &&
    hasTrait(context, TRAIT.INFINITE_HORIZON) &&
    cloneAmbushUntil > 0 &&
    at <= cloneAmbushUntil
  ) {
    createMirageMechanics(context).executeCloneAmbushes(at, createdClones);
  }
}

/** Initialize only the gameplay readiness state owned by Mirage. */
export function initializeMirageTraits(context: MesmerRuntime): void {
  // Riddle of Sand starts armed only for the active Mirage runtime and is re-armed by Mirage shatters.
  mirageState.from(context).riddleOfSandReady =
    hasTrait(context, TRAIT.RIDDLE_OF_SAND) &&
    Boolean(requireEffect(requireBalanceProfileFromContext(context, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion'));
}

/** Applies Self-Deception to categorized Deception skills after their casts complete. */
export function completeMirageSkill(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  if (
    hasTrait(context, TRAIT.SELF_DECEPTION) &&
    skill.categories?.includes('Deception') &&
    createMesmerActions(context).currentResource() > 0
  ) {
    const selfDeceptionProfile = requireBalanceProfileFromContext(context, TRAIT.SELF_DECEPTION);
    createMesmerResources(context).queueResources(
      context.time,
      balanceProfileNumber(selfDeceptionProfile, 'resourceGain'),
      mesmerActivePrimaryWeapon(context),
      `Self-Deception: ${skill.name}`,
      {
        traitId: TRAIT.SELF_DECEPTION,
        traitName: 'Self-Deception',
        sourceSkillId: skill.id
      }
    );
  }
}
