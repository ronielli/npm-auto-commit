# NPM Auto Commit

O **NPM Auto Commit** é uma ferramenta de linha de comando que agiliza o processo de commit em um repositório Git. Ele valida o ambiente (Git instalado, usuário configurado e repositório inicializado), gera a mensagem de commit com **IA**, cuida do **versionamento semântico** automaticamente e, opcionalmente, cria **tags** por ambiente.

Todo o fluxo é **interativo**: você revisa e edita a mensagem (e a anotação da tag) antes de confirmar.

## Requisitos

- **Git** instalado.
- **Node.js**.
- (Opcional) **`OPENAI_API_KEY`** — para a geração da mensagem por IA. Sem ela, a ferramenta continua funcionando usando a descrição que você digitar como mensagem.

## Instalação

```shell
yarn global add npm-auto-commit
# ou
npm install -g npm-auto-commit
# ou
npx npm-auto-commit
```

## Configuração da IA

Defina a variável de ambiente com sua chave da OpenAI:

```shell
export OPENAI_API_KEY="sua-chave-aqui"
```

Numa **única** chamada, a IA gera a mensagem de commit e — quando há tag — o título e o subtítulo dela. Se a chave não estiver definida (ou a chamada falhar/expirar), a ferramenta usa um fallback e não trava.

## Utilização

```shell
yarn commit -a "<tipo>: sua descrição - <detalhe opcional>"
```

Exemplo:

```shell
yarn commit -a "feat: adicionar autenticação"
```

## Opções (flags)

As flags de uma letra podem ser **combinadas** (ex.: `-atp`).

| Flag | Efeito |
|------|--------|
| `-a`, `-add` | Executa `git add .` antes do commit. |
| `-b` | Incrementa a versão **maior** (major), em vez de usar o tipo do commit. |
| `-t` | **Cria uma tag** com a nova versão. Sem `-t`, nenhuma tag é criada. |
| `-p` | Ambiente **production** (versão limpa). |
| `-s` | Ambiente **staging** (sufixo `-alpha`). |
| `-d` | Ambiente **development** (sufixo `-dev`). |
| `-v`, `--version` | Mostra a versão da própria ferramenta. |

> `-p`, `-s` e `-d` são **mutuamente exclusivos** — passar mais de um dá erro.

## Tipos de commit e versionamento

O tipo (prefixo) da mensagem define o incremento da versão:

| Tipo | Incremento |
|------|------------|
| **feat** | minor (`1.2.0` → `1.3.0`) |
| **fix** | patch (`1.2.0` → `1.2.1`) |
| **chore**, **refactor**, **test**, **docs** | nenhum |

- O prefixo que **você digitar é respeitado** — a IA não troca o tipo que você escolheu (ela só escolhe um quando você não informa).
- Com `-b`, o incremento é sempre **major**.
- A nova versão é gravada de forma **limpa** (sem `v`) no `package.json` e/ou no `pyproject.toml`.

## Ambientes e tags

Os ambientes definem o **sabor** da versão/tag. Eles **só criam tag** quando combinados com `-t`.

| Flag | Ambiente | Versão | Tag (com `-t`) |
|------|----------|--------|----------------|
| `-p` | production | `1.3.0` | `v1.3.0` |
| `-s` | staging | `1.3.0-alpha` | `v1.3.0-alpha` |
| `-d` | development | `1.3.0-dev` | `v1.3.0-dev` |

Regras importantes:

- A **tag sempre leva `v` na frente** quando há ambiente (`v1.3.0`, `v1.3.0-alpha`).
- Com `-t` + ambiente, garante-se ao menos um **patch** para a tag ter uma versão — mesmo num `chore`.
- **Sem `-t`**, um `chore`/`docs` não versiona nem gera tag.

Exemplos:

```shell
yarn commit -atp "feat: novo login"   # commit + tag v1.3.0 (production)
yarn commit -ats "fix: ajuste"        # commit + tag v1.2.1-alpha (staging)
yarn commit -ap  "chore: limpeza"     # apenas commit, sem tag e sem bump
```

## Fluxo interativo

Ao rodar, a ferramenta abre campos **editáveis** (pré-preenchidos):

1. **Mensagem de commit** — revise/edite e tecle Enter.
2. **Título e subtítulo da tag** — só aparecem quando há tag (`-t`); também editáveis.
3. **Resumo** — mostra arquivos, versão, ambiente e tag.
4. **Confirmação** — `s/n` para confirmar tudo.

**Cancelar** em qualquer etapa: deixe o campo vazio, responda "não" ou tecle **Ctrl+C** (o `git add` é desfeito com `git reset`).

## Detalhes do commit

Adicione um corpo ao commit usando o caractere `-` (hífen) após a descrição. O texto após o hífen vira um segundo parágrafo (`-m`) do commit:

```shell
yarn commit -a "feat: adicionar autenticação - implementa token JWT e refresh"
```

## Fluxo de execução

1. Verifica Git instalado, usuário configurado e repositório inicializado.
2. Executa `git pull`.
3. Se `-a`/`-add`, executa `git add .`.
4. **Verifica se há algo staged** — se não houver, encerra (antes de qualquer chamada à IA).
5. Faz **uma** chamada à IA gerando a mensagem (e, se houver tag, título/subtítulo).
6. Impõe o prefixo que você digitou sobre a mensagem da IA.
7. Abre os campos editáveis e o resumo; pede confirmação.
8. Ao confirmar: grava a versão no manifesto, faz o commit e `git push`.
9. Se `-t`: cria a tag (`git tag -f -a`) e envia com `git push origin <tag> --force`.

> Os comandos `git` que usam a mensagem são executados **sem shell** (array de argumentos), então caracteres como `$`, crase ou aspas ficam literais na mensagem.

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).
