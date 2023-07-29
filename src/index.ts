import { createInterface } from 'readline';
import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

import { inc } from 'semver';

import pk from '../package.json';

import Message from './utils/message.util';
import handleType from './utils/handleType.utils';
import { green, red, yellow } from './utils/colors.util';

const currentDirectory = process.cwd();

export function cli() {
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

  const file = args.some(
    (arg) =>
      args.includes('-file') || (arg.startsWith('-') && arg.includes('f')),
  );

  const tagIncrement = args.find(
    (arg) => arg.startsWith('-') && arg.includes('t'),
  );

  if (add) execSync(`git add .`, { cwd: currentDirectory });

  verifyStatus();
  const message = new Message(description);

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
      if (file && newVersion && tagIncrement) {
        const json = JSON.stringify({
          version: newVersion,
        });
        writeFileSync('./package.json', json);
        execSync(`git add ./package.json`, {
          cwd: currentDirectory,
        });
      } else {
        const json = JSON.parse(readFileSync('./package.json').toString());
        json.version = newVersion;
        writeFileSync('./package.json', JSON.stringify(json, null, 2));
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

    const gitDescribeOutput = execSync(`git describe --tags ${maxTagCommit}`, {
      cwd: currentDirectory,
    });

    const currentVersion = gitDescribeOutput.toString().trim();

    // Check if the output is a valid version tag using a regular expression
    if (/^v?\d+\.\d+\.\d+/.test(currentVersion)) {
      return currentVersion.replace(/^v/, ''); // Remove 'v' prefix if present
    } else {
      console.log('Invalid version tag found:', currentVersion);
      return '0.0.0';
    }
  } catch (error) {
    // If an error occurs (e.g., there are no tags), return '0.0.0'
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
    process.exit(1); // Exit with an error code if an error occurs
  }
}

function listFiles(): string[] {
  try {
    // Run 'git diff' command with '--name-status' option
    const gitDiffOutput = execSync('git diff --cached --name-only', {
      cwd: currentDirectory,
    })
      .toString()
      .trim();
    const lines = gitDiffOutput.split('\n');

    // Extract file modifications
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
