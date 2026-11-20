import type { Branch } from "@/lib/types";

/**
 * Las sedes se identifican con UUID estables para que las migraciones, los
 * seeds y las pruebas puedan referenciarlas sin depender del orden de
 * inserción. El catálogo público de cada sede es independiente.
 */
export const PARANA_BRANCH_ID = "b0000000-0000-4000-8000-000000000001";
export const VILLAGUAY_BRANCH_ID = "b0000000-0000-4000-8000-000000000002";

export const DEFAULT_BRANCH_SLUG = "parana";

export const BRANCH_FALLBACKS: Branch[] = [
  {
    id: PARANA_BRANCH_ID,
    slug: "parana",
    name: "Paraná",
    city: "Paraná",
    province: "Entre Ríos",
    address: "Victoria 235, Paraná",
    phone: null,
    active: true,
    sort_order: 10,
  },
  {
    id: VILLAGUAY_BRANCH_ID,
    slug: "villaguay",
    name: "Villaguay",
    city: "Villaguay",
    province: "Entre Ríos",
    address: null,
    phone: null,
    active: true,
    sort_order: 20,
  },
];

export function fallbackBranches() {
  return BRANCH_FALLBACKS.map((branch) => ({ ...branch }));
}

export function sortBranches(branches: Branch[]) {
  return [...branches].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );
}

export function findBranch<T extends Pick<Branch, "slug">>(
  branches: readonly T[],
  slug?: string | null,
) {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  return (
    branches.find((branch) => branch.slug.toLowerCase() === normalized) ?? null
  );
}

export function findBranchById<T extends Pick<Branch, "id">>(
  branches: readonly T[],
  branchId?: string | null,
) {
  if (!branchId) return null;
  return branches.find((branch) => branch.id === branchId) ?? null;
}

export function branchLabel(branch: Pick<Branch, "name" | "city" | "province">) {
  if (branch.city === branch.name) {
    return `${branch.name}, ${branch.province}`;
  }
  return `${branch.name} · ${branch.city}, ${branch.province}`;
}
