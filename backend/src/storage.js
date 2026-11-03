import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const STORAGE_ROOT = path.resolve(BACKEND_ROOT, process.env.STORAGE_ROOT || "../storage");
