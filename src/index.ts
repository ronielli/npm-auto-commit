import { createInterface } from 'readline';

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
  console.log(red('Git não está instalado!'));
  process.exit(1);
}
const user = exec('git config --global user.email', {
  silent: true,
}).stdout.trim();

if (!user) {
  console.log(red('Git não está configurado!'));
  process.exit(1);
}

if (
  !exec('git rev-parse --is-inside-work-tree', {
    silent: true,
  }).stdout
) {
  console.log(red('Não foi iniciado um repositório git!'));
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

if (add) {
  exec(`git add .`);
  const status = exec('git status --porcelain', { silent: true }).stdout;
  if (!status) {
    console.log(yellow('Nada para commitar!'));
    process.exit(0);
  }
} else {
  const status = exec('git status --porcelain', { silent: true }).stdout;
  if (!status) {
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
// mostrar o que vai ser commitado
console.log(green('Mensagem:'), message.toString());
console.log(green('Versão atual:'), currentVersion);
console.log(green('Nova versão:'), newVersion);
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Deseja continuar? (s/n)', (answer) => {
  if (answer.toLowerCase() === 's') {
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
// const rl = createInterface({
//   input: process.stdin,
// Tipo: Indica o propósito geral do commit. Alguns tipos comuns incluem:

// feat: para introduzir uma nova funcionalidade.
// fix: para corrigir um bug.
// docs: para alterações na documentação.
// refactor: para refatorar código existente.
// test: para adicionar ou modificar testes.
// chore: para tarefas de manutenção, como atualização de dependências.
// Âmbito (opcional): Indica o escopo da mudança realizada no commit. Pode ser uma determinada parte do código, um módulo específico ou qualquer outra coisa relevante.
// feat fix docs refactor test chore
// Mensagem: Uma descrição breve e clara do que foi feito no commit. Deve começar com letra minúscula e ser escrita no tempo presente, usando uma linguagem concisa e descritiva.

// exec(`git commit -m "${message.toString()}"`);

/* import shell from 'shelljs';
import { version } from './package.json';
import { writeFileSync } from 'fs';
import { inc } from 'semver';

async function main() {
    // Verifique se há mudanças no staging area
    if (shell.exec('git diff --cached --quiet', {silent: true}).code !== 0) {
        console.error('Erro: Existem alterações no staging area. Faça commit dessas alterações antes de executar este script.');
        process.exit(1);
    }

    // obtenha os argumentos da linha de comando
    let args = process.argv.slice(2);

    // faça uma verificação para garantir que um argumento foi passado
    if (args.length === 0) {
        console.log('Erro: nenhum argumento fornecido. Forneça um argumento no formato "tipo: descrição".');
        process.exit(1);
    }

    // divida o argumento em tipo e descrição
    let [type, ...descArr] = args[0].split(':');
    let description = descArr.join(':').trim();

    let versionType = '';

    switch (type) {
        case 'feat':
            versionType = 'minor';
            break;
        case 'fix':
        case 'perf':
            versionType = 'patch';
            break;
        case 'docs':
        case 'style':
        case 'refactor':
        case 'test':
        case 'chore':
        default:
            console.log("O tipo de commit não requer versionamento. Os tipos aceitos são:");
            console.log("- 'feat' para mudanças menores");
            console.log("- 'fix' ou 'perf' para correções");
            process.exit(0);
    }

    // incremente a versão usando a biblioteca semver
    let newVersion = inc(version, versionType);

    // leia o package.json como um string
    let packageJson = await import('./package.json');
    packageJson.version = newVersion;

    // escreva a versão atualizada de volta para package.json
    writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));

    console.log(`Versão atualizada para ${newVersion}`);

    // adicione o package.json ao staging area
    shell.exec(`git add ./package.json`, {silent:true});

    // commit a mudança de versão
    shell.exec(`git commit -m "${description}"`, {silent:true});

    // crie uma nova tag
    shell.exec(`git tag v${newVersion}`, {silent:true});

    console.log(`Criada nova tag: v${newVersion}`);
}

main() */
