import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { battlePresenceSharesBoons } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import {
  willbenderVirtueOpened,
  willbenderVirtueTriggered,
  type WillbenderVirtueBoundary
} from '#gw2/professions/guardian/specializations/willbender/activations.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import {
  lethalTempoParameters,
  lethalTempoStacks
} from '#gw2/professions/guardian/specializations/willbender/traits/behavior.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

/** Intrinsic virtue grants share an inclusive stack lifetime and the outgoing additive damage bucket. */
export const lethalTempo = defineTrait({
  id: TRAIT.LETHAL_TEMPO,
  name: 'Lethal Tempo',
  // Both virtue boundaries grant and report the same inclusive stack window; the minor is intrinsic to Willbender.
  triggers: [
    onTriggerPoint(willbenderVirtueOpened, {
      requiresSelection: false,
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) => tempo(runtime, cause)
    }),
    onTriggerPoint(willbenderVirtueTriggered, {
      requiresSelection: false,
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) => tempo(runtime, cause)
    })
  ],
  hooks: {
    /** Imported stacks are absolute counts, while retaining the selected cap and refresh behavior. */
    initialize(runtime) {
      const parameters = lethalTempoParameters(runtime);
      if (!parameters) return;
      for (const buff of runtime.config.initialBuffs ?? []) {
        if (buff.kind !== 'lethal-tempo') continue;
        gainLethalTempo(willbenderState.from(runtime), runtime.time, {
          ...parameters,
          stacks: buff.stacks,
          duration: buff.duration
        });
      }
    }
  },
  balance: {
    damageIncreasePerStack: 0.02,
    conditionDamageIncreasePerStack: 0.02,
    maximumStacks: 5,
    effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      requiresSelection: false,
      id: 'guardian.willbender.lethal-tempo-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // Lethal Tempo shares the outgoing additive bucket with equipment and other additive traits.
      operation: 'damage-additive',
      // Tyrant's Momentum raises strike bonus (5 % vs 2 %) to compensate for the shorter window.

      amount: (context) =>
        lethalTempoStacks(context) *
        (hasTrait(context, TRAIT.TYRANTS_MOMENTUM)
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.TYRANTS_MOMENTUM),
              'damageIncreasePerStack'
            )
          : balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.LETHAL_TEMPO),
              'damageIncreasePerStack'
            )),
      order: 100
    },
    {
      requiresSelection: false,
      id: 'guardian.willbender.lethal-tempo-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      // Use the same additive grouping for conditions so Bursting does not multiply Lethal Tempo.
      operation: 'damage-additive',
      // Condition bonus is identical (2 %) without Tyrant's Momentum; the trait adds 1 % here too.

      amount: (context) =>
        lethalTempoStacks(context) *
        (hasTrait(context, TRAIT.TYRANTS_MOMENTUM)
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.TYRANTS_MOMENTUM),
              'conditionDamageIncreasePerStack'
            )
          : balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.LETHAL_TEMPO),
              'conditionDamageIncreasePerStack'
            )),
      order: 100
    }
  ]
});

/** Selects longer Justice and shorter Tempo windows while the shared stack rules retain live tuning. */
export const tyrantsMomentum = defineTrait({
  id: TRAIT.TYRANTS_MOMENTUM,
  name: "Tyrant's Momentum",
  balance: {
    damageIncreasePerStack: 0.05,
    conditionDamageIncreasePerStack: 0.03,
    effects: [
      { type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 1, duration: 4 },
      { type: 'buff', name: 'justice', kind: 'justice', stacks: 1, duration: 10 }
    ]
  }
});

/** Tracks reserved weapon work so earned reductions survive to commitment without moving their origin. */
export const restorativeVirtues = defineTrait({
  id: TRAIT.RESTORATIVE_VIRTUES,
  name: 'Restorative Virtues',
  balance: {
    // Each virtue trigger advances active weapon recharge by 280ms before recharge-speed conversion.
    rechargeReduction: 0.28,
    effects: [{ type: 'boon', name: 'vigor', boon: 'vigor', stacks: 1, duration: 3 }]
  },
  triggers: [
    onTriggerPoint(willbenderVirtueOpened, {
      when: (_runtime, { virtue }: WillbenderVirtueBoundary) => virtue === 'resolve',
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) =>
        grantVirtueBoon(runtime, TRAIT.RESTORATIVE_VIRTUES, 'vigor', cause, () => ({ recipients: 'self' }))
    }),
    onTriggerPoint(willbenderVirtueTriggered, {
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) => reduceWeapons(runtime, cause)
    })
  ],
  lifetime: {
    onCastStart(runtime, cast) {
      if (cast.cancelled) return;
      if (cast.skill.type === 'Weapon')
        willbenderState.from(runtime).weaponCastRecharge[cast.id] = {
          skillId: cast.skill.id,
          rechargeStart: cast.rechargeStart,
          rechargeWork: cast.rechargeWork
        };
    },
    onCastCommit(runtime, cast) {
      const state = willbenderState.from(runtime);
      const pending = state.pendingWeaponCooldownReduction[cast.id] ?? 0;
      delete state.pendingWeaponCooldownReduction[cast.id];
      delete state.weaponCastRecharge[cast.id];
      if (pending > 0) runtime.cooldownController.reduceSkillRecharge(cast.skill, pending, runtime.time);
    }
  }
});

