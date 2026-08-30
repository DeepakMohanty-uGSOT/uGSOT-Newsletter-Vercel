import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Flat single-project layout: the .env file lives at the project root,
// two levels up from this file (api/_server/env.ts -> project root).
const projectRootEnv = path.resolve(__dirname, "../../.env");
config({ path: projectRootEnv });
