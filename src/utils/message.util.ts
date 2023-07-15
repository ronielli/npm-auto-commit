import { green, red, yellow } from './colors.util';

class Mensagem {
  private type: 'feat' | 'fix' | 'docs' | 'refactor' | 'test' | 'chore';
  private scope: string;
  private description: string;
  private validType = ['feat', 'fix', 'docs', 'refactor', 'test', 'chore'];

  constructor(message: string) {
    message = message.trim();

    this.type = this.handleType(message);
    this.scope = this.handleScope(message);
    this.description = this.handleDescription(message);
    const [title] = this.description.split('-');

    if (title.trim().length === 0) {
      console.log(yellow('Mensagem inválida! Não há título!'));
      console.log(
        yellow('Exemplo:'),
        green(
          'yarn npm-auto-commit -a "feat: Adicionar funcionalidade de autenticação"',
        ),
      );
      process.exit(1);
    }
  }

  handleType(message: string) {
    const type = this.validType.find((item) => message.startsWith(item));

    if (!type) {
      console.log(red('Prefixo inválido!'));
      console.log(
        yellow('Prefixos válidos:'),
        green(this.validType.join(', ')),
      );
      process.exit(1);
    }
    return type as 'feat' | 'fix' | 'docs' | 'refactor' | 'test' | 'chore';
  }

  handleScope(message: string) {
    const [type] = message.split(':');
    if (!type) {
      console.log(red('Mensagem inválida!'));
      console.log(
        yellow('Exemplo:'),
        green(
          'yarn npm-auto-commit -a "feat: Adicionar funcionalidade de autenticação"',
        ),
      );
      process.exit(1);
    }

    const scope = message.match(/\((.*?)\)/);

    return scope ? scope[1] : '';
  }

  handleDescription(message: string) {
    const [, description] = message.split(':');
    if (!description) {
      console.log(red('Mensagem inválida!'));
      console.log(
        yellow('Exemplo:'),
        green(
          'yarn npm-auto-commit -a "feat: Adicionar funcionalidade de autenticação"',
        ),
      );
      process.exit(1);
    }

    return description.trim();
  }

  getDescription() {
    return this.description;
  }

  getScope() {
    return this.scope;
  }

  getType() {
    return this.type;
  }

  toString() {
    return `${this.type}${this.scope ? `(${this.scope})` : ''}: ${
      this.description
    }`;
  }

  toCommit() {
    const [title, ...rest] = this.description.split('-');

    const mensagem = `git commit -m "${this.type}${
      this.scope ? `(${this.scope})` : ''
    }: ${title.trim()}"${
      rest.length === 0
        ? ''
        : ` -m "${rest
            .map((item) => `- ${item.trim()}`)
            .reduce((acc, item) => `${acc}\n${item}`)}"`
    }`;

    return mensagem;
  }
}

export default Mensagem;
