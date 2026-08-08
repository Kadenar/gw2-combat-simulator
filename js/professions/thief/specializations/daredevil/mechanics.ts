import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type { ThiefDodge } from "../../types.js";

interface DaredevilDodgeEffectBase {
  sourceId: SkillId;
  stacks?: number;
  duration?: number;
}

export type DaredevilDodgeEffect = Readonly<
  | (DaredevilDodgeEffectBase & {
      type: "strike";
      coefficient: number;
      hits: number;
    })
  | (DaredevilDodgeEffectBase & {
      type: "condition";
      condition: string;
    })
  | (DaredevilDodgeEffectBase & {
      type: "boon";
      boon: string;
    })
>;

export const DAREDEVIL_DODGE_EFFECTS: Readonly<
  Partial<Record<ThiefDodge, readonly DaredevilDodgeEffect[]>>
> = Object.freeze({
  "Bounding Dodger": Object.freeze([
    Object.freeze({
      type: "strike",
      sourceId: TRAIT.BOUNDING_DODGER,
      coefficient: 3.5,
      hits: 1,
    }),
  ]),
  "Lotus Training": Object.freeze([
    Object.freeze({
      type: "strike",
      sourceId: TRAIT.LOTUS_TRAINING,
      coefficient: 0.5625,
      hits: 3,
    }),
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Bleeding",
      stacks: 6,
      duration: 4,
    }),
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Torment",
      stacks: 3,
      duration: 4,
    }),
    Object.freeze({
      type: "condition",
      sourceId: TRAIT.LOTUS_TRAINING,
      condition: "Crippled",
      stacks: 1,
      duration: 3,
    }),
  ]),
  "Unhindered Combatant": Object.freeze([
    Object.freeze({
      type: "boon",
      sourceId: TRAIT.UNHINDERED_COMBATANT,
      boon: "Swiftness",
      stacks: 1,
      duration: 8,
    }),
  ]),
});
