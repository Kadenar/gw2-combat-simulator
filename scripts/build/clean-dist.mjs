import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

// Retry transient Windows directory-removal failures caused by scanners or recently closed build handles.
await rm(dist, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
