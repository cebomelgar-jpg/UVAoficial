import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAnalyticsRange, getBucketKey, buildAnalyticsBuckets } from "@/lib/dates";
import { fallbackBranches, sortBranches } from "@/lib/branches";
import type {
  AdminOrder,
  AnalyticsData,
  AnalyticsRange,
  AdminPatientDocument,
  AdhesionApplication,
  Branch,
  CatalogProduct,
  Order,
  OrderItem,
  OrderStatus,
  OrderWithItems,
  PatientDocument,
  PatientDocumentWithUrl,
  PaymentMethod,
  Product,
  ProductCategory,
  Profile,
  ProfileStatus,
  AdminProfile,
} from "@/lib/types";

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "delivered",
  "cancelled",
];

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "bank_transfer"];
const CATEGORIES: ProductCategory[] = [
  "flores",
  "rosin_hash",
  "vapes",
  "derivados",
];
function branchFilter(branchId?: string | null) {
  return branchId ? { branch_id: branchId } : {};
}

function logAndThrow(message: string, error: { message?: string } | null) {
  console.error(`[data] ${message}`, error?.message);
  throw new Error(message);
}

/**
 * Las sedes son datos de referencia. Si el esquema multi-sede todavía no está
 * aplicado (o Supabase no responde), el portal sigue mostrando las dos sedes
 * conocidas para que el registro y los formularios no queden bloqueados.
 */
export async function getBranches(includeInactive = false): Promise<Branch[]> {
  const supabase = await createClient();
  let query = supabase
    .from("branches")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) {
    console.error("[data] No pudimos cargar las sedes.", error.message);
    return fallbackBranches();
  }

  if (!data || data.length === 0) return fallbackBranches();
  return sortBranches(data as Branch[]);
}

export async function getActiveProducts(
  category?: ProductCategory,
  branchId?: string | null,
): Promise<CatalogProduct[]> {
  if (!branchId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalog_products", {
    p_branch_id: branchId,
    p_category: category ?? null,
    p_featured_only: false,
  });
  if (error) logAndThrow("No pudimos cargar el catálogo.", error);
  return (data ?? []) as CatalogProduct[];
}

export async function getAllProducts(branchId?: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_products", {
    p_branch_id: branchId ?? null,
  });

  if (error) logAndThrow("No pudimos cargar el catálogo.", error);
  return (data ?? []) as Product[];
}

export async function getProductById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_products", {
    p_branch_id: null,
    p_product_id: id,
  });

  if (error) logAndThrow("No pudimos cargar el producto.", error);
  return ((data ?? [])[0] as Product | undefined) ?? null;
}

export async function getPatientOrders(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), branch:branches(id, slug, name, city, province)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) logAndThrow("No pudimos cargar tus pedidos.", error);
  return (data ?? []) as OrderWithItems[];
}

export async function getPatientOrder(orderId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), branch:branches(id, slug, name, city, province)",
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) logAndThrow("No pudimos cargar el pedido.", error);
  return (data as OrderWithItems | null) ?? null;
}

export async function getPatientDocuments(userId: string): Promise<{
  documents: PatientDocumentWithUrl[];
  ready: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_documents")
    .select("*")
    .eq("user_id", userId)
    .order("document_type", { ascending: true });

  if (error) {
    console.error("[data] No pudimos cargar la documentación.", error.message);
    return { documents: [], ready: false };
  }

  const documents = await Promise.all(
    ((data ?? []) as PatientDocument[]).map(async (document) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from("patient-documents")
        .createSignedUrl(document.file_path, 5 * 60, {
          download: document.file_name,
        });

      if (signedError) {
        console.error(
          "[data] No pudimos generar el enlace del documento.",
          signedError.message,
        );
      }

      return {
        ...document,
        signed_url: signed?.signedUrl ?? null,
      };
    }),
  );

  return { documents, ready: true };
}

