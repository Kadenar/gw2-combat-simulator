import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';

import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';

import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';

import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { effectNumber } from '#gw2/platform/skills/balance-profiles.js';
import {
  finalMantraChargeUsed,
  firebrandBuffApplied,
  firebrandControlAccepted,
  firebrandStruck,
  tomeOpened,
  tomeStowed,
  type FinalMantraCharge,
  type FirebrandBuffApplication,
  type FirebrandControl,
  type FirebrandStrike,
  type TomeOpening
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/activations.js';
import {
  alliedAshes,
  attribution,
  FIREBRAND_ASHES_EXPIRE
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianBuild, GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

const refundByCast = new WeakMap<RuntimeCast<GuardianSkill>, number>();

/** Counts accepted pages and grants earned refunds even after the tome session ends. */
export const swiftScholar = defineTrait({
  id: TRAIT.SWIFT_SCHOLAR,
  name: 'Swift Scholar',
  balance: {
    minimumStacks: 3,
    resourceGain: 1,
    effects: [{ type: 'boon', name: 'quickness', boon: 'quickness', stacks: 1, duration: 3 }]
  },
  // The minor needs no explicit selection, but its rewards still obey trigger isolation; pages remain mechanic-owned.
  triggers: [
    onTriggerPoint(tomeOpened, { requiresSelection: false, run: openSwiftScholarSession }),
    onTriggerPoint(tomeStowed, { requiresSelection: false, run: (runtime: Runtime) => resetSwiftScholar(runtime) }),
    {
      on: 'castStart',
      requiresSelection: false,
      run(runtime, cast) {
        if (!cast.skill.tome || cast.cancelled) return;
        const state = firebrandState.from(runtime);
        if (state.swiftScholarTome !== cast.skill.tome) {
          state.swiftScholarTome = cast.skill.tome;
          state.swiftScholarCount = 0;
        }

        const profile = requireBalanceProfileFromContext(runtime, TRAIT.SWIFT_SCHOLAR);
        // Complete this tome's page cycle at acceptance while leaving the earned refund attached to its cast.
        const progress = advanceCounter(
          state.swiftScholarCount,
          1,
          balanceProfileNumber(profile, 'minimumStacks'),
          'reset'
        );
        state.swiftScholarCount = progress.value;
        if (progress.reached) {
          // A later concurrent stow cannot revoke the refund already earned by this accepted page.
          refundByCast.set(cast, balanceProfileNumber(profile, 'resourceGain'));
        }
      }
    }
  ],
  lifetime: {
    // Completing an admitted cycle remains available even when new trait producers are disabled.
    onCastCommit(runtime, cast) {
      const skill = cast.skill;
      if (!skill.tome) return;
      const refund = refundByCast.get(cast) ?? 0;
      if (refund > 0) {
        runtime.resourceController.grant('tomePages', refund);
        {
          runtime.effects.emit({
            kind: 'announcement',
            announcement: {
              type: 'trait',
              name: 'Swift Scholar',
              at: runtime.time,
              sourceSkill: skill.name,
              detail: `+${refund} tome pages`,
              icon: guardianTraitIcon(TRAIT.SWIFT_SCHOLAR)
            }
          });
        }
      }
    }
  }
});

/** Each completed page grants the boon associated with its tome. */
export const legendaryLore = defineTrait({
  id: TRAIT.LEGENDARY_LORE,
  name: 'Legendary Lore',
  balance: {
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 2, duration: 10 },
      { type: 'boon', name: 'regeneration', boon: 'regeneration', stacks: 1, duration: 6 },
      { type: 'boon', name: 'protection', boon: 'protection', stacks: 1, duration: 4 }
    ]
  },
  triggers: [
    {
      on: 'castCommit',
      run(runtime, cast) {
        const skill = cast.skill;
        if (!skill.tome) return;
        const boonProfile = requireBalanceProfileFromContext(runtime, TRAIT.LEGENDARY_LORE);
        const selectedBoon = requireEffect(
          boonProfile,
          'boon',
          skill.tome === 'justice' ? 'might' : skill.tome === 'resolve' ? 'regeneration' : 'protection'
        );
        const boonCause = {
          ...guardianCastCause(runtime, cast),
          sourceId: TRAIT.LEGENDARY_LORE,
          name: 'Legendary Lore'
        };
        if (selectedBoon) {
          emitTraitProfile(runtime, boonProfile.id, boonProfile.id, boonCause, {
            preserveName: true,
            effects: (effect) => effect === selectedBoon,
            attribution: boonCause,
            transform: (event) => ({ ...boonCause, ...event, audience: { recipients: 'self' } })
          });
        }
      }
    }
  ]
});

