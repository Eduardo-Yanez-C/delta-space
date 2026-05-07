export class CreateUserDto {
  email?: string;
  password?: string;
  name?: string | null;
  fullName?: string | null;
  active?: boolean;
  roleIds?: number[];
  companyId?: string;
  /** Claves de menú suite permitidas; null = sin restricción. */
  suiteNavGrants?: unknown;
  /** null = sin límite; entero >= 0 tokens/mes UTC (asistente suite). */
  suiteAgentMonthlyTokenLimit?: number | null;
  /** ISO 8601 o null: tras esta fecha el usuario no puede acceder. Omitir = sin caducidad. */
  accessExpiresAt?: string | null;
}