export async function getAdminPatientDocuments(): Promise<AdminPatientDocument[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("patient_documents")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) logAndThrow("No pudimos cargar los archivos compartidos.", error);
  const documents = (rows ?? []) as PatientDocument[];
  const patientIds = [...new Set(documents.map((document) => document.user_id))];
  const { data: profiles, error: profileError } = patientIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", patientIds)
    : { data: [], error: null };

  if (profileError) {
    logAndThrow("No pudimos cargar los titulares de los archivos.", profileError);
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );
  return Promise.all(
    documents.map(async (document) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from("patient-documents")
        .createSignedUrl(document.file_path, 5 * 60, {
          download: document.file_name,
        });

      if (signedError) {
        console.error(
          "[data] No pudimos generar el enlace temporal del archivo.",
          signedError.message,
        );
      }

      return {
        ...document,
        signed_url: signed?.signedUrl ?? null,
        patient: profileById.get(document.user_id) ?? {
          full_name: "Paciente",
          email: null,
        },
      };
    }),
  );
}

export async function getAdminOrders(
  limit = 1000,
  branchId?: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, profile:profiles(full_name, phone, branch_id), branch:branches(id, slug, name, city, province), items:order_items(*)",
    )
    .match(branchFilter(branchId))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) logAndThrow("No pudimos cargar los pedidos.", error);
  return (data ?? []) as AdminOrder[];
}

export async function getAdminOrder(orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, profile:profiles(full_name, phone, branch_id), branch:branches(id, slug, name, city, province), items:order_items(*)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) logAndThrow("No pudimos cargar el pedido.", error);
  return (data as AdminOrder | null) ?? null;
}

async function getOrdersInRange(
  range: AnalyticsRange,
  branchId?: string | null,
) {
  const supabase = await createClient();
  const { start, end } = getAnalyticsRange(range);
  const pageSize = 1000;
  const rows: Array<
    Pick<
      Order,
      | "id"
      | "user_id"
      | "patient_name"
      | "status"
      | "payment_method"
      | "total"
      | "created_at"
    > & {
      items: Array<
        Pick<OrderItem, "product_name" | "category" | "quantity" | "line_total">
      > | null;
    }
  > = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, user_id, patient_name, status, payment_method, total, created_at, items:order_items(product_name, category, quantity, line_total)",
      )
      .match(branchFilter(branchId))
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) logAndThrow("No pudimos cargar las analíticas.", error);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < pageSize) break;
  }

  return { rows, start, end };
}

