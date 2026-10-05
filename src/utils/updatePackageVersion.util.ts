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

// Lockfiles que precisam ser ressincronizados após bumpar o pyproject.toml,
// para o commit não sair com manifesto e lock em versões divergentes.
const PY_LOCKFILES: { file: string; sync: string }[] = [
  { file: 'uv.lock', sync: 'uv lock' },
  { file: 'poetry.lock', sync: 'poetry lock --no-update' },
];

// Ressincroniza o lockfile Python da pasta (uv/poetry) e o adiciona ao stage.
// Best-effort: se a ferramenta não estiver instalada ou falhar, apenas avisa —
// não aborta o commit.
function syncPythonLock(dir: string, cwd: string): void {
  for (const { file, sync } of PY_LOCKFILES) {
    const lockPath = join(dir, file);
    if (!existsSync(lockPath)) continue;

    try {
      execSync(sync, { cwd: dir, stdio: 'ignore' });
      execSync(`git add "${lockPath}"`, { cwd });
    } catch {
      console.warn(
        `Aviso: falha ao rodar "${sync}" em ${dir}; ${file} não foi ressincronizado.`,
      );
    }

    // Apenas um lockfile por projeto (uv OU poetry).
    return;
  }
}

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
    let pyprojectUpdated = false;

    for (const { file, update } of MANIFESTS) {
      const filePath = join(dir, file);
      if (!existsSync(filePath)) continue;

      update(filePath, newVersion);
      execSync(`git add "${filePath}"`, { cwd });
      touched = true;

      if (file === 'pyproject.toml') pyprojectUpdated = true;
    }

    // Após bumpar o pyproject, o lock precisa refletir a nova versão no
    // mesmo commit — senão o uv.lock fica para trás e gera um diff ruidoso
    // na próxima vez que alguém rodar `uv lock`.
    if (pyprojectUpdated) syncPythonLock(dir, cwd);
  }

  return touched;
}

export default updatePackageVersion;
