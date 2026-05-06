"use client";

import { useEffect, useState } from "react";
import { fetchCategories, fetchProducts, type Product } from "../../../../lib/api";

const PANEL_CATEGORY_SLUG = "paneles-fotovoltaicos";

export type SelectedPanelSnapshot = {
  productId: string;
  name: string;
  powerW: number;
  lengthMm: number;
  widthMm: number;
} | null;

type PanelCatalogSelectProps = {
  value: SelectedPanelSnapshot | null;
  onChange: (snapshot: SelectedPanelSnapshot) => void;
  disabled?: boolean;
  className?: string;
};

function hasValidDimensions(p: Product): boolean {
  const len = p.panelSpecs?.lengthMm ?? 0;
  const wid = p.panelSpecs?.widthMm ?? 0;
  return typeof len === "number" && typeof wid === "number" && len > 0 && wid > 0;
}

export function PanelCatalogSelect({ value, onChange, disabled, className = "" }: PanelCatalogSelectProps) {
  const [panels, setPanels] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCategories()
      .then((categories) => {
        const cat = categories.find((c) => c.slug === PANEL_CATEGORY_SLUG);
        if (!cat) return [];
        return fetchProducts({ categoryId: cat.id });
      })
      .then((products) => {
        if (!cancelled) {
          setPanels(products.filter(hasValidDimensions));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar paneles");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) {
      onChange(null);
      return;
    }
    const p = panels.find((x) => x.id === id);
    if (!p || !p.panelSpecs) {
      onChange(null);
      return;
    }
    const len = p.panelSpecs.lengthMm ?? 0;
    const wid = p.panelSpecs.widthMm ?? 0;
    const powerW = p.panelSpecs.powerW ?? 0;
    onChange({
      productId: p.id,
      name: p.name,
      powerW,
      lengthMm: len,
      widthMm: wid,
    });
  };

  const selectValue = value?.productId ?? "";

  if (loading) {
    return (
      <div className={`text-sm text-slate-500 ${className}`}>
        Cargando paneles…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm text-amber-600 ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor="panel-select" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        Panel
      </label>
      <select
        id="panel-select"
        value={selectValue}
        onChange={handleSelect}
        disabled={disabled}
        className="input-field w-full text-sm"
      >
        <option value="">— Seleccionar panel —</option>
        {panels.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {(p.panelSpecs?.powerW ?? 0) > 0 && ` (${p.panelSpecs!.powerW} W)`}
          </option>
        ))}
      </select>
    </div>
  );
}
