import type { ScrapperState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createScrapperState(): ScrapperState {
  return {};
}

export const scrapperState = defineProfessionSpecializationState(
  "Scrapper",
  createScrapperState,
);
