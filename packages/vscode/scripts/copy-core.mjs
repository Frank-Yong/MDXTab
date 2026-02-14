import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vscodeDir = path.resolve(__dirname, "..");
const coreDir = path.resolve(vscodeDir, "..", "core");
const repoRoot = path.resolve(vscodeDir, "..", "..");
const srcDist = path.join(coreDir, "dist");
const yamlCandidates = [
	path.join(coreDir, "node_modules", "yaml"),
	path.join(repoRoot, "node_modules", "yaml"),
];

const targetDir = path.join(vscodeDir, "dist", "core");
const targetYaml = path.join(targetDir, "node_modules", "yaml");

await fs.rm(targetDir, { recursive: true, force: true });
await fs.mkdir(targetDir, { recursive: true });
await fs.cp(srcDist, targetDir, { recursive: true });

const yamlPath = await findExistingPath(yamlCandidates);
if (yamlPath) {
	await fs.mkdir(path.dirname(targetYaml), { recursive: true });
	await fs.rm(targetYaml, { recursive: true, force: true });
	await fs.cp(yamlPath, targetYaml, { recursive: true });
}

async function findExistingPath(paths) {
	for (const candidate of paths) {
		try {
			await fs.access(candidate);
			return candidate;
		} catch {
			// continue
		}
	}
	return undefined;
}
