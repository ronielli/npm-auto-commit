import { createInterface } from 'readline';
import { writeFileSync, readFileSync } from 'fs';

import { exec } from 'shelljs';
import { inc } from 'semver';

import Message from './utils/message.util';
import handleType from './utils/handleType.utils';
import { green, red, yellow } from './utils/colors.util';

if (
  !exec('git --version', {
    silent: true,
  }).stdout
) {
  console.log(yellow('Git não está instalado!'));
  process.exit(1);
}
const user = exec('git config --global user.email', {
  silent: true,
}).stdout.trim();

if (!user) {
  console.log(yellow('Git não está configurado!'));
  process.exit(1);
}

if (
  !exec('git rev-parse --is-inside-work-tree', {
    silent: true,
  }).stdout
) {
  console.log(yellow('Não foi iniciado um repositório git!'));
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(red('Nenhum argumento foi passado!'));
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
  console.log(red('Nenhuma descrição foi passada!'));
  console.log(
    yellow('Exemplo:'),
    green(
      'yarn npm-auto-commit -a "feat: Adicionar funcionalidade de autenticação"',
    ),
  );
  process.exit(1);
}

const add = args.some(
  (arg) => args.includes('-add') || (arg.startsWith('-') && arg.includes('a')),
);

const bigger = args.some((arg) => arg.startsWith('-') && arg.includes('b'));

const file = args.some(
  (arg) => args.includes('-file') || (arg.startsWith('-') && arg.includes('f')),
);

if (add) {
  exec(`git add .`);
  const status = exec('git diff --cached --name-only | wc -l', {
    silent: true,
  }).stdout.trim();

  if (status === '0') {
    console.log(yellow('Nada para commitar!'));
    process.exit(0);
  }
} else {
  const status = exec('git diff --cached --name-only | wc -l', {
    silent: true,
  }).stdout.trim();
  if (status === '0') {
    console.log(yellow('Nada para commitar!'));
    process.exit(0);
  }
}

const message = new Message(description);

exec('git pull', { silent: true });

const currentVersion =
  exec('git describe --abbrev=0 --tags', { silent: true }).stdout.trim() ||
  '0.0.0';
const versionType = bigger ? 'major' : handleType(message.getType());
const newVersion = inc(
  currentVersion,
  versionType as 'major' | 'minor' | 'patch',
);

if (!newVersion) {
  console.log(red('Tipo de commit não requer versionamento!'));
  process.exit(0);
}
// mostrar o que vai ser commitado
console.log(green('Mensagem:'), message.toString());
console.log(green('Versão atual:'), currentVersion);
console.log(green('Nova versão:'), newVersion);
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Deseja continuar? (s/n)', async (answer) => {
  if (answer.toLowerCase() === 's') {
    if (file) {
      writeFileSync('./version.txt', newVersion);
      exec(`git add ./version.txt`);
    } else {
      const json = JSON.parse(readFileSync('./package.json').toString());
      json.version = newVersion;
      writeFileSync('./package.json', JSON.stringify(json, null, 2));
      exec(`git add ./package.json`);
    }

    exec(`git commit -m "${message.toString()}"`);
    exec(`git tag ${newVersion}`);
    exec(`git push`);
    exec(`git push --tags`);
    console.log(green('Commit realizado com sucesso!'));
  } else {
    console.log(yellow('Commit cancelado!'));
  }
  rl.close();
});