/** Quickness supplies panel attributes once; runtime rules reconcile actual boon uptime. */
export const imbuedHaste = defineTrait({
  id: TRAIT.IMBUED_HASTE,
  name: 'Imbued Haste',
  balance: {
    attributeBonus: 250
  },
  modifierRules: [
    {
      id: 'guardian.firebrand.imbued-haste-attributes',
      label: 'Imbued Haste',
      target: [
        MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
        MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
        MODIFIER_TARGET.ATTRIBUTE_VITALITY
      ],
      operation: 'add',
      amount: (context) => {
        const staticApplied = attributeProvenance(context.config).professionStaticRulesApplied;
        const runtimeActive = guardianBoonActive(context, 'quickness');
        const staticallyActive = staticApplied && Boolean(context.config?.boons?.quickness);
        const imbuedHasteProfile = requireBalanceProfileFromContext(context, TRAIT.IMBUED_HASTE);
        return (
          (Number(runtimeActive) - Number(staticallyActive)) *
          balanceProfileNumber(imbuedHasteProfile, 'attributeBonus')
        );
      }
    }
  ],
  buildAttributes: (_common, { build, balanceContext }) => ({
    attributeEffects: (['Condition Damage', 'Healing Power', 'Vitality'] as const).map((to) => ({
      kind: 'flat' as const,
      to,
      amount: balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.IMBUED_HASTE),
        'attributeBonus'
      ),
      feedsConversions: true,
      enabled: (build as GuardianBuild).assumptions?.quickness !== false
    }))
  })
});

/** Accepted heals reserve the interval before delivering surviving party Quickness. */
export const liberatorsVow = defineTrait({
  id: TRAIT.LIBERATORS_VOW,
  name: "Liberator's Vow",
  balance: {
    internalCooldown: 7,
    effects: [{ type: 'boon', name: 'quickness', boon: 'quickness', stacks: 1, duration: 2 }]
  },
  triggers: [
    {
      on: 'castCommit',
      run(runtime, cast) {
        const skill = cast.skill;
        if (skill.type !== 'Heal') return;
        const boonProfile = requireBalanceProfileFromContext(runtime, TRAIT.LIBERATORS_VOW);
        const selectedBoon = requireEffect(boonProfile, 'boon', 'quickness');
        if (
          !selectedBoon ||
          !runtime.procs.claim(TRAIT.LIBERATORS_VOW, 'guardian.firebrand.liberatorsVow', runtime.time)
        )
          return;
        const boonCause = guardianCastCause(runtime, cast);
        emitTraitProfile(runtime, boonProfile.id, boonProfile.id, boonCause, {
          preserveName: true,
          effects: (effect) => effect === selectedBoon,
          attribution: boonCause,
          transform: (event) => ({ ...boonCause, ...event, audience: { recipients: 'party' } })
        });
        runtime.effects.emit({
          kind: 'announcement',
          announcement: {
            type: 'trait',
            name: "Liberator's Vow",
            at: runtime.time,
            sourceSkill: skill.name,
            detail: 'Quickness',
            icon: guardianTraitIcon(TRAIT.LIBERATORS_VOW)
          }
        });
      }
    }
  ]
});