export async function getAdminAnalytics(
  range: AnalyticsRange,
  branchId?: string | null,
): Promise<AnalyticsData> {
  const { rows, start, end } = await getOrdersInRange(range, branchId);
  const rangeInfo = getAnalyticsRange(range);
  const buckets = buildAnalyticsBuckets(range);
  const bucketMap = new Map(
    buckets.map((bucket) => [bucket.key, { ...bucket, orders: 0, revenue: 0 }]),
  );

  const statusMap = new Map(
    ORDER_STATUSES.map((status) => [status, { status, count: 0, total: 0 }]),
  );
  const paymentMap = new Map(
    PAYMENT_METHODS.map((method) => [method, { method, count: 0, total: 0 }]),
  );
  const productMap = new Map<
    string,
    { name: string; category: ProductCategory | null; quantity: number; revenue: number }
  >();
  const categoryMap = new Map(
    CATEGORIES.map((category) => [category, { category, quantity: 0, revenue: 0 }]),
  );
  const patients = new Set<string>();

  let revenue = 0;
  let validOrders = 0;
  let pending = 0;
  let cancelled = 0;

  for (const order of rows) {
    const total = Number(order.total);
    const status = order.status as OrderStatus;
    const statusEntry = statusMap.get(status);
    if (statusEntry) {
      statusEntry.count += 1;
      statusEntry.total += total;
    }

    if (status === "pending") pending += 1;
    if (status === "cancelled") {
      cancelled += 1;
      continue;
    }

    revenue += total;
    validOrders += 1;
    patients.add(order.user_id ?? order.patient_name);

    const paymentEntry = paymentMap.get(order.payment_method as PaymentMethod);
    if (paymentEntry) {
      paymentEntry.count += 1;
      paymentEntry.total += total;
    }

    const bucketKey = getBucketKey(new Date(order.created_at), range);
    const bucket = bucketMap.get(bucketKey);
    if (bucket) {
      bucket.orders += 1;
      bucket.revenue += total;
    }

    for (const item of order.items ?? []) {
      const quantity = Number(item.quantity);
      const itemRevenue = Number(item.line_total);
      const key = `${item.product_name}::${item.category ?? ""}`;
      const current = productMap.get(key) ?? {
        name: item.product_name,
        category: (item.category as ProductCategory | null) ?? null,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += quantity;
      current.revenue += itemRevenue;
      productMap.set(key, current);

      if (item.category && categoryMap.has(item.category as ProductCategory)) {
        const categoryEntry = categoryMap.get(item.category as ProductCategory)!;
        categoryEntry.quantity += quantity;
        categoryEntry.revenue += itemRevenue;
      }
    }
  }

  return {
    range,
    rangeLabel: rangeInfo.label,
    start: start.toISOString(),
    end: end.toISOString(),
    metrics: {
      revenue,
      orders: validOrders,
      averageTicket: validOrders ? revenue / validOrders : 0,
      patients: patients.size,
      pending,
      cancelled,
    },
    buckets: [...bucketMap.values()],
    statusBreakdown: [...statusMap.values()],
    paymentBreakdown: [...paymentMap.values()],
    topProducts: [...productMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
    categoryBreakdown: [...categoryMap.values()],
  };
}

export async function getAdminOverview(branchId?: string | null) {
  const supabase = await createClient();
  const monthStart = getAnalyticsRange("mes").start.toISOString();
  const filter = branchFilter(branchId);

  const [
    recentResult,
    pendingResult,
    monthResult,
    patientsResult,
    lowStockResult,
    activeResult,
    recentProfilesResult,
    pendingProfilesResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, patient_name, status, total, branch_id, created_at, branch:branches(name, slug, city)",
      )
      .match(filter)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .match(filter)
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("total, status")
      .match(filter)
      .gte("created_at", monthStart),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .match(filter)
      .eq("role", "patient"),
    supabase.rpc("admin_low_stock_products", {
      p_branch_id: branchId ?? null,
    }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .match(filter)
      .eq("active", true),
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role, status, branch_id, created_at, branch:branches(name, slug, city)")
      .match(filter)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .match(filter)
      .eq("role", "patient")
      .eq("status", "pending"),
  ]);

  const firstError =
    recentResult.error ||
    pendingResult.error ||
    monthResult.error ||
    patientsResult.error ||
    lowStockResult.error ||
    activeResult.error;

  if (firstError) logAndThrow("No pudimos cargar el resumen.", firstError);

  const profilesReady = !recentProfilesResult.error && !pendingProfilesResult.error;
  if (!profilesReady) {
    console.error(
      "[data] No pudimos cargar los registros de perfiles.",
      recentProfilesResult.error?.message ?? pendingProfilesResult.error?.message,
    );
  }

  const monthOrders = (monthResult.data ?? []) as Array<Pick<Order, "total" | "status">>;
  const monthRevenue = monthOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total), 0);

  return {
    recentOrders: (recentResult.data ?? []) as unknown as Array<
      Pick<
        Order,
        | "id"
        | "order_number"
        | "patient_name"
        | "status"
        | "total"
        | "branch_id"
        | "created_at"
      > & { branch: Pick<Branch, "name" | "slug" | "city"> | null }
    >,
    pendingOrders: pendingResult.count ?? 0,
    monthOrders: monthOrders.filter((order) => order.status !== "cancelled").length,
    monthRevenue,
    patients: patientsResult.count ?? 0,
    lowStock: (lowStockResult.data ?? []) as Array<
      Pick<Product, "id" | "name" | "stock" | "category" | "active" | "branch_id">
    >,
    activeProducts: activeResult.count ?? 0,
    pendingProfiles: profilesReady ? pendingProfilesResult.count ?? 0 : 0,
    recentProfiles: profilesReady
      ? ((recentProfilesResult.data ?? []) as unknown as Array<
          Pick<
            Profile,
            | "id"
            | "full_name"
            | "email"
            | "phone"
            | "role"
            | "status"
            | "branch_id"
            | "created_at"
          > & { branch: Pick<Branch, "name" | "slug" | "city"> | null }
        >)
      : [],
    profilesReady,
  };
}

