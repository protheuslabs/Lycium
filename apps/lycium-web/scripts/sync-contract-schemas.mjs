import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const sourceDir = path.join(repoRoot, "packages/contracts/schemas");
const targetDir = path.join(repoRoot, "apps/lycium-web/public/schemas");
const publicSchemaRoot = "https://protheuslabs.github.io/Lycium/schemas";

mkdirSync(targetDir, { recursive: true });

const schemaFiles = readdirSync(sourceDir)
  .filter((fileName) => fileName.endsWith(".schema.json"))
  .sort();

for (const fileName of schemaFiles) {
  const sourcePath = path.join(sourceDir, fileName);
  const targetPath = path.join(targetDir, fileName);
  const schemaText = readFileSync(sourcePath, "utf8");

  try {
    const schema = JSON.parse(schemaText);
    schema.$id = `${publicSchemaRoot}/${fileName}`;
    writeFileSync(targetPath, `${JSON.stringify(schema, null, 2)}\n`);
  } catch {
    copyFileSync(sourcePath, targetPath);
  }
}

console.log(`Synced ${schemaFiles.length} contract schemas to apps/lycium-web/public/schemas.`);
