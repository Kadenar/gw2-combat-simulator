import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { isInternalCooldownReady } from "../../../platform/engine/internal-cooldown.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  handleNecromancerChillEvent,
  handleNecromancerPainfulBond,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
  handleNecromancerWeaponSpell,
} from "../mechanics/specific/handlers.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../mechanics/handler-mechanics.js";
import { addCarapace } from "../mechanics/specific/shared.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";

const SCOURGE_SHROUD_SKILL_IDS = new Set([
  ID.MANIFEST_SAND_SHADE,
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.SANDSTORM_SHROUD,
]);

function queueTraitDamage(
  context,
  event,
  { name, traitId, flatStrikeBase, flatStrikePowerCoeff },
) {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name,
    skillName: name,
    coefficient: 0,
    flatStrikeBase,
    flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillWeapon: "Unequipped",
    noCrit: true,
    damageKind: "life-steal",
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function applyTraitCondition(
  details,
  context,
  event,
  { name, traitId, condition, stacks = 1, duration },
) {
  const application = {
    type: "condition",
    at: event.at,
    name: `${name} — ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    triggeredBy: event.skillName,
  };
  if (details.applyCondition) {
    details.applyCondition(context, application);
  } else {
    enqueueOrdered(context.queue, application);
  }
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function queueTraitCoefficientDamage(
  context,
  event,
  { name, traitId, coefficient, noCrit = true },
) {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name,
    skillName: name,
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillWeapon: "Unequipped",
    noCrit,
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function targetBelowHalfHealth(context) {
  const maximum = Number(context.config.target?.health || 0);
  if (!(maximum > 0)) return false;
  return (
    Number(context.totals.strike || 0) + Number(context.totals.condition || 0) >
    maximum * 0.5
  );
}

function targetIsChilled(context, at) {
  if (
    context.config.target?.conditions?.Chilled === true ||
    Number(context.config.target?.conditions?.Chilled || 0) > 0
  )
    return true;
  return Number(context.profession.targetChilledUntil || 0) > at;
}

function usesRandomTraitProcs(context) {
  return context.random?.stochastic === true;
}

function rolledCritical(details) {
  return details.hitContext?.critical?.didCrit === true;
}

function hasActiveBuff(context, kind, at) {
  return (context.boons.get(kind) || []).some(
    (application) =>
      application.at <= at &&
      application.expiresAt > at &&
      application.stacks > 0,
  );
}

function weaponSpellRecipientKeys(event) {
  if (event.actorType === "player") return ["player"];
  if (event.actorType !== "summon") return [];
  if (event.summonOwnerBase && Number(event.summonCount || 0) > 1) {
    return Array.from(
      { length: Number(event.summonCount) },
      (_, index) => `${event.summonOwnerBase}:${index}`,
    );
  }
  return event.summonOwner ? [event.summonOwner] : [];
}

function weaponSpellIcon(context, skillId) {
  return context.helpers.skillsById?.get(skillId)?.icon || "";
}

function queueNightmareWeapon(context, event, definition) {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name: "Nightmare Weapon",
    skillName: "Nightmare Weapon",
    coefficient: 0,
    flatStrikeBase: definition.flatStrikeBase,
    flatStrikePowerCoeff: definition.flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Weapon Spell",
    sourceId: ID.NIGHTMARE_WEAPON,
    actorType: "effect",
    skillId: ID.NIGHTMARE_WEAPON,
    skillWeapon: "Unequipped",
    noCrit: true,
    damageKind: "life-steal",
    triggeredBy: event.skillName,
  });
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    name: "Nightmare Weapon",
    skillName: "Nightmare Weapon",
    kind: "target-vulnerability",
    stacks: definition.vulnerabilityStacks,
    duration: definition.vulnerabilityDuration,
    source: "Weapon Spell",
    sourceId: ID.NIGHTMARE_WEAPON,
    actorType: "effect",
    triggeredBy: event.skillName,
  });
  context.recordProc?.(
    "skill",
    "Nightmare Weapon",
    event.at,
    event.skillName,
    "",
    weaponSpellIcon(context, ID.NIGHTMARE_WEAPON),
  );
}

function queueSplinterWeapon(context, event, definition) {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name: "Splinter Weapon",
    skillName: "Splinter Weapon",
    coefficient: definition.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Weapon Spell",
    sourceId: ID.SPLINTER_WEAPON,
    actorType: "effect",
    skillId: ID.SPLINTER_WEAPON,
    skillWeapon: "Unequipped",
    triggeredBy: event.skillName,
  });
  context.recordProc?.(
    "skill",
    "Splinter Weapon",
    event.at,
    event.skillName,
    "",
    weaponSpellIcon(context, ID.SPLINTER_WEAPON),
  );
}

function reactToWeaponSpells(context, event) {
  const keys = weaponSpellRecipientKeys(event);
  if (!keys.length) return;
  for (const spell of ["nightmare", "splinter"]) {
    const active = context.profession.weaponSpells?.[spell];
    if (!active || active.expiresAt <= event.at) continue;
    const definition = MECHANICS.weaponSpells[spell];
    for (const key of keys) {
      const recipient = active.recipients?.[key];
      if (!recipient || recipient.stacks <= 0 || recipient.nextAt > event.at)
        continue;
      recipient.stacks -= 1;
      recipient.nextAt = event.at + Number(definition.internalCooldown || 0);
      if (spell === "nightmare") {
        queueNightmareWeapon(context, event, definition);
      } else {
        queueSplinterWeapon(context, event, definition);
      }
    }
  }
}

function applyTraitVulnerability(
  context,
  event,
  { name, traitId, stacks, duration },
) {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    name,
    skillName: name,
    kind: "target-vulnerability",
    stacks,
    duration,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function reactToNecromancerDamage(context, event, details = {}) {
  if (event.actorType === "effect" || !(Number(event.coefficient) > 0)) {
    return;
  }
  reactToWeaponSpells(context, event);
  const skill = context.helpers.skillsById?.get(event.skillId);
  const firstHit = Number(event.hitIndex || 1) === 1;
  const scourgeShadeStrike =
    SCOURGE_SHROUD_SKILL_IDS.has(skill?.id) &&
    Number(event.sourceId) === ID.MANIFEST_SAND_SHADE;
  const shroudSkillOne = skill?.shroudSlot === 1 || scourgeShadeStrike;
  if (hasTrait(context, TRAIT.REAPERS_MIGHT) && firstHit && shroudSkillOne) {
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at,
      name: "Reaper's Might",
      skillName: "Reaper's Might",
      kind: "might",
      stacks: 1,
      duration: 15,
      source: "Trait",
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.("trait", "Reaper's Might", event.at, event.skillName);
  }
  if (
    hasTrait(context, TRAIT.SIPHONED_POWER) &&
    targetBelowHalfHealth(context) &&
    isInternalCooldownReady(
      event.at,
      Number(context.profession.traitProcReadyAt.siphonedPower || 0),
    )
  ) {
    context.profession.traitProcReadyAt.siphonedPower = event.at + 1;
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at,
      name: "Siphoned Power",
      skillName: "Siphoned Power",
      kind: "might",
      stacks: 3,
      duration: 8,
      source: "Trait",
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.("trait", "Siphoned Power", event.at, event.skillName);
  }
  if (
    hasTrait(context, TRAIT.SPITEFUL_FORTITUDE) &&
    event.actorType === "player" &&
    targetBelowHalfHealth(context)
  ) {
    context.profession.spitefulFortitudeLifeForce =
      Number(context.profession.spitefulFortitudeLifeForce || 0) +
      (hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1);
  }
  if (
    hasTrait(context, TRAIT.CHILL_OF_DEATH) &&
    targetBelowHalfHealth(context) &&
    isInternalCooldownReady(
      event.at,
      Number(context.profession.traitProcReadyAt.chillOfDeath || 0),
    )
  ) {
    context.profession.traitProcReadyAt.chillOfDeath = event.at + 16;
    const boons = context.config.target?.boonless
      ? 0
      : Math.min(
          3,
          Math.max(
            0,
            Number(
              context.config.target?.boonCount ??
                context.config.target?.boons?.length ??
                1,
            ),
          ),
        );
    const coefficient = [0.6, 0.9, 1.5, 2.1][boons];
    queueTraitCoefficientDamage(context, event, {
      name: "Lesser Spinal Shivers",
      traitId: TRAIT.CHILL_OF_DEATH,
      coefficient,
      noCrit: true,
    });
    enqueueOrdered(context.queue, {
      type: "necromancer.chill",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.CHILL_OF_DEATH,
      actorType: "effect",
      skillName: "Lesser Spinal Shivers",
      duration: 5,
    });
  }
  if (
    hasTrait(context, TRAIT.CHILLING_NOVA) &&
    event.actorType === "player" &&
    targetIsChilled(context, event.at)
  ) {
    if (!usesRandomTraitProcs(context)) {
      context.profession.chillingNovaProgress += Number(
        details.hitContext?.critical?.chance || 0,
      );
    }
    if (
      (
        usesRandomTraitProcs(context)
          ? rolledCritical(details)
          : context.profession.chillingNovaProgress >= 1
      ) &&
      isInternalCooldownReady(
        event.at,
        Number(context.profession.traitProcReadyAt.chillingNova || 0),
      )
    ) {
      if (!usesRandomTraitProcs(context)) {
        context.profession.chillingNovaProgress -= 1;
      }
      context.profession.traitProcReadyAt.chillingNova = event.at + 3;
      queueTraitCoefficientDamage(context, event, {
        name: "Chilling Nova",
        traitId: TRAIT.CHILLING_NOVA,
        coefficient: 1.125,
      });
      enqueueOrdered(context.queue, {
        type: "necromancer.chill",
        at: event.at,
        source: "Trait",
        sourceId: TRAIT.CHILLING_NOVA,
        actorType: "effect",
        skillName: "Chilling Nova",
        duration: 2,
      });
    }
  }
  if (hasTrait(context, TRAIT.DHUUMFIRE) && shroudSkillOne) {
    const proc = MECHANICS.traitProcs[TRAIT.DHUUMFIRE];
    const harbingerShroudSkill =
      context.config?.specialization === "Harbinger" &&
      skill?.shroud === "harbinger";
    if (
      scourgeShadeStrike &&
      !isInternalCooldownReady(
        event.at,
        Number(context.profession.traitProcReadyAt?.dhuumfire || 0),
      )
    ) {
      // Scourge's shade variant has a one-second internal cooldown.
    } else {
      if (scourgeShadeStrike) {
        context.profession.traitProcReadyAt.dhuumfire =
          event.at + proc.scourgeInterval;
      }
      applyTraitCondition(details, context, event, {
        ...proc,
        duration: scourgeShadeStrike
          ? proc.scourgeDuration
          : harbingerShroudSkill
            ? proc.harbingerDuration
            : proc.duration,
      });
    }
  }
  if (hasTrait(context, TRAIT.UNYIELDING_BLAST) && firstHit && shroudSkillOne) {
    applyTraitVulnerability(
      context,
      event,
      MECHANICS.traitProcs[TRAIT.UNYIELDING_BLAST],
    );
  }
  if (
    hasTrait(context, TRAIT.DOOM_APPROACHES) &&
    firstHit &&
    skill?.id === ID.TAINTED_BOLTS
  ) {
    applyTraitVulnerability(context, event, {
      name: "Doom Approaches",
      traitId: TRAIT.DOOM_APPROACHES,
      stacks: 2,
      duration: 6,
    });
  }
  if (hasTrait(context, TRAIT.SEPTIC_CORRUPTION) && skill?.shroudSlot === 2) {
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.SEPTIC_CORRUPTION],
    );
  }
  if (hasTrait(context, TRAIT.BARBED_PRECISION)) {
    const proc = MECHANICS.traitProcs[TRAIT.BARBED_PRECISION];
    if (usesRandomTraitProcs(context)) {
      if (
        rolledCritical(details) &&
        context.random.roll(
          proc.chanceOnCriticalHit,
          "necromancer.barbed-precision",
        )
      ) {
        applyTraitCondition(details, context, event, proc);
      }
    } else {
      context.profession.barbedPrecisionProgress +=
        Number(details.hitContext?.critical?.chance || 0) *
        proc.chanceOnCriticalHit;
      while (context.profession.barbedPrecisionProgress >= 1) {
        context.profession.barbedPrecisionProgress -= 1;
        applyTraitCondition(details, context, event, proc);
      }
    }
  }
  if (
    hasTrait(context, TRAIT.VAMPIRIC_PRESENCE) &&
    isInternalCooldownReady(
      event.at,
      Number(context.profession.vampiricPresenceReadyAt || 0),
    )
  ) {
    const proc = MECHANICS.traitProcs[TRAIT.VAMPIRIC_PRESENCE];
    context.profession.vampiricPresenceReadyAt = event.at + proc.interval;
    queueTraitDamage(context, event, proc);
  }
  if (
    hasTrait(context, TRAIT.OVERFLOWING_THIRST) &&
    hasActiveBuff(context, "taste-for-blood", event.at)
  ) {
    queueTraitDamage(context, event, {
      name: "Taste for Blood",
      traitId: TRAIT.OVERFLOWING_THIRST,
      flatStrikeBase: 325,
      flatStrikePowerCoeff: 0,
    });
  }
}

function reactToNecromancerCondition(context, event, details = {}) {
  if (event.condition === "Chilled") {
    context.profession.targetChilledUntil = Math.max(
      Number(context.profession.targetChilledUntil || 0),
      event.at + Number(event.effectiveDuration ?? event.duration ?? 0),
    );
  }
  if (
    event.actorType !== "summon" &&
    hasTrait(context, TRAIT.CORRUPTERS_FERVOR)
  ) {
    addCarapace(context.profession, 1, event.at);
  }
  if (
    event.condition === "Torment" &&
    hasTrait(context, TRAIT.DEMONIC_LORE) &&
    isInternalCooldownReady(
      event.at,
      Number(context.profession.demonicLoreReadyAt || 0),
    )
  ) {
    const proc = MECHANICS.traitProcs[TRAIT.DEMONIC_LORE];
    context.profession.demonicLoreReadyAt = event.at + proc.interval;
    applyTraitCondition(details, context, event, proc);
  }
  if (event.condition === "Chilled" && hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.DEATHLY_CHILL],
    );
  }
}

function reactToNecromancerBlind(context, event, details = {}) {
  if (
    !hasTrait(context, TRAIT.CHILLING_DARKNESS) ||
    !isInternalCooldownReady(
      event.at,
      Number(context.profession.traitProcReadyAt.chillingDarkness || 0),
    )
  )
    return;
  context.profession.traitProcReadyAt.chillingDarkness = event.at + 3;
  applyTraitCondition(
    details,
    context,
    event,
    MECHANICS.traitProcs[TRAIT.CHILLING_DARKNESS],
  );
}

function reactToNecromancerControl(context, event, details = {}) {
  context.profession.targetControlledUntil = Math.max(
    Number(context.profession.targetControlledUntil || 0),
    event.at + Math.max(0.001, Number(event.duration || 0)),
  );
  if (event.controlKind === "fear" || event.kind === "fear") {
    context.profession.dreadUntil = Math.max(
      Number(context.profession.dreadUntil || 0),
      event.at + 3,
    );
    if (hasTrait(context, TRAIT.SHIVERS_OF_DREAD)) {
      enqueueOrdered(context.queue, {
        type: "necromancer.chill",
        at: event.at,
        source: "Trait",
        sourceId: TRAIT.SHIVERS_OF_DREAD,
        actorType: "effect",
        skillName: "Shivers of Dread",
        duration: 2,
      });
    }
    if (hasTrait(context, TRAIT.TERROR)) {
      applyTraitCondition(details, context, event, {
        name: "Terror",
        traitId: TRAIT.TERROR,
        condition: "Fear",
        duration: Number(event.duration || 1),
      });
    }
  }
  if (hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) {
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.INSIDIOUS_DISRUPTION],
    );
  }
}

/**
 * Necromancer resolver-side handlers: shroud/state and summon-attack timeline
 * events, plus trait reactions that queue extra damage and conditions.
 */
export const necromancerResolverEventHandlers = Object.freeze({
  "necromancer.state": handleNecromancerStateEvent,
  "necromancer.chill": handleNecromancerChillEvent,
  "necromancer.painful-bond": handleNecromancerPainfulBond,
  "necromancer.summon-attack": handleNecromancerSummonAttack,
  "necromancer.weapon-spell": handleNecromancerWeaponSpell,
});

export const necromancerResolverEventReactions = Object.freeze({
  damage: reactToNecromancerDamage,
  condition: reactToNecromancerCondition,
  blind: reactToNecromancerBlind,
  control: reactToNecromancerControl,
});