/** Virtue activation grants Fury and accepted hit cycles grant party Might. */
export const holyReckoning = defineTrait({
  id: TRAIT.HOLY_RECKONING,
  name: 'Holy Reckoning',
  balance: {
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 1, duration: 15, audience: { recipients: 'party' } },
      { type: 'boon', name: 'fury', boon: 'fury', stacks: 1, duration: 3, audience: { recipients: 'self' } }
    ]
  },
  triggers: [
    onTriggerPoint(willbenderVirtueOpened, {
      when: (_runtime, { virtue }: WillbenderVirtueBoundary) => virtue === 'justice',
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) =>
        grantVirtueBoon(runtime, TRAIT.HOLY_RECKONING, 'fury', cause, () => ({ recipients: 'self' }))
    }),
    onTriggerPoint(willbenderVirtueTriggered, {
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) =>
        grantVirtueBoon(runtime, TRAIT.HOLY_RECKONING, 'might', cause, () => ({ recipients: 'party' }))
    })
  ]
});

/** Resolve grants distinct Alacrity packets whose authored recipients can be widened by Battle Presence. */
export const phoenixProtocol = defineTrait({
  id: TRAIT.PHOENIX_PROTOCOL,
  name: 'Phoenix Protocol',
  balance: {
    effects: [
      { type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 5, audience: { recipients: 'self' } },
      {
        type: 'boon',
        name: 'alacrity (triggered)',
        boon: 'alacrity',
        stacks: 1,
        duration: 1,
        packetLabel: 'triggered',
        audience: { recipients: 'self' }
      }
    ]
  },
  // Activation and completed cycles honor the same authored sharing policy.
  triggers: [
    onTriggerPoint(willbenderVirtueOpened, {
      when: (_runtime, { virtue }: WillbenderVirtueBoundary) => virtue === 'resolve',
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) =>
        grantVirtueBoon(runtime, TRAIT.PHOENIX_PROTOCOL, 'alacrity', cause, phoenixAudience(runtime))
    }),
    onTriggerPoint(willbenderVirtueTriggered, {
      when: (_runtime, { virtue }: WillbenderVirtueBoundary) => virtue === 'resolve',
      run: (runtime: Runtime, { cause }: WillbenderVirtueBoundary) =>
        grantVirtueBoon(runtime, TRAIT.PHOENIX_PROTOCOL, 'alacrity (triggered)', cause, phoenixAudience(runtime))
    })
  ]
});

