export class CreateUserInvitationDto {
  email?: string;
  companyId?: string;
  roleIds?: number[];
  /** ISO 8601 o null. Si se omite: 7 días desde ahora. */
  expiresAt?: string | null;
  nameHint?: string | null;
  fullNameHint?: string | null;
}

