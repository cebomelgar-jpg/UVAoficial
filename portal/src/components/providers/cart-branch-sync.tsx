"use client";

import { useEffect } from "react";
import { useCart } from "@/components/providers/cart-provider";

/**
 * Mantiene el carrito atado a la sede del perfil. Se renderiza dentro del
 * portal porque el CartProvider vive en el layout raíz.
 */
export function CartBranchSync({ branchId }: { branchId: string | null }) {
  const { setBranch } = useCart();

  useEffect(() => {
    setBranch(branchId);
  }, [branchId, setBranch]);

  return null;
}