/** Final-charge rewards precede charge retirement; the compiled completion stage reports the selected reward. */
export const weightyTerms = defineTrait({
  id: TRAIT.WEIGHTY_TERMS,
  name: 'Weighty Terms',
  balance: {
    resourceGain: 2,
    effects: [{ type: 'condition', name: 'Slow', condition: 'Slow', stacks: 1, duration: 1.5 }]
  },
  triggers: [
    onTriggerPoint(finalMantraChargeUsed, { run: grantWeightyTerms }),
    {
      on: 'castCommit',
      run(runtime, cast) {
        const skill = cast.skill;
        if (MANTRAS.some(({ finalId }) => finalId === skill.id)) {
          const profile = requireBalanceProfileFromContext(runtime, TRAIT.WEIGHTY_TERMS);
          const gain = balanceProfileNumber(profile, 'resourceGain');
          // The final-charge trigger owns the rewards; the completed cast retains the proc report.
          {
            runtime.effects.emit({
              kind: 'announcement',
              announcement: {
                type: 'trait',
                name: 'Weighty Terms',
                at: runtime.time,
                sourceSkill: skill.name,
                detail: `+${gain} tome pages`,
                icon: guardianTraitIcon(TRAIT.WEIGHTY_TERMS)
              }
            });
          }
        }
      }
    }
  ]
});

/** Delivered Aegis or Stability grants party Quickness on the existing shared interval. */
export const stalwartSpeed = defineTrait({
  id: TRAIT.STALWART_SPEED,
  name: 'Stalwart Speed',
  balance: {
    internalCooldown: 7,
    effects: [{ type: 'boon', name: 'quickness', boon: 'quickness', stacks: 1, duration: 2 }]
  },
  triggers: [
    onTriggerPoint(firebrandBuffApplied, {
      when: (_runtime, { cause }: FirebrandBuffApplication) =>
        sharedDelivery(cause) && (cause.kind === 'aegis' || cause.kind === 'stability'),
      run: grantStalwartSpeed
    })
  ]
});

/** Player controls grant boons while Courage retains its passive through dormancy. */
export const stoicDemeanor = defineTrait({
  id: TRAIT.STOIC_DEMEANOR,
  name: 'Stoic Demeanor',
  balance: {
    effects: [
      { type: 'boon', name: 'resistance', boon: 'resistance', stacks: 1, duration: 2 },
      { type: 'boon', name: 'might', boon: 'might', stacks: 3, duration: 10 }
    ]
  },
  triggers: [
    onTriggerPoint(firebrandControlAccepted, {
      when: (_runtime, { cause }: FirebrandControl) => cause.actorType === 'player',
      run: grantStoicDemeanor
    })
  ]
});

/** Accepted axe damage grants the surviving Bleeding packet after Ashes consumption. */
export const unrelentingCriticism = defineTrait({
  id: TRAIT.UNRELENTING_CRITICISM,
  name: 'Unrelenting Criticism',
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Bleeding',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5
      }
    ]
  },
  triggers: [
    onTriggerPoint(firebrandStruck, {
      when: (runtime, { cause }: FirebrandStrike) =>
        cause.skillId != null && runtime.helpers.skillsById.get(cause.skillId)?.weapon === 'Axe',
      run: applyUnrelentingCriticism
    })
  ]
});

/** Delivered Quickness grants one allied or self Ashes charge and retains passive Justice. */
export const quickfire = defineTrait({
  id: TRAIT.QUICKFIRE,
  name: 'Quickfire',
  balance: {
    internalCooldown: 7,
    effects: [
      {
        type: 'buff',
        name: 'ashes-of-the-just',
        kind: 'ashes-of-the-just',
        stacks: 1,
        duration: 10
      }
    ]
  },
  triggers: [
    onTriggerPoint(firebrandBuffApplied, {
      when: (_runtime, { cause }: FirebrandBuffApplication) => sharedDelivery(cause) && cause.kind === 'quickness',
      run: grantQuickfireAshes
    })
  ]
});

/** Increases the shared page capacity and upgrades the untraited initial default. */
export const archivistOfWhispers = defineTrait({
  id: TRAIT.ARCHIVIST_OF_WHISPERS,
  name: 'Archivist of Whispers',
  balance: { maximumStacks: 8 }
});

