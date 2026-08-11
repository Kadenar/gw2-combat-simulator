import { mirageState } from "./state.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
/** Mirage-owned cloak, ambush, and deception behavior. */
import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type {
  SchedulerState,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerAmbushAttack,
  MesmerAttackStatus,
  MesmerClone,
  MesmerCloneAttack,
  MesmerConfig,
  MesmerCurrentResource,
  MesmerMirageCloakOptions,
  MesmerMirageController,
  MesmerRuntimeState,
  MesmerQueueResources,
  MesmerSkill,
} from "../../types.js";

const MIRAGE_CLOAK_SKILLS = new Set<number>([
  ID.ILLUSIONARY_AMBUSH,
  ID.SAND_THROUGH_GLASS,
]);
const DECEPTION_SKILLS = new Set<number>([
  ID.FALSE_OASIS,
  ID.CRYSTAL_SANDS,
  ID.MIRAGE_ADVANCE,
  ID.SAND_THROUGH_GLASS,
  ID.ILLUSIONARY_AMBUSH,
  ID.JAUNT,
]);

interface MirageActionControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly config: MesmerConfig;
  readonly traits: ReadonlySet<number>;
  readonly ambushAttacks: Readonly<Record<string, MesmerAmbushAttack>>;
  readonly cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
  readonly skillsById: ReadonlyMap<SkillId, MesmerSkill>;
  readonly epsilon: number;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly addCondition: MesmerAddCondition;
  readonly addDamage: MesmerAddDamage;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
  readonly currentResource: MesmerCurrentResource;
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
  epsilon,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  activePrimaryWeapon,
  queueResources,
  currentResource,
}: MirageActionControllerOptions): MesmerMirageController {
  const createMirrors = (
    at: number,
    count: number,
    source: string,
    delay = 0,
  ) => {
    const availableAt = at + Math.max(0, delay);
    for (let index = 0; index < Math.max(0, count); index += 1) {
      mirageState.from(state).mirrors.push({
        availableAt,
        expiresAt: availableAt + 8,
        source,
      });
    }
  };

  const addBoon = (
    at: number,
    boon: MesmerAttackStatus,
    sourceSkill: string,
    actorType: "player" | "summon" = "player",
    recipients: "self" | "party" = "self",
  ) => {
    const boonRecipients = actorType === "summon" ? "party" : recipients;
    addEvent({
      type: "buff",
      at,
      source: actorType === "summon" ? "Clone" : "Player",
      actorType,
      kind: String(boon.name || "").toLowerCase(),
      stacks: Number(boon.stacks || 1),
      duration: Number(boon.duration || 0),
      skillName: sourceSkill,
      sourceSkill,
      ...(boonRecipients === "party"
        ? {
            recipients: boonRecipients,
            maximumRecipients: 5,
            companionIds: professionCoreState(state).clones.map(
              (clone) => `mesmer.clone:${clone.id}`,
            ),
          }
        : {}),
    });
  };

  const addAmbushVulnerability = (at: number, ambush: MesmerAmbushAttack) => {
    if (!ambush.vulnerability) return;
    addEvent({
      type: "buff",
      at,
      kind: "target-vulnerability",
      stacks: ambush.vulnerability.stacks,
      duration: ambush.vulnerability.duration,
      sourceSkill: ambush.name,
    });
    addEvent({
      type: "weakness_vulnerability",
      at,
      skillName: ambush.name,
    });
  };

  const executeCloneAmbushes = (
    at: number,
    clones: readonly MesmerClone[] = professionCoreState(state).clones,
  ) => {
    if (!traits.has(TRAIT.INFINITE_HORIZON) || !clones.length) return;
    addTraitProc(
      "Infinite Horizon",
      at,
      activePrimaryWeapon(),
      `${clones.length} clone${clones.length === 1 ? "" : "s"}`,
    );
    for (const clone of clones) {
      const weapon = clone.weapon || activePrimaryWeapon();
      const ambush = ambushAttacks[weapon];
      if (!ambush) continue;
      const attack = cloneAttacks[weapon] || cloneAttacks.Sword;
      const pseudo = {
        id: ambush.name,
        name: ambush.name,
        weapon,
        blade: false,
      };
      const impactAt = at + Number(ambush.clone.castTimeMs || 0) / 1000;
      addDamage(
        pseudo,
        impactAt,
        {
          coefficient: ambush.clone.coefficient,
          hits: ambush.clone.hits,
          source: "Clone",
        },
        {
          cloneId: clone.id,
          weaponStrength: attack.weaponStrength,
          source: "Clone",
          name: `${ambush.name} — Clone`,
        },
      );
      for (const condition of ambush.clone.conditions || []) {
        addCondition(
          `${ambush.name} — Clone`,
          impactAt,
          condition,
          "Clone",
          "",
          { cloneId: clone.id },
        );
      }
      for (const boon of ambush.cloneBoons || []) {
        addBoon(impactAt, boon, `${ambush.name} — Clone`, "summon");
      }
    }
  };

  const grantAmbushWindow = (at: number, source: string, duration = 1.5) => {
    if (config.specialization !== "Mirage") return;
    mirageState.from(state).ambushUntil = Math.max(
      mirageState.from(state).ambushUntil,
      at + duration,
    );
    mirageState.from(state).ambushSource = source;
    addEvent({
      type: "marker",
      at,
      name: "Ambush Window",
      detail: `${source} (${duration}s)`,
    });
  };

  const reduceDuneCloakShatters = (at: number, source: string) => {
    if (!traits.has(TRAIT.DUNE_CLOAK)) return;
    for (const id of [ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION]) {
      const shatter = skillsById.get(id);
      const readyAt = shatter ? state.cooldowns.get(shatter.id) : null;
      if (shatter && readyAt != null) {
        state.cooldowns.set(shatter.id, Math.max(at, readyAt - 1));
      }
    }
    addTraitProc(
      "Dune Cloak",
      at,
      source,
      "Mind Wrack and Cry of Frustration recharge reduced by 1s",
    );
  };

  const grantMirageCloak = (
    at: number,
    source: string,
    { duration = 0.75, grantCloneCloak = true }: MesmerMirageCloakOptions = {},
  ) => {
    if (config.specialization !== "Mirage") return;
    grantAmbushWindow(at, source);
    addEvent({
      type: "buff",
      at,
      kind: "mirage-cloak",
      stacks: 1,
      duration,
      sourceSkill: source,
    });
    if (traits.has(TRAIT.RENEWING_OASIS)) {
      addBoon(at, { name: "Regeneration", duration: 4 }, source);
      addTraitProc("Renewing Oasis", at, source, "4s regeneration");
    }
    if (traits.has(TRAIT.ELUSIVE_MIND)) {
      addTraitProc("Elusive Mind", at, source, "3 conditions removed");
    }
    reduceDuneCloakShatters(at, source);
    if (grantCloneCloak && traits.has(TRAIT.INFINITE_HORIZON)) {
      mirageState.from(state).cloneAmbushUntil = at + duration;
      executeCloneAmbushes(at, professionCoreState(state).clones);
    }
  };

  const executePlayerAmbush = (
    skill: MesmerSkill,
    at: number,
    castStart = at,
  ) => {
    const weapon = activePrimaryWeapon();
    const ambush = ambushAttacks[weapon];
    if (!ambush || skill.id !== ambush.id) return;
    const pseudo = {
      id: ambush.name,
      name: ambush.name,
      weapon,
      blade: false,
    };
    const impactAt =
      ambush.player.damageAtMs == null
        ? at
        : castStart + Number(ambush.player.damageAtMs) / 1000;
    addDamage(pseudo, impactAt, {
      coefficient: ambush.player.coefficient,
      hits: ambush.player.hits,
      source: "Player",
    });
    for (const condition of ambush.player.conditions || []) {
      addCondition(ambush.name, impactAt, condition);
    }
    if (
      mirageState.from(state).riddleOfSandReady &&
      traits.has(TRAIT.RIDDLE_OF_SAND)
    ) {
      addCondition(
        ambush.name,
        impactAt,
        { name: "Confusion", duration: 4, stacks: 2 },
        "Player",
        `${ambush.name} — Riddle of Sand`,
      );
      addTraitProc("Riddle of Sand", impactAt, ambush.name, "2 confusion");
      mirageState.from(state).riddleOfSandReady = false;
    }
    for (const boon of ambush.playerBoons || []) {
      addBoon(
        impactAt,
        boon,
        ambush.name,
        "player",
        ambush.id === ID.CHAOS_VORTEX ? "party" : "self",
      );
    }
    if (traits.has(TRAIT.MIRAGE_MANTLE)) {
      addBoon(
        impactAt,
        { name: "Alacrity", duration: 4 },
        ambush.name,
        "player",
        "party",
      );
      addTraitProc("Mirage Mantle", impactAt, ambush.name, "4s alacrity");
    }
    addAmbushVulnerability(impactAt, ambush);
    if (ambush.createsClone) {
      queueResources(impactAt + epsilon, 1, weapon, ambush.name, {
        sourceSkillId: skill.id,
      });
    }
    mirageState.from(state).ambushUntil = 0;
    mirageState.from(state).ambushSource = "";
  };

  const handleMirageShatter = (
    skill: MesmerSkill,
    at: number,
    spent: number,
  ) => {
    if (config.specialization !== "Mirage") return;
    if (traits.has(TRAIT.RIDDLE_OF_SAND)) {
      mirageState.from(state).riddleOfSandReady = true;
      addTraitProc("Riddle of Sand", at, skill.name, "ambush primed");
    }
    if (traits.has(TRAIT.NOMADS_ENDURANCE)) {
      addBoon(at, { name: "Vigor", duration: 3 }, skill.name);
      addTraitProc("Nomad's Endurance", at, skill.name, "3s vigor");
    }
    if (skill.id === ID.DISTORTION && traits.has(TRAIT.DESERT_DISTORTION)) {
      grantAmbushWindow(at, "Desert Distortion");
      createMirrors(at, spent, "Desert Distortion");
      addTraitProc(
        "Desert Distortion",
        at,
        skill.name,
        `${spent} Mirage Mirror${spent === 1 ? "" : "s"} created`,
      );
    }
    if (traits.has(TRAIT.DUNE_CLOAK) && spent >= 3) {
      grantMirageCloak(at, "Dune Cloak", { duration: 1 });
    }
  };

  const handlePostSkill = (skill: MesmerSkill, at: number) => {
    if (skill.id === ID.CRYSTAL_SANDS) {
      // The supplied EVTC places the strike and mirror roughly 0.32s after
      // Crystal Sands completes, rather than at cast completion.
      createMirrors(at, 1, skill.name, 0.32);
    }
    if (MIRAGE_CLOAK_SKILLS.has(skill.id)) {
      grantMirageCloak(at, skill.name);
    }
    if (
      traits.has(TRAIT.SELF_DECEPTION) &&
      DECEPTION_SKILLS.has(skill.id) &&
      currentResource() > 0
    ) {
      queueResources(
        at + epsilon,
        1,
        activePrimaryWeapon(),
        `Self-Deception: ${skill.name}`,
        {
          traitId: TRAIT.SELF_DECEPTION,
          traitName: "Self-Deception",
          sourceSkillId: skill.id,
        },
      );
    }
  };

  const pickUpMirror = (at: number, source: string) => {
    const mirrors = mirageState.from(state).mirrors;
    const index = mirrors.findIndex(
      (mirror) =>
        mirror.availableAt <= at + epsilon && mirror.expiresAt > at + epsilon,
    );
    if (index < 0) return false;
    mirrors.splice(index, 1);
    const pseudo = {
      id: ID.MIRAGE_MIRROR_DAMAGE,
      name: "Mirage Mirror",
      weapon: activePrimaryWeapon(),
      blade: false,
    };
    addDamage(pseudo, at, {
      coefficient: 0.6,
      hits: 1,
      source: "Player",
    });
    addEvent({
      type: "weakness_vulnerability",
      at,
      skillName: source,
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
    handlePostSkill,
    pickUpMirror,
  };
}
