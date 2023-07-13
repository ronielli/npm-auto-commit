# NPM Auto Commit

O NPM Auto Commit é uma ferramenta de linha de comando que facilita o processo de commit automático de alterações em um repositório git. Ele verifica se o Git está instalado, se o usuário do Git está configurado corretamente e se um repositório Git foi iniciado. Além disso, ele permite adicionar automaticamente arquivos modificados ou realizar o commit manualmente.

## Requisitos

- Git instalado

## Instalação

Para usar o NPM Auto Commit, siga as etapas abaixo:

1. Faça o clone deste repositório em sua máquina.
2. Navegue até o diretório raiz do projeto.
3. Execute o seguinte comando para instalar as dependências:

   ```shell
   yarn add npm-auto-commit -G
   ```

   ou

   ```shell
   npm install npm-auto-commit -g
   ```

   ou

   ```shell
    npx npm-auto-commit
   ```

## Utilização

Para usar o NPM Auto Commit, execute o seguinte comando:

```shell
yarn commit -a "<tipo>:sua descrição de commit"
```

Substitua `"sua descrição de commit"` pela descrição real do seu commit.

## Opções

O NPM Auto Commit também oferece algumas opções adicionais:

- `-add` ou `-a`: Adiciona automaticamente todos os arquivos modificados antes de fazer o commit.
- `-b`: Incrementa a versão maior (major) em vez de usar o tipo de commit para determinar o incremento da versão.
- `-file` ou `-f`: Indica que o versionamento será feito em um arquivo separado em vez do arquivo `package.json`.

## Tipos de Commit

O NPM Auto Commit reconhece os seguintes tipos de commit:

- **feat**: Para adição de uma nova funcionalidade. Incrementa a versão menor (minor).
- **fix**: Para correção de bugs. Incrementa a versão de correção (patch).
- **chore**: Para tarefas de manutenção ou ajustes internos. Não requer versionamento.
- **refactor**: Para refatoração de código existente. Não requer versionamento.
- **test**: Para adição ou modificação de testes. Não requer versionamento.
- **docs**: Para atualização ou adição de documentação. Não requer versionamento.

Quando um commit é do tipo `feat` (adiciona uma nova funcionalidade) ou `fix` (corrige um bug), a versão do projeto é incrementada automaticamente. Nos demais tipos de commit, o versionamento não é realizado.

Certifique-se de fornecer a descrição correta do commit, seguindo o padrão:

```
<tipo>: Descrição do commit
```

Por exemplo:

```
feat: Adicionar funcionalidade de autenticação
```

A descrição do commit será utilizada para determinar o tipo de commit e realizar o versionamento, se aplicável.

## Exemplo

Aqui está um exemplo de uso do NPM Auto Commit:

```shell
yarn commit -a "feat: Adicionar funcionalidade de autenticação"
```

## Fluxo de Execução

O NPM Auto Commit segue o seguinte fluxo de execução:

1. Verifica se o Git está instalado. Caso contrário, exibe uma mensagem de aviso e encerra o programa.
2. Verifica se o usuário do Git está configurado corretamente. Caso contrário, exibe uma mensagem de aviso e encerra o programa.
3. Verifica se um repositório Git foi iniciado. Caso contrário, exibe uma mensagem de aviso e encerra o programa.
4. Executa `git pull` para atualizar o repositório local.
5. Verifica se foram passados argumentos na linha de comando. Caso contrário, exibe uma mensagem de aviso e encerra o programa.
6. Extrai a descrição do commit dos argumentos passados.
7. Verifica se a opção `-add` foi passada. Caso positivo, executa `git add .` para adicionar todos os arquivos modificados ao commit.
8. Verifica se há arquivos modificados para commitar. Caso não haja, exibe uma mensagem informando que não há nada para commitar e encerra o programa.
9. Cria uma mensagem de commit com base na descrição fornecida.
10. Obtém a versão atual do projeto com base nas tags do Git.
11. Determina o tipo de versão com base no tipo de commit ou na opção `-b`.
12. Incrementa a versão atual com base no tipo de versão.
13. Verifica se o tipo de commit não requer versionamento. Caso seja verdadeiro, exibe uma mensagem de aviso e encerra o programa.
14. Exibe a mensagem de commit, a versão atual e a nova versão.
15. Pergunta ao usuário se deseja continuar.
16. Caso o usuário confirme, atualiza a versão no arquivo `package.json` ou em um arquivo separado, adiciona os arquivos alterados ao commit, realiza o commit com a mensagem fornecida e cria uma nova tag com a nova versão.
17. Executa `git push` para enviar as alterações para o repositório remoto.
18. Executa `git push --tags` para enviar as tags para o repositório remoto.
19. Exibe uma mensagem informando que o commit foi realizado com sucesso.

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).