/** Shortens the resource controller cadence without creating a second recovery clock. */
export const loremaster = defineTrait({
  id: TRAIT.LOREMASTER,
  name: 'Loremaster',
  balance: {
    pulseInterval: 5
  }
});

export const firebrandTraits = [
  archivistOfWhispers,
  loremaster,
  swiftScholar,
  legendaryLore,
  imbuedHaste,
  liberatorsVow,
  weightyTerms,
  stalwartSpeed,
  stoicDemeanor,
  unrelentingCriticism,
  quickfire
];

/** Tome session changes reset only the counter, never refunds earned by accepted casts. */
function resetSwiftScholar(runtime: Runtime, virtue?: string): void {
  const state = firebrandState.from(runtime);
  if (virtue === undefined || state.swiftScholarTome !== virtue) {
    state.swiftScholarTome = virtue ?? '';
    state.swiftScholarCount = 0;
  }
}

/** A new tome session restarts the count; a ready opening grants Quickness after the shared virtue rewards. */
function openSwiftScholarSession(runtime: Runtime, { cast, virtue, ready }: TomeOpening): void {
  resetSwiftScholar(runtime, virtue);
  if (!ready) return;
  const boonProfile = requireBalanceProfileFromContext(runtime, TRAIT.SWIFT_SCHOLAR);
  const selectedBoon = requireEffect(boonProfile, 'boon', 'quickness');
  const boonCause = guardianCastCause(runtime, cast);
  if (!selectedBoon) return;
  emitTraitProfile(runtime, boonProfile.id, boonProfile.id, boonCause, {
    preserveName: true,
    effects: (effect) => effect === selectedBoon,
    attribution: boonCause,
    transform: (event) => ({ ...boonCause, ...event, audience: { recipients: 'self' } })
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Swift Scholar',
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: 'Tome activation',
      icon: guardianTraitIcon(TRAIT.SWIFT_SCHOLAR)
    }
  });
}

/** Final mantra charges grant pages and the trait's Slow before the mechanic retires the charge. */
function grantWeightyTerms(runtime: Runtime, { context }: FinalMantraCharge): void {
  applySideEffect(runtime, context, {
    type: 'resourceGrant',
    resource: 'tomePages',
    amount: { profile: TRAIT.WEIGHTY_TERMS, field: 'resourceGain' }
  });
  applySideEffect(runtime, context, {
    type: 'emitProfile',
    profileId: TRAIT.WEIGHTY_TERMS,
    // Keep the granting trait visible while the shared profile preserves cast lineage.
    attribution: { source: 'guardian', actorType: 'player', name: 'Weighty Terms — Slow' }
  });
}

/** Delivered boons reach these traits only when the player or an ally received them. */
function sharedDelivery(event: Gw2ResolverEvent): boolean {
  return event.resolvedAudience?.includesSelf === true || (event.resolvedAudience?.alliedPlayerCount ?? 0) > 0;
}

/** Delivered Aegis or Stability claims the interval only when its derived boons survive. */
function grantStalwartSpeed(runtime: Runtime, { cause: boonCause }: FirebrandBuffApplication): void {
  const boonProfile = requireBalanceProfileFromContext(runtime, TRAIT.STALWART_SPEED);
  const selectedBoons = (boonProfile.effects ?? []).filter((effect) => effect.type === 'boon');
  // Reserve the interval before delivery, so derived boons cannot reenter the proc.
  if (
    !selectedBoons.length ||
    !runtime.procs.claim(TRAIT.STALWART_SPEED, 'guardian.firebrand.stalwartSpeed', runtime.time)
  )
    return;
  emitTraitProfile(runtime, TRAIT.STALWART_SPEED, boonProfile.id, boonCause, {
    preserveName: true,
    effects: (effect) => selectedBoons.some((candidate) => candidate === effect),
    attribution: {
      ...attribution(boonCause),
      source: 'Trait',
      sourceId: TRAIT.STALWART_SPEED,
      skillId: TRAIT.STALWART_SPEED,
      skillName: boonProfile.name
    },
    transform: (packet) => ({ ...packet, audience: { recipients: 'party' } })
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: boonProfile.name,
      at: runtime.time,
      sourceSkill: boonCause.skillName,
      detail: 'Boons',
      icon: guardianTraitIcon(TRAIT.STALWART_SPEED)
    }
  });
}

