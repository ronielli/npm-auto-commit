import { writeFileSync, readFileSync, existsSync } from 'fs';
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

function updatePackageVersion(
  newVersion: string,
  cwd: string = process.cwd(),
): boolean {
  const manifests = [
    { path: './package.json', update: updatePackageJson },
    { path: './pyproject.toml', update: updatePyproject },
  ];

  let touched = false;

  for (const { path, update } of manifests) {
    if (!existsSync(path)) continue;

    update(path, newVersion);
    execSync(`git add ${path}`, { cwd });
    touched = true;
  }

  return touched;
}

export default updatePackageVersion;
