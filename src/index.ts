import { createInterface } from 'readline';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

import { inc } from 'semver';

import pk from '../package.json';

import { fetchCommitMessage } from './utils/reviseCommitMessage.util';
import Message from './utils/message.util';
import handleType from './utils/handleType.util';
import { green, red, yellow } from './utils/colors.util';

const currentDirectory = process.cwd();

export async function cli() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(red('Nenhum argumento foi fornecido!'));
    console.log(
      yellow('Exemplo:'),
      green(
        'yarn npm-auto-commit -a "feat: Adicionar funcionalidade de autenticação"',
      ),
    );
    process.exit(1);
  }

  if (args.includes('-v') || args.includes('--version')) {
    showVersion();
    process.exit(0);
  }
  const gitVersion = execSync('git --version', {
    cwd: currentDirectory,
  });

  if (!gitVersion) {
    console.log(yellow('O Git não está instalado!'));
    process.exit(1);
  }
  const user = execSync('git config --global user.email', {
    cwd: currentDirectory,
  });

  if (!user) {
    console.log(yellow('O Git não está configurado!'));
    process.exit(1);
  }

  const isInitialized = execSync('git rev-parse --is-inside-work-tree', {
    cwd: currentDirectory,
  });

  if (!isInitialized) {
    console.log(yellow('Nenhum repositório Git foi inicializado!'));
    process.exit(1);
  }

  console.log(green('Auto commit versão:'), pk.version);
  pull();
  const description = args.find((arg) => !arg.startsWith('-'))?.trim();

  if (!description) {
    console.log(red('Nenhuma descrição foi fornecida!'));
    console.log(
      yellow('Exemplo:'),
      green(
        'yarn npm-auto-commit -a "feat: Adicionar funcionalidade de autenticação"',
      ),
    );
    process.exit(1);
  }

  const add = args.some(
    (arg) =>
      args.includes('-add') || (arg.startsWith('-') && arg.includes('a')),
  );

  const bigger = args.some((arg) => arg.startsWith('-') && arg.includes('b'));

  const tagIncrement = args.find(
    (arg) => arg.startsWith('-') && arg.includes('t'),
  );

  const messageApi = await fetchCommitMessage(description);

  console.log(green('Mensagem de commit:'), messageApi);
  const message = new Message(messageApi);

  if (add) execSync(`git add .`, { cwd: currentDirectory });

  verifyStatus();

  console.log(green('Mensagem de commit:'), message.toString());

  const files = listFiles();
  console.log(green('Arquivos que serão comitados:'), files.join(', '));

  const versionType = bigger ? 'major' : handleType(message.getType());
  const currentVersion = getCurrentTag();

  const newVersion = inc(
    currentVersion,
    versionType as 'major' | 'minor' | 'patch',
  );

  if (tagIncrement && newVersion) {
    console.log(green('Versão atual:'), currentVersion);
    console.log(green('Nova versão:'), newVersion);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Deseja continuar? (s/n): ', async (answer) => {
    if (answer.toLowerCase() === 's') {
      const patchPackageJson = './package.json';

      if (existsSync(patchPackageJson) && newVersion) {
        const packageJson = readFileSync(patchPackageJson);
        const json = JSON.parse(packageJson.toString());
        json.version = newVersion;
        writeFileSync(patchPackageJson, JSON.stringify(json, null, 2));
        execSync(`git add ./package.json`, {
          cwd: currentDirectory,
        });
      }

      execSync(message.toCommit(), {
        cwd: currentDirectory,
      });

      execSync(`git push`, { cwd: currentDirectory });
      if (tagIncrement && newVersion) {
        execSync(`git tag -a ${newVersion} -m "${message.toString()}"`, {
          cwd: currentDirectory,
        });
        execSync(`git push --tags`, { cwd: currentDirectory });
      }
      console.log(green('Commit realizado com sucesso!'));
    } else {
      execSync(`git reset`, { cwd: currentDirectory });
      console.log(yellow('Commit cancelado!'));
    }
    rl.close();
  });
}
function getCurrentTag() {
  try {
    const maxTagCommit = execSync('git rev-list --tags --max-count=1', {
      cwd: currentDirectory,
      encoding: 'utf-8',
    }).trim();

    if (maxTagCommit.length === 0) {
      return '0.0.0';
    }

    const gitDescribeOutput = execSync(`git describe --tags ${maxTagCommit}`, {
      cwd: currentDirectory,
    });

    const currentVersion = gitDescribeOutput.toString().trim();

    if (/^v?\d+\.\d+\.\d+/.test(currentVersion)) {
      return currentVersion.replace(/^v/, '');
    } else {
      console.log('Invalid version tag found:', currentVersion);
      return '0.0.0';
    }
  } catch (error) {
    console.error('Error while getting current tag:', error);
    return '0.0.0';
  }
}

function verifyStatus() {
  try {
    const status = listFiles();

    if (status.length === 0) {
      console.log(yellow('Nada para comitar!'));
      process.exit(0);
    }
  } catch (error) {
    console.error('Error while verifying status:', error);
    process.exit(1);
  }
}

function listFiles(): string[] {
  try {
    const gitDiffOutput = execSync('git diff --cached --name-only', {
      cwd: currentDirectory,
    })
      .toString()
      .trim();

    if (gitDiffOutput.length === 0) {
      return [];
    }

    const lines = gitDiffOutput.split('\n');

    const fileModifications = lines.map((line: string) => {
      return line.trim();
    });

    return fileModifications;
  } catch (error) {
    console.error('Error while listing files:', error);
    return [];
  }
}

function pull() {
  try {
    // Attempt to run 'git pull' command
    execSync('git pull', { cwd: currentDirectory });
  } catch (error) {
    // Handle errors from the 'git pull' command
    console.error('Error while pulling:', error);
    // Check if there are uncommitted changes
    const gitStatus = execSync('git status', {
      cwd: currentDirectory,
    }).toString();
    if (gitStatus.includes('Changes not staged for commit')) {
      throw new Error(
        'You have uncommitted changes. Please commit or stash them before pulling.',
      );
    } else {
      // Other error occurred during 'git pull'
      throw new Error('Failed to pull from the remote repository.');
    }
  }
}

// mostrar versão atual do pacote

function showVersion() {
  console.log('Versão atual:', pk.version);
}
