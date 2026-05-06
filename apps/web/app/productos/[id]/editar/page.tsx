"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../../lib/useCan";
import { ProductForm } from "../../ProductForm";
import { fetchProduct, updateProduct, type Product } from "../../../../lib/api";

export default function EditarProductoPage() {
  const canEdit = useCan("edit", "product");
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) router.replace("/acceso-restringido");
  }, [canEdit, router]);
  if (!canEdit) return null;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchProduct(id)
      .then(setProduct)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando producto…</span>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error ?? "Producto no encontrado"}
        </div>
        <Link href="/productos" className="btn-secondary mt-3 inline-block">Volver a productos</Link>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <ProductForm
        mode="edit"
        initial={product}
        onSubmit={async (data) => {
          await updateProduct(id, data);
          router.push(`/productos/${id}?success=updated`);
        }}
      />
    </div>
  );
}
