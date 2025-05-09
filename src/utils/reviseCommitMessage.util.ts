async function fetchCommitMessage(
  commitMessage: string,
  diff = '',
): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('API key is missing');
    return commitMessage; // Retorna a mensagem original se a chave da API não estiver disponível
  }

  const fetchTimeout = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(commitMessage);
    }, 10000);
  });

  try {
    const response = await Promise.race([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content:
                'Você é um gerador de mensagens de commit. Com base em um diff e em um comentário de contexto, gere uma mensagem de commit em português, clara, curta e no estilo imperativo. Se a entrada contiver um prefixo como fix:, feat:, chore:, preserve-o no início da mensagem. Sua saída deve ser apenas a mensagem de commit — sem explicações, sem texto adicional.',
            },
            {
              role: 'user',
              content: `diff:
                ${diff}
                comentário:
                    ${commitMessage}`,
            },
          ],
        }),
      }),
      fetchTimeout,
    ]);

    // Se o timeout resolver primeiro, response será a mensagem de commit original
    if (typeof response === 'string') {
      return response; // Retorna a mensagem original de commit devido ao tempo limite
    }

    const data = await response.json();

    if (
      response.ok &&
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0].message.content
    ) {
      return data.choices[0].message.content; // Retorna a mensagem de commit revisada
    } else {
      throw new Error('Resposta da API sem conteúdo esperado');
    }
  } catch (error) {
    console.error(
      'Erro ao fazer a requisição ou ao processar a resposta:',
      error,
    );
    return commitMessage; // Retorna a mensagem de commit original em caso de erro
  }
}

export { fetchCommitMessage };
