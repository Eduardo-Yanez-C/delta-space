"use client";

import { useRouter } from "next/navigation";
import { UserForm } from "../UserForm";
import { createUser } from "../../../lib/api";

export default function NuevoUsuarioPage() {
  const router = useRouter();

  return (
    <div className="card p-6">
      <h2 className="mb-6 text-lg font-semibold text-slate-900">Nuevo usuario</h2>
      <UserForm
        mode="create"
        onSubmit={async (data) => {
          await createUser({
            email: data.email,
            password: data.password,
            name: data.name?.trim() || undefined,
            fullName: data.fullName?.trim() || undefined,
            roleIds: data.roleIds,
            companyId: data.companyId,
            active: data.active ?? true,
            suiteNavGrants: data.suiteNavGrants,
            suiteAgentMonthlyTokenLimit: data.suiteAgentMonthlyTokenLimit,
            accessExpiresAt: data.accessExpiresAt,
          });
          router.push("/usuarios?success=created");
        }}
      />
    </div>
  );
}
