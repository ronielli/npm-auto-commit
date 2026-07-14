/**
 * Gera (ou revisa) a mensagem de commit via API da OpenAI.
 * Em caso de erro/timeout, retorna `commitMessage` sem alterar.
 */
export async function fetchCommitMessage(
  commitMessage: string,
  diff = '',
  opts?: {
    apiKey?: string;
    model?: string;
    endpoint?: string;
    timeoutMs?: number;
  },
): Promise<string> {
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
    return commitMessage;
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
        messages: [
          {
            role: 'system',
            content:
              'Você é um gerador de mensagens de commit.' +
              'Com base em um diff e em um comentário de contexto,' +
              'gere uma mensagem de commit em português, clara, curta e no estilo imperativo. ' +
              'adicione o prefixo fix:, feat:, chore:, se necessário.' +
              'preserve-o no início da mensagem. ' +
              'Sua saída deve ser apenas a mensagem de commit — sem explicações, sem texto adicional.' +
              'não use aspas no nome commit' +
              'não colocar - no nome commit',
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
      return commitMessage;
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
      return commitMessage;
    }

    // Log opcional para inspeção
    // console.log('[openai.commit] →', content);

    return content;
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

    return commitMessage;
  }
}

/**
 * Gera título e subtítulo para a anotação da tag (dois -m) via IA.
 * Em caso de erro/timeout/sem chave, retorna um fallback razoável.
 */
export async function fetchTagMessage(
  diff = '',
  context = '',
  opts?: {
    apiKey?: string;
    model?: string;
    endpoint?: string;
    timeoutMs?: number;
  },
): Promise<{ title: string; subtitle: string }> {
  const fallback = {
    title: context || 'Release',
    subtitle: 'Atualização de versão',
  };

  const OPENAI_API_KEY = opts?.apiKey ?? process.env.OPENAI_API_KEY;
  const MODEL = opts?.model ?? 'gpt-5-mini';
  const ENDPOINT =
    opts?.endpoint ?? 'https://api.openai.com/v1/chat/completions';
  const TIMEOUT_MS = Math.max(1000, opts?.timeoutMs ?? 30_000);

  if (!OPENAI_API_KEY) return fallback;

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
        messages: [
          {
            role: 'system',
            content:
              'Você gera anotações de tag de release em português. ' +
              'Com base no diff e no contexto, responda em EXATAMENTE duas linhas: ' +
              'a primeira é um título curto (headline da release), ' +
              'a segunda é um subtítulo com um resumo em uma frase. ' +
              'Não use aspas, markdown ou explicações.',
          },
          {
            role: 'user',
            content: `diff:\n${diff.slice(0, 100_000)}\ncontexto:\n${context}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return fallback;

    const data = await response.json();
    const content: string | undefined =
      data?.choices?.[0]?.message?.content?.trim();

    if (!content) return fallback;

    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    // Aspas quebram o comando git no shell — removidas por segurança.
    const title = (lines[0] ?? fallback.title).replace(/"/g, '');
    const subtitle = (lines.slice(1).join(' ') || fallback.subtitle).replace(
      /"/g,
      '',
    );

    return { title, subtitle };
  } catch {
    clearTimeout(timeout);
    return fallback;
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
