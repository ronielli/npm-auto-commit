export interface Environment {
  /** Letra usada na flag (ex.: 'p' → -p). */
  flag: string;
  /** Nome do ambiente. */
  name: string;
  /** Sufixo de pré-lançamento aplicado à versão (vazio = versão limpa). */
  identifier: string;
  /** Branch/alvo do ambiente (reservado para uso futuro). */
  target: string;
}

/**
 * Definição dos ambientes suportados.
 * Futuramente pode ser lido de [tool.autocommit.env.*] no pyproject.toml.
 */
export const ENVIRONMENTS: Environment[] = [
  { flag: 'p', name: 'production', identifier: '', target: 'main' },
  { flag: 's', name: 'staging', identifier: 'alpha', target: 'staging' },
  { flag: 'd', name: 'development', identifier: 'dev', target: 'development' },
];

/**
 * Resolve o ambiente a partir das flags coletadas.
 * Lança erro se mais de um ambiente for informado (são mutuamente exclusivos).
 */
export function resolveEnvironment(
  flags: Set<string>,
): Environment | undefined {
  const matched = ENVIRONMENTS.filter((env) => flags.has(env.flag));

  if (matched.length > 1) {
    throw new Error(
      `Ambientes conflitantes: ${matched
        .map((e) => `-${e.flag} (${e.name})`)
        .join(', ')}. Escolha apenas um.`,
    );
  }

  return matched[0];
}
