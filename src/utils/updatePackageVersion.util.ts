import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function updatePackageJson(filePath: string, newVersion: string): void {
  const json = JSON.parse(readFileSync(filePath).toString());
  json.version = newVersion;
  writeFileSync(filePath, JSON.stringify(json, null, 2));
}

function updatePyproject(filePath: string, newVersion: string): void {
  const content = readFileSync(filePath).toString();
  const lines = content.split('\n');

  let currentTable = '';
  let updated = false;

  const newLines = lines.map((line) => {
    const tableMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (tableMatch) {
      currentTable = tableMatch[1].trim();
      return line;
    }

    const isVersionTable =
      currentTable === 'project' || currentTable === 'tool.poetry';

    if (!updated && isVersionTable && /^\s*version\s*=/.test(line)) {
      updated = true;
      return line.replace(
        /(version\s*=\s*["'])[^"']*(["'])/,
        `$1${newVersion}$2`,
      );
    }

    return line;
  });

  writeFileSync(filePath, newLines.join('\n'));
}

// Manifestos suportados e como atualizar cada um.
const MANIFESTS: { file: string; update: (p: string, v: string) => void }[] = [
  { file: 'package.json', update: updatePackageJson },
  { file: 'pyproject.toml', update: updatePyproject },
];

// Subpastas de monorepo onde os apps ficam (convenção do projeto).
const WORKSPACE_DIRS = ['apps', 'packages'];

// Retorna os diretórios a varrer: a raiz + cada subpasta imediata de apps/, packages/.
function resolveTargetDirs(cwd: string): string[] {
  const dirs = [cwd];

  for (const workspace of WORKSPACE_DIRS) {
    const workspacePath = join(cwd, workspace);
    if (!existsSync(workspacePath)) continue;

    for (const entry of readdirSync(workspacePath, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        dirs.push(join(workspacePath, entry.name));
      }
    }
  }

  return dirs;
}

function updatePackageVersion(
  newVersion: string,
  cwd: string = process.cwd(),
): boolean {
  let touched = false;

  for (const dir of resolveTargetDirs(cwd)) {
    for (const { file, update } of MANIFESTS) {
      const filePath = join(dir, file);
      if (!existsSync(filePath)) continue;

      update(filePath, newVersion);
      execSync(`git add "${filePath}"`, { cwd });
      touched = true;
    }
  }

  return touched;
}

export default updatePackageVersion;
