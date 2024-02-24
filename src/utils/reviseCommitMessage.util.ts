async function fetchCommitMessage(commitMessage: string): Promise<string> {
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
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Seu objetivo é fornecer uma versão melhorada e formatada de uma mensagem de commit com base na descrição fornecida.
                        Não adicione comentários adicionais.
                        foque apenas na mensagem de commit.
                        "Mantenha o prefixo especificado (fix:, feat:, etc.) inalterado no início da mensagem. remova os espaços em branco desnecessários e deixar sempre em caixa baixa".
                        Mantenha o tempo verbal fornecido na descrição original.
                        Mantenha a descrição original intacta.
                        Revise a mensagem para garantir que está conforme as diretrizes de formatação.
                        "não Utilize verbos no infinitivo, use apenas se houver referência ao usuário no texto".
                        prefira usar sempre terceira pessoa do plural.`,
            },
            {
              role: 'user',
              content: commitMessage,
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
