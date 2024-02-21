import { green, red, yellow } from './colors.util';

function handleType(message: string) {
  switch (message) {
    case 'feat':
      return 'minor';
    case 'fix':
      return 'patch';
    case 'chore':
      return '';
    case 'refactor':
      return '';
    case 'test':
      return '';
    case 'docs':
      return '';

    default:
      console.log(red('Tipo de commit inválido!'));
      console.log(
        yellow('Tipos válidos:'),
        green('feat, fix, docs, refactor, test, chore'),
      );
      process.exit(1);
  }
}
export default handleType;
