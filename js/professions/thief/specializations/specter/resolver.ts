// module.ts always imports resolver-phase handlers from resolver.ts, not from traits.ts directly.
// This re-export preserves that boundary even though the handler lives in traits.ts.
export { applyLarcenousTorment } from "./traits.js";