/** Delivered Quickness grants one allied or self Ashes charge once both the charge and its Burning survive. */
function grantQuickfireAshes(runtime: Runtime, { cause: event }: FirebrandBuffApplication): void {
  const state = firebrandState.from(runtime);
  const allies = event.resolvedAudience?.alliedPlayerCount ?? 0;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.QUICKFIRE);
  const buff = requireEffect(profile, 'buff', 'ashes-of-the-just');
  const ashes = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
  const burn = requireEffect(ashes, 'condition', 'Burning');
  if (!buff || !burn || !runtime.procs.claim(TRAIT.QUICKFIRE, 'guardian.firebrand.quickfire', runtime.time)) return;
  const expiresAt = gw2EffectExpiresAt(runtime.time, effectNumber(profile, buff, 'duration'));
  if (allies > 0)
    alliedAshes(runtime, event, 1, expiresAt - runtime.time, {
      maximumAllies: 1,
      priority: 5,
      skillName: 'Quickfire',
      name: 'Quickfire'
    });
  else {
    state.ashes = grantCharges(1, expiresAt, state.ashes, runtime.time);
    state.ashesBurnDuration = effectNumber(ashes, burn, 'duration');
    runtime.schedule(FIREBRAND_ASHES_EXPIRE, expiresAt, undefined, undefined, 10);
  }

  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Quickfire',
      at: runtime.time,
      sourceSkill: event.skillName,
      detail: '+1 Ashes of the Just',
      icon: guardianTraitIcon(TRAIT.QUICKFIRE)
    }
  });
}

/** Accepted player controls grant the surviving Stoic Demeanor boons. */
function grantStoicDemeanor(runtime: Runtime, { cause: boonCause }: FirebrandControl): void {
  const boonProfile = requireBalanceProfileFromContext(runtime, TRAIT.STOIC_DEMEANOR);
  const selectedBoons = (boonProfile.effects ?? []).filter((effect) => effect.type === 'boon');
  if (!selectedBoons.length) return;
  emitTraitProfile(runtime, TRAIT.STOIC_DEMEANOR, boonProfile.id, boonCause, {
    preserveName: true,
    effects: (effect) => selectedBoons.some((candidate) => candidate === effect),
    attribution: {
      ...attribution(boonCause),
      source: 'Trait',
      sourceId: TRAIT.STOIC_DEMEANOR,
      skillId: TRAIT.STOIC_DEMEANOR,
      skillName: boonProfile.name
    },
    transform: (packet) => ({ ...packet, audience: { recipients: 'self' } })
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: boonProfile.name,
      at: runtime.time,
      sourceSkill: boonCause.skillName,
      detail: 'Boons',
      icon: guardianTraitIcon(TRAIT.STOIC_DEMEANOR)
    }
  });
}

/** Accepted axe hits apply Bleeding after consuming any Ashes charge. */
function applyUnrelentingCriticism(runtime: Runtime, { cause: event }: FirebrandStrike): void {
  // Keep axe ownership and reaction settlement while the profile owns Bleeding's authored fields.
  emitTraitProfile(runtime, TRAIT.UNRELENTING_CRITICISM, TRAIT.UNRELENTING_CRITICISM, undefined, {
    at: runtime.time,
    effect: { type: 'condition', name: 'Bleeding' },
    settlement: 'reaction',
    attribution: {
      ...attribution(event),
      sourceId: event.skillId!,
      name: 'Unrelenting Criticism — Bleeding',
      triggeredBy: 'Unrelenting Criticism'
    }
  });
}
