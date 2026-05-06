"use client";

import { useEffect, useState } from "react";
import { OrgPhotoUpload } from "./OrgPhotoUpload";

export type OrgDrawerNode = {
  id: string;
  name: string;
  role: string;
  category?: string | null;
  parentId?: string | null;
  linkToId?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  order: number;
  active: boolean;
};

type OrgLabels = Record<string, string>;

export function OrgNodeDetailDrawer({
  open,
  node,
  parentNode,
  linkTargetNode,
  childNodes,
  parentOptions,
  linkTargetOptions,
  hierarchyLevel,
  labels,
  saving,
  onClose,
  onSave,
  onSelectNode,
  onCreateSubordinate,
}: {
  open: boolean;
  node: OrgDrawerNode | null;
  parentNode: OrgDrawerNode | null;
  linkTargetNode: OrgDrawerNode | null;
  childNodes: OrgDrawerNode[];
  parentOptions: OrgDrawerNode[];
  linkTargetOptions: OrgDrawerNode[];
  hierarchyLevel: number;
  labels: OrgLabels;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    role: string;
    category: string | null;
    email: string | null;
    phone: string | null;
    order: number;
    photoUrl: string | null;
    parentId: string | null;
    linkToId: string | null;
  }) => Promise<void>;
  onSelectNode: (id: string) => void;
  onCreateSubordinate: (name: string, role: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [linkToId, setLinkToId] = useState<string>("");
  const [subName, setSubName] = useState("");
  const [subRole, setSubRole] = useState("");
  const [subOpen, setSubOpen] = useState(false);
  const [subSaving, setSubSaving] = useState(false);

  useEffect(() => {
    if (!node) return;
    setName(node.name);
    setRole(node.role);
    setCategory(node.category ?? "");
    setEmail(node.email ?? "");
    setPhone(node.phone ?? "");
    setOrder(node.order);
    setPhotoUrl(node.photoUrl ?? "");
    setParentId(node.parentId ?? "");
    setLinkToId(node.linkToId ?? "");
    setSubName("");
    setSubRole("");
    setSubOpen(false);
  }, [node]);

  if (!open || !node) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      name: name.trim(),
      role: role.trim(),
      category: category.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      order: Math.round(Number(order)) || 0,
      photoUrl: photoUrl.trim() || null,
      parentId: parentId.trim() || null,
      linkToId: linkToId.trim() || null,
    });
  }

  async function handleSubCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!subName.trim() || !subRole.trim()) return;
    setSubSaving(true);
    try {
      await onCreateSubordinate(subName.trim(), subRole.trim());
      setSubName("");
      setSubRole("");
      setSubOpen(false);
    } finally {
      setSubSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5">
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" aria-label={labels.drawerClose} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-drawer-title"
        className="relative z-10 flex max-h-[min(100dvh-1rem,920px)] w-full max-w-[min(96vw,1100px)] flex-col overflow-hidden rounded-2xl border border-[var(--pmo-border)] bg-[var(--pmo-surface)] shadow-2xl"
      >
        <header className="relative shrink-0 border-b border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-4 py-3 pr-14 sm:px-6 sm:py-4">
          <p id="org-drawer-title" className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--pmo-text-muted)]">
            {labels.nodeDetailTitle}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--pmo-text)] sm:text-2xl">{node.name}</h2>
          <p className="mt-0.5 text-sm text-[var(--pmo-text-muted)] sm:text-base">{node.role}</p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pmo-surface-2)] sm:right-4 sm:top-4"
          >
            {labels.drawerClose}
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <form id="org-drawer-main-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
              <div className="rounded-lg border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-3 py-2 md:col-span-1">
                <p className="text-[10px] font-bold uppercase text-[var(--pmo-text-muted)]">{labels.levelLabel}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--pmo-text)]">{hierarchyLevel + 1}</p>
                <p className="mt-1 text-[10px] text-[var(--pmo-text-muted)]">{labels.levelHint}</p>
              </div>
              <div className="rounded-md border border-[var(--pmo-border)] px-3 py-2 text-sm md:col-span-1 md:self-start">
                <span className="text-[10px] font-bold uppercase text-[var(--pmo-text-muted)]">{labels.statusLine}: </span>
                <span className="font-semibold text-[var(--pmo-text)]">{node.active ? labels.statusActive : labels.inactive}</span>
              </div>

              <div className="md:col-span-2">
                <OrgPhotoUpload value={photoUrl} onChange={setPhotoUrl} label={labels.placeholderPhotoUrl} hint={labels.photoUrlHint} />
              </div>

              <label className="block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)] md:col-span-1">
                {labels.placeholderName}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)] md:col-span-1">
                {labels.placeholderRole}
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)] md:col-span-1">
                {labels.placeholderCategory}
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-sm"
                  placeholder={labels.categoryHint}
                />
              </label>
              <label className="block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)] md:col-span-1">
                {labels.orderLabel}
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-sm"
                />
              </label>

              <div className="md:col-span-1">
                <p className="text-[10px] font-bold uppercase text-[var(--pmo-text-muted)]">{labels.superiorLabel}</p>
                <p className="mt-1 text-sm font-medium text-[var(--pmo-text)]">{parentNode ? parentNode.name : labels.noSuperior}</p>
              </div>

              <label className="block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)] md:col-span-1">
                {labels.reassignParent}
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-xs"
                >
                  <option value="">{labels.parentRoot}</option>
                  {parentOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)] md:col-span-1">
                {labels.placeholderEmail}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)] md:col-span-1">
                {labels.placeholderPhone}
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-sm"
                />
              </label>

              <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/60 px-3 py-3 dark:border-indigo-900 dark:bg-indigo-950/40 md:col-span-2">
                <p className="text-[10px] font-bold uppercase text-indigo-950 dark:text-indigo-100">{labels.consultantLinkSection}</p>
                <p className="mt-1 text-[10px] leading-snug text-[var(--pmo-text-muted)]">{labels.consultantLinkHint}</p>
                <p className="mt-2 text-[11px] font-semibold text-[var(--pmo-text)]">
                  {labels.consultantLinkCurrent}: {linkTargetNode ? linkTargetNode.name : labels.consultantLinkNone}
                </p>
                <label className="mt-2 block text-[10px] font-bold uppercase text-[var(--pmo-text-muted)]">
                  {labels.consultantLinkSelect}
                  <select
                    value={linkToId}
                    onChange={(e) => setLinkToId(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-2 text-xs"
                  >
                    <option value="">{labels.consultantLinkNone}</option>
                    {linkTargetOptions.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} — {n.role}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="md:col-span-2">
                <p className="text-[10px] font-bold uppercase text-[var(--pmo-text-muted)]">{labels.subordinatesLabel}</p>
                {childNodes.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--pmo-text-muted)]">{labels.noSubordinates}</p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] p-2 sm:max-h-48">
                    {childNodes.map((ch) => (
                      <li key={ch.id}>
                        <button type="button" className="text-left text-sm font-semibold text-sky-800 hover:underline dark:text-sky-200" onClick={() => onSelectNode(ch.id)}>
                          {ch.name}
                        </button>
                        <span className="text-[var(--pmo-text-muted)]"> — {ch.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>

            <div className="mt-5 border-t border-[var(--pmo-border)] pt-4">
              <button type="button" className="text-sm font-bold text-sky-800 hover:underline dark:text-sky-200" onClick={() => setSubOpen((v) => !v)}>
                {subOpen ? labels.subFormHide : labels.addSubordinate}
              </button>
              {subOpen && (
                <form onSubmit={handleSubCreate} className="mt-3 grid max-w-xl gap-2 rounded-lg border border-sky-200/80 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/30 sm:grid-cols-2">
                  <input
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder={labels.placeholderName}
                    className="w-full rounded border border-[var(--pmo-border)] px-2 py-2 text-sm sm:col-span-1"
                  />
                  <input
                    value={subRole}
                    onChange={(e) => setSubRole(e.target.value)}
                    placeholder={labels.placeholderRole}
                    className="w-full rounded border border-[var(--pmo-border)] px-2 py-2 text-sm sm:col-span-1"
                  />
                  <button type="submit" disabled={subSaving} className="pmo-btn-primary w-full py-2 text-sm font-bold disabled:opacity-50 sm:col-span-2">
                    {subSaving ? labels.savingNode : labels.createSubordinate}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-4 py-3 sm:px-6">
            <button type="submit" form="org-drawer-main-form" disabled={saving} className="pmo-btn-primary w-full py-3 text-sm font-bold disabled:opacity-50 sm:text-base">
              {saving ? labels.savingNode : labels.saveNodeDetails}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
