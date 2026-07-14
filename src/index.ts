import { execSync } from 'child_process';

import { inc } from 'semver';
import Enquirer from 'enquirer';

import pk from '../package.json';

import { fetchCommitAndTag } from './utils/reviseCommitMessage.util';
import Message from './utils/message.util';
import handleType from './utils/handleType.util';
import updatePackageVersion from './utils/updatePackageVersion.util';
import { Environment, resolveEnvironment } from './utils/environments.util';
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
  const description = args.find((arg) => !arg.startsWith('-'))?.trim() || '';

  const flags = collectFlags(args);

  const add = flags.has('a');
  const bigger = flags.has('b');
  const tagFlag = flags.has('t');

  let environment: Environment | undefined;
  try {
    environment = resolveEnvironment(flags);
  } catch (error) {
    console.log(red((error as Error).message));
    process.exit(1);
  }

  // A tag é criada quando -t é passado OU quando há um ambiente (-p/-s/-d).
  const shouldTag = tagFlag || !!environment;

  if (add) execSync(`git add .`, { cwd: currentDirectory });

  // Uma única chamada à IA gera a mensagem, o título e o subtítulo da tag.
  const diff = Message.diffCommit();
  const ai = await fetchCommitAndTag(description, diff);

  const message = new Message(ai.message);

  verifyStatus();

  const files = listFiles();
  console.log(green('Arquivos que serão comitados:'), files.join(', '));

  const currentVersion = getCurrentTag();

  let finalMessage!: Message;
  let newVersion: string | null = null;
  let tagName: string | null = null;
  let tagTitle = '';
  let tagSubtitle = '';

  try {
    // 1) Edita a mensagem de commit (pré-preenchida com a sugestão da IA).
    const editedMessage = (
      await askInput('Mensagem de commit', message.toString())
    ).trim();

    if (editedMessage.length === 0) {
      cancel();
      return;
    }

    // O construtor valida o prefixo; se inválido, encerra com aviso.
    finalMessage = new Message(editedMessage);

    ({ newVersion, tagName } = computeVersion(
      finalMessage,
      environment,
      bigger,
      currentVersion,
    ));

    // 2) Edita título e subtítulo da tag (já gerados na chamada única acima).
    if (shouldTag && tagName) {
      tagTitle = (await askInput('Título da tag', ai.tagTitle)).trim();
      tagSubtitle = (await askInput('Subtítulo da tag', ai.tagSubtitle)).trim();
    }

    // 3) Resumo de todas as informações.
    console.log(green('\n─────── Resumo ───────'));
    console.log(green('Mensagem: '), finalMessage.toString());
    console.log(green('Arquivos: '), files.join(', '));
    if (newVersion) {
      console.log(green('Versão:   '), `${currentVersion} → ${newVersion}`);
    }
    if (shouldTag && tagName) {
      console.log(green('Ambiente: '), environment?.name ?? '—');
      console.log(green('Tag:      '), tagName);
      console.log(green('Título:   '), tagTitle);
      console.log(green('Subtítulo:'), tagSubtitle);
    }

    // 4) Confirmação final de tudo.
    const confirmed = await askConfirm('Confirmar todas as informações?');

    if (!confirmed) {
      cancel();
      return;
    }
  } catch {
    // Ctrl+C ou cancelamento do prompt cai aqui.
    cancel();
    return;
  }

  // Execução fora do try, para não mascarar erros reais do git como cancelamento.
  if (newVersion) {
    updatePackageVersion(newVersion, currentDirectory);
  }

  execSync(finalMessage.toCommit(), { cwd: currentDirectory });
  execSync(`git push`, { cwd: currentDirectory });

  if (shouldTag && tagName) {
    // Aspas digitadas quebrariam o comando no shell — removidas por segurança.
    const safeTitle = (tagTitle || finalMessage.toString()).replace(/"/g, '');
    const safeSubtitle = tagSubtitle.replace(/"/g, '');

    // -f permite reaproveitar o mesmo nome de tag em staging/dev.
    const tagCmd = safeSubtitle
      ? `git tag -f -a ${tagName} -m "${safeTitle}" -m "${safeSubtitle}"`
      : `git tag -f -a ${tagName} -m "${safeTitle}"`;

    execSync(tagCmd, { cwd: currentDirectory });
    execSync(`git push origin ${tagName} --force`, { cwd: currentDirectory });
  }

  console.log(green('Commit realizado com sucesso!'));
}

/** Desfaz o stage, sinalizando cancelamento. */
function cancel() {
  execSync(`git reset`, { cwd: currentDirectory });
  console.log(yellow('\nCommit cancelado!'));
}

/** Campo de texto editável (estilo Claude Code), pré-preenchido com `initial`. */
async function askInput(message: string, initial: string): Promise<string> {
  const { value } = await Enquirer.prompt<{ value: string }>({
    type: 'input',
    name: 'value',
    message,
    initial,
  });
  return value ?? '';
}

/** Confirmação sim/não (padrão: sim). */
async function askConfirm(message: string): Promise<boolean> {
  const { value } = await Enquirer.prompt<{ value: boolean }>({
    type: 'confirm',
    name: 'value',
    message,
    initial: true,
  });
  return value;
}

/**
 * Calcula a nova versão e o nome da tag a partir da mensagem final.
 * Mantido separado para poder recalcular após o usuário editar a mensagem.
 */
function computeVersion(
  message: Message,
  environment: Environment | undefined,
  bigger: boolean,
  currentVersion: string,
) {
  let versionType = bigger ? 'major' : handleType(message.getType());

  // Dentro de um ambiente, garante ao menos um patch para gerar a tag,
  // mesmo em tipos que normalmente não versionam (chore, docs, etc.).
  if (environment && !versionType) {
    versionType = 'patch';
  }

  const base = inc(currentVersion, versionType as 'major' | 'minor' | 'patch');

  // Versão do manifesto: sempre limpa (com identificador, sem "v").
  const newVersion =
    base && environment?.identifier
      ? `${base}-${environment.identifier}`
      : base;

  // Nome da tag: leva "v" na frente quando há ambiente.
  const tagName = newVersion
    ? environment
      ? `v${newVersion}`
      : newVersion
    : null;

  return { newVersion, tagName };
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

/**
 * Coleta as letras das flags curtas passadas na linha de comando.
 * Ex.: ['-at', '-p'] → Set {'a', 't', 'p'}.
 * A grafia legada "-add" é tratada como apenas 'a'.
 */
function collectFlags(args: string[]): Set<string> {
  const flags = new Set<string>();

  for (const arg of args) {
    if (!arg.startsWith('-')) continue;

    if (arg === '-add') {
      flags.add('a');
      continue;
    }

    // Ignora flags longas (--version, etc.) na coleta de letras.
    if (arg.startsWith('--')) continue;

    for (const ch of arg.slice(1)) {
      flags.add(ch);
    }
  }

  return flags;
}
