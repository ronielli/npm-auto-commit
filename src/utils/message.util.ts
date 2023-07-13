import { green, red, yellow } from './colors.util';

class Mensagem {
  private type: 'feat' | 'fix' | 'docs' | 'refactor' | 'test' | 'chore';
  private scope: string;
  private description: string;
  private validType = ['feat', 'fix', 'docs', 'refactor', 'test', 'chore'];

  constructor(message: string) {
    // verificar se a mensagem é válida
    message = message.trim();

    this.type = this.handleType(message);
    this.scope = this.handleScope(message);
    this.description = this.handleDescription(message);
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
    return `git commit -m "${this.type}${
      this.scope ? `(${this.scope})` : ''
    }: ${title}" -m "${rest.map((item) => item.trim())}"`;
  }
}

export default Mensagem;
