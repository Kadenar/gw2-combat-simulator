import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";

export const DEADEYE_STOLEN_ID_BY_CHOICE: Readonly<Record<string, number>> = Object.freeze({
  "steal-time": ID.STEAL_TIME,
  "steal-warmth": ID.STEAL_WARMTH,
  "steal-resistance": ID.STEAL_RESISTANCE,
  "steal-precision": ID.STEAL_PRECISION,
  "steal-health": ID.STEAL_HEALTH,
  "steal-strength": ID.STEAL_STRENGTH,
  "steal-durability": ID.STEAL_DURABILITY,
  "steal-defenses": ID.STEAL_DEFENSES,
  "steal-mobility": ID.STEAL_MOBILITY,
});
