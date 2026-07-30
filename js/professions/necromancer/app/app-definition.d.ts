import type { Gw2AppAdapter } from "../../../app/profession/types.js";

// Narrow typed boundary for the still-JavaScript Necromancer app-definition
// module. Only the shared-shell adapter is exposed to the profession registry;
// remove this file when app-definition.js is migrated to TypeScript.
export const necromancerAppAdapter: Gw2AppAdapter;
