import { createInterface } from 'readline';
import { writeFileSync, readFileSync } from 'fs';

import { exec } from 'shelljs';
import { inc } from 'semver';

import Message from './utils/message.util';
import handleType from './utils/handleType.utils';
import { green, red, yellow } from './utils/colors.util';

const currentDirectory = process.cwd();

export function cli() {
  if (
    !exec('git --version', {
      silent: true,
      cwd: currentDirectory,
    }).stdout
  ) {
    console.log(yellow('O Git não está instalado!'));
    process.exit(1);
  }
  const user = exec('git config --global user.email', {
    silent: true,
    cwd: currentDirectory,
  }).stdout.trim();

  if (!user) {
    console.log(yellow('O Git não está configurado!'));
    process.exit(1);
  }

  if (
    !exec('git rev-parse --is-inside-work-tree', {
      silent: true,
      cwd: currentDirectory,
    }).stdout
  ) {
    console.log(yellow('Nenhum repositório Git foi inicializado!'));
    process.exit(1);
  }

  exec('git pull', { silent: true, cwd: currentDirectory });

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
  if (add) {
    exec(`git add .`, { silent: true, cwd: currentDirectory });
    const status = exec('git diff --cached --name-only | wc -l', {
      silent: true,
      cwd: currentDirectory,
    }).stdout.trim();

    if (status === '0') {
      console.log(yellow('Nada para comitar!'));
      process.exit(0);
    }
  } else {
    const status = exec('git diff --cached --name-only | wc -l', {
      silent: true,
      cwd: currentDirectory,
    }).stdout.trim();
    if (status === '0') {
      console.log(yellow('Nada para comitar!'));
      process.exit(0);
    }
  }

  const message = new Message(description);

  exec('git pull', { silent: true, cwd: currentDirectory });

  const currentVersion =
    exec('git describe --tags --abbrev=0 --all', {
      silent: true,
      cwd: currentDirectory,
    })
      .stdout.trim()
      .replace(/^tags\//, '') || '0.0.0';

  const versionType = bigger ? 'major' : handleType(message.getType());
  const newVersion = inc(
    currentVersion,
    versionType as 'major' | 'minor' | 'patch',
  );

  if (!newVersion) {
    console.log(red('O tipo de commit não requer versionamento!'));
    process.exit(0);
  }

  console.log(green('Mensagem de commit:'), message.toString());
  console.log(green('Versão atual:'), currentVersion);
  console.log(green('Nova versão:'), newVersion);

  const files = exec('git diff --cached --name-only', {
    silent: true,
    cwd: currentDirectory,
  }).stdout.trim();
  console.log(
    green('Arquivos que serão comitados:'),
    files.split('\n').join(', '),
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Deseja continuar? (s/n): ', async (answer) => {
    if (answer.toLowerCase() === 's') {
      if (file) {
        writeFileSync('./version.txt', newVersion);
        exec(`git add ./version.txt`, { silent: true, cwd: currentDirectory });
      } else {
        const json = JSON.parse(readFileSync('./package.json').toString());
        json.version = newVersion;
        writeFileSync('./package.json', JSON.stringify(json, null, 2));
        exec(`git add ./package.json`, { silent: true, cwd: currentDirectory });
      }

      exec(message.toCommit(), {
        silent: true,
        cwd: currentDirectory,
      });

      exec(`git tag ${newVersion}`, { silent: true, cwd: currentDirectory });
      exec(`git push`, { silent: true, cwd: currentDirectory });
      exec(`git push --tags`, { silent: true, cwd: currentDirectory });
      console.log(green('Commit realizado com sucesso!'));
    } else {
      exec(`git reset`, { silent: true, cwd: currentDirectory });
      console.log(yellow('Commit cancelado!'));
    }
    rl.close();
  });
}
