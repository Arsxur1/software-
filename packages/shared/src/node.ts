// Node-only helpers (do not import from the Mini App).
import { fileURLToPath } from "node:url";

export const PROMPTS_DIR = fileURLToPath(new URL("../prompts/", import.meta.url));
