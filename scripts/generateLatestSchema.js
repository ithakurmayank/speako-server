// scripts/generateLatestSchema.js

import fs from "fs/promises";
import path from "path";

const ROOT_DIR = process.cwd();
const MODELS_DIR = path.join(ROOT_DIR, "models");
const OUTPUT_FILE = path.join(ROOT_DIR, "LatestSchema.txt");

async function getFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  let files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await getFiles(fullPath)));
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function generateSchemaFile() {
  const files = await getFiles(MODELS_DIR);

  files.sort();

  let output = "";

  for (const file of files) {
    const relative = path.relative(ROOT_DIR, file);

    const code = await fs.readFile(file, "utf8");

    output += `==================================================
FILE: ${relative}
==================================================

${code}



`;
  }

  await fs.writeFile(OUTPUT_FILE, output, "utf8");

  console.log(`✅ Generated ${OUTPUT_FILE}`);
}

generateSchemaFile().catch((err) => {
  console.error(err);
  process.exit(1);
});
