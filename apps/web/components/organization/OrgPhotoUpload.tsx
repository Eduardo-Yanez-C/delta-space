"use client";

/**
 * Campo de foto por URL con vista previa (sin subida a servidor: pegue URL https público).
 */
export function OrgPhotoUpload({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  hint: string;
}) {
  const trimmed = value.trim();
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--pmo-text-muted)]">
        {label}
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
          className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-1.5 text-xs"
        />
      </label>
      <p className="text-[10px] leading-snug text-[var(--pmo-text-muted)]">{hint}</p>
      {trimmed ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] p-2">
          <div
            className="h-14 w-14 shrink-0 rounded-md border border-[var(--pmo-border)] bg-cover bg-center"
            style={{ backgroundImage: `url(${trimmed})` }}
          />
          <span className="min-w-0 truncate text-[10px] text-[var(--pmo-text-muted)]">{trimmed}</span>
        </div>
      ) : null}
    </div>
  );
}
