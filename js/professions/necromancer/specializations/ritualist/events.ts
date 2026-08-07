import { ritualistState } from "./state.js";
import { EPSILON } from "../../../../platform/engine/clock.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { RITUALIST_MECHANICS as MECHANICS } from "./mechanics.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerWeaponSpellRecipient,
} from "../../types.js";

export function handleNecromancerPainfulBond(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  const definition = MECHANICS.painfulBond;
  const state = ritualistState.from(context);
  if (event.mode === "apply") {
    state.painfulBondUntil = Math.max(
      Number(state.painfulBondUntil || 0),
      event.at + Number(event.duration || definition.duration),
    );
    if (!Number.isFinite(state.painfulBondPulseAnchorAt)) {
      const firstPulseAt = event.at + Number(definition.firstPulseDelay || 0);
      state.painfulBondPulseAnchorAt = firstPulseAt;
      enqueueOrdered(context.queue, {
        ...event,
        at: firstPulseAt,
        mode: "tick",
      });
    }
    return;
  }
  if (event.mode !== "tick") return;

  if (event.at < Number(state.painfulBondUntil || 0) - EPSILON) {
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at,
      name: "Painful Bond",
      skillName: "Painful Bond",
      coefficient: 0,
      flatStrikeBase: definition.flatStrikeBase,
      flatStrikePowerCoeff: definition.flatStrikePowerCoeff,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "Spirit",
      sourceId: "ritualist.painful-bond",
      actorType: "effect",
      icon: definition.icon,
      skillWeapon: "Unequipped",
      noCrit: true,
      triggeredBy: event.triggeredBy || "Anguish",
    });
  }

  const nextAt = event.at + Number(definition.interval || 1);
  if (nextAt <= context.horizon + EPSILON) {
    enqueueOrdered(context.queue, {
      ...event,
      at: nextAt,
      mode: "tick",
    });
  }
}

export function handleNecromancerWeaponSpell(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  if (!event.spell) return;
  const recipients: Record<string, NecromancerWeaponSpellRecipient> = {
    player: {
      stacks: Number(event.playerStacks || 0),
      nextAt: 0,
    },
  };
  for (const recipient of event.recipients || []) {
    recipients[recipient] = {
      stacks: Number(event.allyStacks || 0),
      nextAt: 0,
    };
  }
  ritualistState.from(context).weaponSpells[event.spell] = {
    skillId: event.skillId ?? undefined,
    skillName: event.skillName,
    appliedAt: event.at,
    expiresAt: event.at + Number(event.duration || 0),
    recipients,
    alliesReceiveFullBenefit: Boolean(event.alliesReceiveFullBenefit),
  };
}