/** Only tagged flame strikes receive the multiplier; the panel bonus remains eligible for conversions. */
export const powerForPower = defineTrait({
  id: TRAIT.POWER_FOR_POWER,
  name: 'Power for Power',
  balance: {
    damageMultiplier: 3,
    attributeBonus: 120
  },
  modifierRules: [
    {
      id: 'guardian.willbender.power-for-power',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.POWER_FOR_POWER), 'damageMultiplier'),
      order: 100,
      // willbenderFlames flag is set only on Willbender Flames pulse strikes emitted by hooks.ts,
      // so this 3× multiplier never applies to normal weapon hits.
      when: (context) => Boolean(context.event?.willbenderFlames)
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.POWER_FOR_POWER, [
    { kind: 'flat', to: 'Power', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Supplies the panel Vitality bonus before eligible conversions. */
export const conceitedCurate = defineTrait({
  id: TRAIT.CONCEITED_CURATE,
  name: 'Conceited Curate',
  balance: { attributeBonus: 180 },
  buildAttributes: traitAttributeEffects(TRAIT.CONCEITED_CURATE, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Accepted flame strikes emit the surviving Burning packet independently of virtue counters. */
export const searingPact = defineTrait({
  id: TRAIT.SEARING_PACT,
  name: 'Searing Pact',
  balance: {
    attributeBonus: 120,
    effects: [{ type: 'condition', name: 'Burning', condition: 'Burning', stacks: 1, duration: 1 }]
  },
  triggers: [
    {
      emit: TRAIT.SEARING_PACT,
      on: 'damage.resolved',
      when: (_runtime, event, details) =>
        Boolean(event.willbenderFlames) &&
        (details.hitContext?.damage ?? 0) > 0 &&
        Number(event.coefficient) > 0 &&
        (event.actorType === 'player' || event.sourceId === `sigil.${SIGIL_IDS.AIR}`),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Burning',
      attribution: {
        source: 'guardian',
        actorType: 'player',
        skillId: TRAIT.SEARING_PACT,
        skillName: 'Searing Pact',
        name: 'Searing Pact \u2014 Burning',
        triggeredBy: 'Willbender Flames'
      }
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.SEARING_PACT, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: true }
  ])
});

export const willbenderTraits = [
  lethalTempo,
  tyrantsMomentum,
  restorativeVirtues,
  holyReckoning,
  phoenixProtocol,
  powerForPower,
  conceitedCurate,
  searingPact
];

type BoonAudience = { readonly recipients?: string } | undefined;

/** Grants one surviving profile boon on the virtue boundary's cause, under the trait's own identity. */
function grantVirtueBoon(
  runtime: Runtime,
  trait: number,
  name: string,
  cause: Gw2ResolverEvent,
  audience: (authored: BoonAudience) => BoonAudience
): void {
  const profile = requireBalanceProfileFromContext(runtime, trait);
  const effect = requireEffect(profile, 'boon', name);
  if (!effect) return;
  emitTraitProfile(runtime, trait, profile.id, undefined, {
    preserveName: true,
    effects: (candidate) => candidate === effect,
    attribution: {
      source: 'guardian',
      sourceId: trait,
      actorType: 'player',
      skillId: trait,
      skillName: profile.name,
      activationId: cause.activationId,
      triggeredBy: cause.skillName
    },
    transform: (packet) => ({
      ...packet,
      duration: packet.duration,
      name: profile.name + ' — ' + name,
      causalOrder: cause.causalOrder ?? cause.eventOrder,
      audience: audience(packet.audience) as typeof packet.audience
    })
  });
}

/** Authored sharing survives without Battle Presence; the trait can still share self-only live effects. */
function phoenixAudience(runtime: Runtime): (authored: BoonAudience) => BoonAudience {
  return (authored) => (battlePresenceSharesBoons(runtime) ? { ...authored, recipients: 'party' } : authored);
}

function gainLethalTempo(
  state: GuardianWillbenderState,
  at: number,
  { maximumStacks, duration, stacks }: NonNullable<ReturnType<typeof lethalTempoParameters>>
): number {
  // Grants through the expiry tick refresh every stack; only a later grant starts a new stack window.
  at = canonicalTime(at);
  state.lethalTempo = grantRefreshedStacks(
    state.lethalTempo,
    stacks,
    at,
    gw2EffectExpiresAt(at, duration),
    maximumStacks,
    'inclusive'
  );
  return state.lethalTempo.stacks;
}

/** Both virtue boundaries grant and report the same inclusive stack window. */
function tempo(runtime: Runtime, event: Gw2ResolverEvent): void {
  const parameters = lethalTempoParameters(runtime);
  if (!parameters) return;
  const stacks = gainLethalTempo(willbenderState.from(runtime), runtime.time, parameters);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'guardian',
      sourceId: TRAIT.LETHAL_TEMPO,
      actorType: 'player',
      skillId: TRAIT.LETHAL_TEMPO,
      skillName: 'Lethal Tempo',
      name: 'Lethal Tempo',
      kind: 'lethal-tempo',
      stacks,
      duration: parameters.duration,
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      triggeredBy: event.skillName
    }
  });
  {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Lethal Tempo',
        at: runtime.time,
        sourceSkill: event.skillName,
        detail: `${stacks}/${parameters.maximumStacks} stacks`,
        icon: guardianTraitIcon(TRAIT.LETHAL_TEMPO)
      }
    });
  }
}

/** Earned base work applies to equipped weapon cooldowns and reservations before speed conversion. */
function reduceWeapons(runtime: Runtime, cause: Gw2ResolverEvent): void {
  const state = willbenderState.from(runtime);
  const names = new Set(gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet === 2 ? 2 : 1).filter(Boolean));
  const matches = (skill: Skill) => skill.type === 'Weapon' && (!names.size || names.has(String(skill.weapon)));
  const amount = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.RESTORATIVE_VIRTUES),
    'rechargeReduction'
  );
  let reduction = 0;
  for (const id of new Set([
    ...runtime.cooldownController.cooldownSkillIds(),
    ...runtime.cooldownController.ammoSkillIds()
  ])) {
    const skill = runtime.helpers.skillsById.get(id)!;
    if (matches(skill)) reduction += runtime.cooldownController.reduceSkillRecharge(skill, amount, runtime.time);
  }

  for (const [id, cast] of Object.entries(state.weaponCastRecharge)) {
    const skill = runtime.helpers.skillsById.get(cast.skillId)!;
    if (!matches(skill)) continue;
    const pending = state.pendingWeaponCooldownReduction[id] ?? 0;
    const available = runtime.cooldownController.remaining(
      skill,
      { startedAt: cast.rechargeStart, work: cast.rechargeWork },
      runtime.time
    );
    const gain = Math.min(amount, Math.max(0, available - pending));
    state.pendingWeaponCooldownReduction[id] = pending + gain;
    reduction += gain / runtime.cooldownController.rate(skill);
  }

  if (reduction > 0) {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Restorative Virtues',
        at: runtime.time,
        sourceSkill: cause.skillName,
        detail: `${Number(reduction.toFixed(3))}s weapon recharge`,
        icon: guardianTraitIcon(TRAIT.RESTORATIVE_VIRTUES)
      }
    });
  }
}
