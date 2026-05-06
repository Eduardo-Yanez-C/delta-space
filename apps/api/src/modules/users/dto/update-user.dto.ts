export class UpdateUserDto {
  name?: string | null;
  fullName?: string | null;
  active?: boolean;
  roleIds?: number[];
  suiteNavGrants?: unknown;
  /** null = sin límite; entero >= 0 tokens/mes UTC (asistente suite). */
  suiteAgentMonthlyTokenLimit?: number | null;
}
