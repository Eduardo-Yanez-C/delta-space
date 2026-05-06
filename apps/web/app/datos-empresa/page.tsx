"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompanyProfile } from "../../lib/api";
import {
  deleteCompanyLogo,
  fetchCompanyLogoBlob,
  fetchCompanyProfile,
  patchCompanyProfile,
  uploadCompanyLogo,
} from "../../lib/api";
import { formatRutInput, rutToStorageString } from "../../lib/chile-inputs";
import { notifyCompanyBrandingChanged } from "../../lib/company-branding-events";

function str(v: string | null | undefined): string {
  return v ?? "";
}

type FormState = {
  commercialName: string;
  legalName: string;
  taxId: string;
  businessActivity: string;
  address: string;
  commune: string;
  region: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  instagramUrl: string;
  facebookUrl: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
  accountHolderTaxId: string;
  transferReceiptEmail: string;
  generalNotes: string;
  quoteNote: string;
  paymentTerms: string;
};

function profileToForm(p: CompanyProfile): FormState {
  return {
    commercialName: str(p.commercialName),
    legalName: str(p.legalName),
    taxId: formatRutInput(str(p.taxId)),
    businessActivity: str(p.businessActivity),
    address: str(p.address),
    commune: str(p.commune),
    region: str(p.region),
    country: str(p.country),
    phone: str(p.phone),
    email: str(p.email),
    website: str(p.website),
    instagramUrl: str(p.instagramUrl),
    facebookUrl: str(p.facebookUrl),
    bankName: str(p.bankName),
    accountType: str(p.accountType),
    accountNumber: str(p.accountNumber),
    accountHolderName: str(p.accountHolderName),
    accountHolderTaxId: formatRutInput(str(p.accountHolderTaxId)),
    transferReceiptEmail: str(p.transferReceiptEmail),
    generalNotes: str(p.generalNotes),
    quoteNote: str(p.quoteNote),
    paymentTerms: str(p.paymentTerms),
  };
}

function formToPatch(f: FormState): Record<string, string | null> {
  const trimOrNull = (s: string) => {
    const t = s.trim();
    return t === "" ? null : t;
  };
  return {
    commercialName: trimOrNull(f.commercialName),
    legalName: trimOrNull(f.legalName),
    taxId: (() => {
      const t = rutToStorageString(f.taxId);
      return t === "" ? null : t;
    })(),
    businessActivity: trimOrNull(f.businessActivity),
    address: trimOrNull(f.address),
    commune: trimOrNull(f.commune),
    region: trimOrNull(f.region),
    country: trimOrNull(f.country),
    phone: trimOrNull(f.phone),
    email: trimOrNull(f.email),
    website: trimOrNull(f.website),
    instagramUrl: trimOrNull(f.instagramUrl),
    facebookUrl: trimOrNull(f.facebookUrl),
    bankName: trimOrNull(f.bankName),
    accountType: trimOrNull(f.accountType),
    accountNumber: trimOrNull(f.accountNumber),
    accountHolderName: trimOrNull(f.accountHolderName),
    accountHolderTaxId: (() => {
      const t = rutToStorageString(f.accountHolderTaxId);
      return t === "" ? null : t;
    })(),
    transferReceiptEmail: trimOrNull(f.transferReceiptEmail),
    generalNotes: trimOrNull(f.generalNotes),
    quoteNote: trimOrNull(f.quoteNote),
    paymentTerms: trimOrNull(f.paymentTerms),
  };
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  rows,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {rows != null ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="input-field w-full"
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field w-full"
        />
      )}
    </div>
  );
}

