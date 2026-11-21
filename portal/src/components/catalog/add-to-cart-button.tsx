"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import type { CatalogProduct } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  product,
  quantity = 1,
  className = "btn-mint btn-sm",
  label = "Agregar",
}: {
  product: CatalogProduct;
  quantity?: number;
  className?: string;
  label?: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const unavailable =
    !product.active ||
    product.made_to_order ||
    !product.available ||
    product.price <= 0;
  const text =
    !product.available
      ? "Consultar disponibilidad"
      : product.price <= 0
        ? "Precio a confirmar"
        : label;

  return (
    <button
      type="button"
      className={cn(className, added && "bg-green text-white")}
      disabled={unavailable}
      onClick={() => {
        if (addItem(product, quantity)) {
          setAdded(true);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setAdded(false), 1600);
        }
      }}
    >
      {added ? (
        <>
          <Check className="size-3.5" />
          Agregado
        </>
      ) : (
        <>
          <ShoppingBag className="size-3.5" />
          {text}
        </>
      )}
    </button>
  );
}
