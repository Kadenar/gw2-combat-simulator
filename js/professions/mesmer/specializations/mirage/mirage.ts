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
  MesmerProfessionState,
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
  readonly state: SchedulerState<MesmerProfessionState>;
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
  const addBoon = (
    at: number,
    boon: MesmerAttackStatus,
    sourceSkill: string,
  ) => {
    addEvent({
      type: "buff",
      at,
      kind: String(boon.name || "").toLowerCase(),
      stacks: Number(boon.stacks || 1),
      duration: Number(boon.duration || 0),
      sourceSkill,
    });
  };

  const addAmbushVulnerability = (
    at: number,
    ambush: MesmerAmbushAttack,
  ) => {
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
    clones: readonly MesmerClone[] = state.profession.clones,
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
        addBoon(impactAt, boon, `${ambush.name} — Clone`);
      }
    }
  };

  const grantAmbushWindow = (
    at: number,
    source: string,
    duration = 1.5,
  ) => {
    if (config.specialization !== "Mirage") return;
    state.profession.ambushUntil = Math.max(
      state.profession.ambushUntil,
      at + duration,
    );
    state.profession.ambushSource = source;
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
    {
      duration = 0.75,
      grantCloneCloak = true,
    }: MesmerMirageCloakOptions = {},
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
      state.profession.cloneAmbushUntil = at + duration;
      executeCloneAmbushes(at, state.profession.clones);
    }
  };

  const executePlayerAmbush = (skill: MesmerSkill, at: number) => {
    const weapon = activePrimaryWeapon();
    const ambush = ambushAttacks[weapon];
    if (!ambush || skill.id !== ambush.id) return;
    const pseudo = {
      id: ambush.name,
      name: ambush.name,
      weapon,
      blade: false,
    };
    addDamage(pseudo, at, {
      coefficient: ambush.player.coefficient,
      hits: ambush.player.hits,
      source: "Player",
    });
    for (const condition of ambush.player.conditions || []) {
      addCondition(ambush.name, at, condition);
    }
    if (
      state.profession.riddleOfSandReady &&
      traits.has(TRAIT.RIDDLE_OF_SAND)
    ) {
      addCondition(
        ambush.name,
        at,
        { name: "Confusion", duration: 4, stacks: 2 },
        "Player",
        `${ambush.name} — Riddle of Sand`,
      );
      addTraitProc("Riddle of Sand", at, ambush.name, "2 confusion");
      state.profession.riddleOfSandReady = false;
    }
    for (const boon of ambush.playerBoons || []) {
      addBoon(at, boon, ambush.name);
    }
    if (traits.has(TRAIT.MIRAGE_MANTLE)) {
      addBoon(at, { name: "Alacrity", duration: 4 }, ambush.name);
      addBoon(at, { name: "Vigor", duration: 3 }, ambush.name);
      addTraitProc("Mirage Mantle", at, ambush.name, "4s alacrity, 3s vigor");
    }
    addAmbushVulnerability(at, ambush);
    if (ambush.createsClone) {
      queueResources(at + epsilon, 1, weapon, ambush.name, {
        sourceSkillId: skill.id,
      });
    }
    state.profession.ambushUntil = 0;
    state.profession.ambushSource = "";
  };

  const handleMirageShatter = (
    skill: MesmerSkill,
    at: number,
    spent: number,
  ) => {
    if (config.specialization !== "Mirage") return;
    if (traits.has(TRAIT.RIDDLE_OF_SAND)) {
      state.profession.riddleOfSandReady = true;
      addTraitProc("Riddle of Sand", at, skill.name, "ambush primed");
    }
    if (traits.has(TRAIT.NOMADS_ENDURANCE)) {
      addBoon(at, { name: "Vigor", duration: 3 }, skill.name);
      addTraitProc("Nomad's Endurance", at, skill.name, "3s vigor");
    }
    if (skill.id === ID.DISTORTION && traits.has(TRAIT.DESERT_DISTORTION)) {
      grantAmbushWindow(at, "Desert Distortion");
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

  return {
    executeCloneAmbushes,
    executePlayerAmbush,
    grantMirageCloak,
    handleMirageShatter,
    handlePostSkill,
  };
}
