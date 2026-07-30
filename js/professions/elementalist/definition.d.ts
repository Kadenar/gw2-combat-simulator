import type { NormalizedProfessionContract } from "../../platform/engine/types.js";

// Narrow typed boundary for the standalone JavaScript Elementalist definition
// module. Elementalist keeps its legacy application; this declaration only lets
// the shared profession registry reference it without an implicit `any`.
export const elementalistProfession: NormalizedProfessionContract;
export default elementalistProfession;