export default function DatosEmpresaPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formSaveOk, setFormSaveOk] = useState<string | null>(null);
  const [logoSaveOk, setLogoSaveOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadError(null);
    const p = await fetchCompanyProfile();
    setProfile(p);
    setForm(profileToForm(p));
    return p;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadProfile()
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!profile?.hasLogo) {
      setLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchCompanyLogoBlob()
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setLogoPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLogoPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.hasLogo, profile?.updatedAt]);

  const setField = (key: keyof FormState, value: string) => {
    setFormSaveOk(null);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaveError(null);
    setFormSaveOk(null);
    setSaving(true);
    try {
      const updated = await patchCompanyProfile(formToPatch(form));
      setProfile(updated);
      setForm(profileToForm(updated));
      setFormSaveOk("Datos guardados correctamente.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoBusy(true);
    setSaveError(null);
    try {
      const updated = await uploadCompanyLogo(file);
      setProfile(updated);
      setLogoSaveOk("Logo actualizado.");
      notifyCompanyBrandingChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al subir logo");
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm("¿Quitar el logo de la empresa?")) return;
    setLogoBusy(true);
    setSaveError(null);
    try {
      const updated = await deleteCompanyLogo();
      setProfile(updated);
      setLogoSaveOk("Logo eliminado.");
      notifyCompanyBrandingChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al quitar logo");
    } finally {
      setLogoBusy(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        {loadError ?? "Cargando perfil de empresa…"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Fuente maestra de datos corporativos. Identidad, contacto, logo y redes se reflejan en la vista previa e impresión/PDF de
        la cotización.
      </p>

      {saveError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
          role="alert"
        >
          {saveError}
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Logo</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-32 w-full max-w-[200px] items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo de la empresa" className="max-h-full max-w-full object-contain p-2" />
            ) : (
              <span className="px-2 text-center text-xs text-slate-500 dark:text-slate-400">Sin logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="btn-secondary inline-flex cursor-pointer items-center justify-center text-sm disabled:opacity-50">
              {logoBusy ? "Procesando…" : profile?.hasLogo ? "Reemplazar logo" : "Subir logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={logoBusy}
                onChange={(ev) => void handleLogoFile(ev)}
              />
            </label>
            {profile?.hasLogo && (
              <button type="button" className="btn-secondary text-sm text-red-700 dark:text-red-400" disabled={logoBusy} onClick={() => void handleRemoveLogo()}>
                Quitar logo
              </button>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPEG o WebP. Máximo 5 MB.</p>
            {logoSaveOk && (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
                {logoSaveOk}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Identidad</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre comercial" id="commercialName" value={form.commercialName} onChange={(v) => setField("commercialName", v)} />
            <Field label="Razón social" id="legalName" value={form.legalName} onChange={(v) => setField("legalName", v)} />
            <Field label="RUT" id="taxId" value={form.taxId} onChange={(v) => setField("taxId", formatRutInput(v))} />
            <Field label="Giro (opcional)" id="businessActivity" value={form.businessActivity} onChange={(v) => setField("businessActivity", v)} />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Contacto</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Dirección" id="address" value={form.address} onChange={(v) => setField("address", v)} />
            <Field label="Comuna / ciudad" id="commune" value={form.commune} onChange={(v) => setField("commune", v)} />
            <Field label="Región" id="region" value={form.region} onChange={(v) => setField("region", v)} />
            <Field label="País" id="country" value={form.country} onChange={(v) => setField("country", v)} placeholder="Chile" />
            <Field label="Teléfono" id="phone" value={form.phone} onChange={(v) => setField("phone", v)} type="tel" />
            <Field label="Correo" id="email" value={form.email} onChange={(v) => setField("email", v)} type="email" />
            <div className="md:col-span-2">
              <Field label="Sitio web" id="website" value={form.website} onChange={(v) => setField("website", v)} placeholder="https://..." />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Redes sociales</h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Pegue la URL completa del perfil o página pública (con https://).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Instagram"
              id="instagramUrl"
              value={form.instagramUrl}
              onChange={(v) => setField("instagramUrl", v)}
              type="url"
              placeholder="https://www.instagram.com/su_empresa"
            />
            <Field
              label="Facebook"
              id="facebookUrl"
              value={form.facebookUrl}
              onChange={(v) => setField("facebookUrl", v)}
              type="url"
              placeholder="https://www.facebook.com/su_pagina"
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Transferencia bancaria</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Banco" id="bankName" value={form.bankName} onChange={(v) => setField("bankName", v)} />
            <Field label="Tipo de cuenta" id="accountType" value={form.accountType} onChange={(v) => setField("accountType", v)} placeholder="Cuenta corriente / vista" />
            <Field label="Número de cuenta" id="accountNumber" value={form.accountNumber} onChange={(v) => setField("accountNumber", v)} />
            <Field label="Titular" id="accountHolderName" value={form.accountHolderName} onChange={(v) => setField("accountHolderName", v)} />
            <Field
              label="RUT del titular"
              id="accountHolderTaxId"
              value={form.accountHolderTaxId}
              onChange={(v) => setField("accountHolderTaxId", formatRutInput(v))}
            />
            <Field
              label="Correo para comprobante"
              id="transferReceiptEmail"
              value={form.transferReceiptEmail}
              onChange={(v) => setField("transferReceiptEmail", v)}
              type="email"
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Texto comercial / legal</h2>
          <div className="space-y-4">
            <Field label="Observación general" id="generalNotes" value={form.generalNotes} onChange={(v) => setField("generalNotes", v)} rows={3} />
            <Field label="Nota para cotización" id="quoteNote" value={form.quoteNote} onChange={(v) => setField("quoteNote", v)} rows={3} />
            <Field label="Condiciones de pago" id="paymentTerms" value={form.paymentTerms} onChange={(v) => setField("paymentTerms", v)} rows={4} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar datos"}
          </button>
          {formSaveOk && (
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
              {formSaveOk}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
