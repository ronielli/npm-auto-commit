/** Resultado da geração combinada: mensagem de commit + anotação da tag. */
export type CommitAndTag = {
  message: string;
  tagTitle: string;
  tagSubtitle: string;
};

/**
 * Gera, numa ÚNICA chamada à IA, a mensagem de commit e o título/subtítulo
 * da tag (JSON estruturado). Economiza uma requisição e metade dos tokens.
 * Em caso de erro/timeout/sem chave, retorna um fallback razoável.
 */
export async function fetchCommitAndTag(
  commitMessage: string,
  diff = '',
  opts?: {
    includeTag?: boolean;
    apiKey?: string;
    model?: string;
    endpoint?: string;
    timeoutMs?: number;
  },
): Promise<CommitAndTag> {
  // Só pede título/subtítulo da tag quando realmente vai haver tag (-t/-p/-s/-d).
  const includeTag = opts?.includeTag ?? true;

  const fallback: CommitAndTag = {
    message: commitMessage,
    tagTitle: commitMessage || 'Release',
    tagSubtitle: 'Atualização de versão',
  };

  const OPENAI_API_KEY = opts?.apiKey ?? process.env.OPENAI_API_KEY;
  const MODEL = opts?.model ?? 'gpt-5-mini';
  const ENDPOINT =
    opts?.endpoint ?? 'https://api.openai.com/v1/chat/completions';
  const TIMEOUT_MS = Math.max(1000, opts?.timeoutMs ?? 30_000);

  if (!OPENAI_API_KEY) {
    console.error(
      formatError({
        stage: 'CONFIG',
        message: 'Variável de ambiente OPENAI_API_KEY ausente.',
        hint: 'Defina OPENAI_API_KEY e tente novamente.',
      }),
    );
    return fallback;
  }

  // Timeout controlado por AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: includeTag
              ? 'Você gera, em português, uma mensagem de commit e a anotação ' +
                'de uma tag de release, com base num diff e num comentário de ' +
                'contexto. Responda APENAS um objeto JSON com as chaves: ' +
                '"message" (mensagem de commit curta, imperativa, com prefixo ' +
                'feat:/fix:/chore:/etc. no início, sem aspas e sem hífen), ' +
                '"tagTitle" (título curto, headline da release) e ' +
                '"tagSubtitle" (UMA frase curta resumindo as mudanças). ' +
                'IMPORTANTE: se o comentário já começar com um prefixo ' +
                '(feat:/fix:/chore:/docs:/refactor:/test:), PRESERVE exatamente ' +
                'esse prefixo; só escolha um quando o comentário não tiver. ' +
                'Não use aspas internas, markdown nem texto fora do JSON.'
              : 'Você gera, em português, uma mensagem de commit com base num ' +
                'diff e num comentário de contexto. Responda APENAS um objeto ' +
                'JSON com a chave "message" (mensagem de commit curta, ' +
                'imperativa, com prefixo feat:/fix:/chore:/etc. no início, ' +
                'sem aspas e sem hífen). IMPORTANTE: se o comentário já começar ' +
                'com um prefixo (feat:/fix:/chore:/docs:/refactor:/test:), ' +
                'PRESERVE exatamente esse prefixo; só escolha um quando o ' +
                'comentário não tiver. Sem markdown nem texto fora do JSON.',
          },
          {
            role: 'user',
            content: `diff:\n${diff.slice(
              0,
              100_000,
            )}\ncomentário:\n${commitMessage}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Trata respostas não-2xx com detalhes da API
    if (!response.ok) {
      const apiErr = await parseApiError(response);
      console.error(
        formatError({
          stage: 'API',
          message: 'Falha na chamada à OpenAI.',
          httpStatus: `${response.status} ${response.statusText}`,
          requestId: response.headers.get('x-request-id') ?? undefined,
          apiError: apiErr,
          hint: 'Verifique o modelo, sua quota e a validade da OPENAI_API_KEY.',
        }),
      );
      return fallback;
    }

    const data = await response.json();

    const content: string | undefined =
      data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error(
        formatError({
          stage: 'PARSE',
          message:
            'Resposta da API sem conteúdo esperado em choices[0].message.content.',
          hint: 'Tente novamente; se persistir, ative logs em nível debug.',
        }),
      );
      return fallback;
    }

    return parseCommitAndTag(content, fallback);
  } catch (err: unknown) {
    clearTimeout(timeout);

    if (isAbortError(err)) {
      console.error(
        formatError({
          stage: 'TIMEOUT',
          message: `Tempo limite excedido após ${TIMEOUT_MS}ms.`,
          hint: 'Aumente o timeout ou verifique sua conexão.',
        }),
      );
    } else {
      console.error(
        formatError({
          stage: 'RUNTIME',
          message: getErrorMessage(err),
          hint: 'Cheque a conectividade e tente novamente.',
        }),
      );
    }

    return fallback;
  }
}

/** Faz o parse robusto do JSON retornado, com sanitização e fallback. */
function parseCommitAndTag(
  content: string,
  fallback: CommitAndTag,
): CommitAndTag {
  // Aspas quebram o comando git no shell — removidas por segurança.
  const clean = (value: unknown, fb: string) =>
    (typeof value === 'string' && value.trim() ? value.trim() : fb).replace(
      /"/g,
      '',
    );

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      message: clean(parsed.message, fallback.message),
      tagTitle: clean(parsed.tagTitle, fallback.tagTitle),
      tagSubtitle: clean(parsed.tagSubtitle, fallback.tagSubtitle),
    };
  } catch {
    // Sem JSON válido: usa o conteúdo bruto como mensagem de commit.
    return { ...fallback, message: content.replace(/"/g, '') };
  }
}

/* ===========================
 * Utilitários de erro/log
 * ===========================
 */

/** Estrutura de detalhes para formatar logs de erro de forma consistente. */
type LogError = {
  stage: 'CONFIG' | 'API' | 'PARSE' | 'TIMEOUT' | 'RUNTIME';
  message: string;
  httpStatus?: string;
  requestId?: string;
  apiError?: {
    type?: string;
    code?: string | number;
    param?: string;
    message?: string;
  };
  hint?: string;
};

/** Formata o erro em múltiplas linhas com blocos identificáveis. */
function formatError(e: LogError): string {
  const lines = [
    '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `┃ ❌ Erro [${e.stage}]`,
    '┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `┃ Mensagem: ${e.message}`,
  ];

  if (e.httpStatus) lines.push(`┃ HTTP: ${e.httpStatus}`);
  if (e.requestId) lines.push(`┃ Request-ID: ${e.requestId}`);

  if (e.apiError) {
    const { type, code, param, message } = e.apiError;
    lines.push('┃ Detalhes da API:');
    if (type) lines.push(`┃   • type: ${type}`);
    if (code) lines.push(`┃   • code: ${code}`);
    if (param) lines.push(`┃   • param: ${param}`);
    if (message) lines.push(`┃   • message: ${message}`);
  }

  if (e.hint)
    lines.push(
      '┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `┃ 💡 Dica: ${e.hint}`,
    );
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

/** Extrai detalhes padronizados do corpo de erro da OpenAI (quando houver). */
async function parseApiError(
  response: Response,
): Promise<LogError['apiError']> {
  try {
    const data = await response.json();
    // formatos comuns: { error: { message, type, param, code } }
    if (data?.error && typeof data.error === 'object') {
      const { message, type, param, code } = data.error as Record<
        string,
        unknown
      >;
      return {
        message: typeof message === 'string' ? message : undefined,
        type: typeof type === 'string' ? type : undefined,
        param: typeof param === 'string' ? param : undefined,
        code:
          typeof code === 'string' || typeof code === 'number'
            ? code
            : undefined,
      };
    }
  } catch {
    // ignorado — pode ser corpo vazio ou não-JSON
  }
  return {};
}

/** Normaliza mensagem de erro desconhecida. */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Detecta AbortError de forma cross-runtime. */
function isAbortError(err: unknown): boolean {
  return !!(
    err &&
    typeof err === 'object' &&
    'name' in err &&
    (err as any).name === 'AbortError'
  );
}