export async function getPatientOverview(
  userId: string,
  branchId?: string | null,
) {
  const supabase = await createClient();

  const featuredProducts = branchId
    ? supabase.rpc("catalog_products", {
        p_branch_id: branchId,
        p_category: null,
        p_featured_only: true,
      })
    : Promise.resolve({ data: [] as CatalogProduct[], error: null });

  const [ordersResult, featuredResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, total, branch_id, created_at, branch:branches(name, slug, city)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    featuredProducts,
  ]);

  if (ordersResult.error) logAndThrow("No pudimos cargar tu resumen.", ordersResult.error);
  if (featuredResult.error) logAndThrow("No pudimos cargar el catálogo.", featuredResult.error);

  const orders = (ordersResult.data ?? []) as unknown as Array<
    Pick<
      Order,
      "id" | "order_number" | "status" | "total" | "branch_id" | "created_at"
    > & { branch: Pick<Branch, "name" | "slug" | "city"> | null }
  >;

  return {
    orders,
    totalOrders: orders.length,
    pending: orders.filter((order) => order.status === "pending").length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    totalSpent: orders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + Number(order.total), 0),
    featured: (featuredResult.data ?? []) as CatalogProduct[],
  };
}

export async function getAdminProfiles(): Promise<{
  profiles: AdminProfile[];
  ready: boolean;
}> {
  const supabase = await createClient();
  const pageSize = 500;
  const data = [];
  for (let from = 0; ; from += pageSize) {
    const { data: page, error } = await supabase
      .from("profiles")
      .select("*, branch:branches(id, slug, name, city, province)")
      .neq("role", "applicant")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("[data] No pudimos cargar los perfiles.", error.message);
      return { profiles: [], ready: false };
    }

    data.push(...(page ?? []));
    if (!page || page.length < pageSize) break;
  }

  const profiles = (data as Array<
    Profile & { branch: Branch | null }
  >).map((profile) => {
    return {
      ...profile,
      status: ((profile as { status?: ProfileStatus }).status ??
        "pending") as ProfileStatus,
      email: (profile as { email?: string | null }).email ?? null,
      approved_at: (profile as { approved_at?: string | null }).approved_at ?? null,
      approved_by: (profile as { approved_by?: string | null }).approved_by ?? null,
    } as AdminProfile;
  });

  return { profiles, ready: true };
}

export async function getAdminAdhesionApplications(): Promise<
  Array<{
    application: AdhesionApplication;
    profile: Pick<Profile, "id" | "email" | "full_name" | "phone" | "status" | "created_at">;
  }>
> {
  const supabase = await createClient();
  const { data: applications, error: applicationError } = await supabase
    .from("adhesion_applications")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (applicationError) {
    console.error("[data] No pudimos cargar las solicitudes de adhesión.", applicationError.code);
    throw new Error("No pudimos cargar las solicitudes de adhesión.");
  }
  if (!applications?.length) return [];

  const applicantIds = applications.map((application) => application.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, status, created_at")
    .in("id", applicantIds)
    .eq("role", "applicant");

  if (profilesError) {
    console.error("[data] No pudimos cargar los perfiles solicitantes.", profilesError.code);
    throw new Error("No pudimos cargar los perfiles solicitantes.");
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );
  return (applications as AdhesionApplication[])
    .flatMap((application) => {
      const profile = profileById.get(application.user_id);
      return profile ? [{ application, profile }] : [];
    });
}
