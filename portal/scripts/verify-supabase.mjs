#!/usr/bin/env node
/**
 * Verifica la conexión con Supabase y el estado mínimo del esquema.
 *
 * Uso:
 *   npm run verify:supabase
 *
 * No imprime claves ni datos personales. Usa la service role únicamente para
 * comprobar tablas, Storage y el administrador inicial.
 */

import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://aupaythuamaplaleqojn.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "sb_publishable_g0DvwHHF2VgUa5npuo6ZgA_zxIx8YiL";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  FALLBACK_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

if (!serviceRoleKey) {
  console.error(
    "Falta SUPABASE_SERVICE_ROLE_KEY. Es obligatoria para verificar tablas, Storage y Auth Admin.",
  );
  process.exit(1);
}

let hasErrors = false;

function ok(label, detail = "") {
  console.log(`✓ ${label}${detail ? ` · ${detail}` : ""}`);
}

function fail(label, detail = "") {
  hasErrors = true;
  console.log(`✗ ${label}${detail ? ` · ${detail}` : ""}`);
}

function cleanupMessage(message) {
  return String(message ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const parsedUrl = new URL(url);
  ok("URL de Supabase", parsedUrl.host);
  if (parsedUrl.protocol !== "https:") {
    fail("La URL de Supabase debe usar HTTPS");
  }
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL no es una URL válida");
}

const tables = [
  ["branches", "id"],
  ["profiles", "id"],
  ["products", "id"],
  ["orders", "id"],
  ["order_items", "id"],
  ["patient_documents", "id"],
  ["support_chat_keys", "user_id"],
  ["support_conversations", "id"],
  ["support_chat_messages", "id"],
  ["support_contact_requests", "id"],
];
for (const [table, column] of tables) {
  const { count, error } = await admin
    .from(table)
    .select(column, { count: "exact" })
    .limit(1);

  if (error) {
    fail(`Tabla ${table}`, `${error.code ?? ""} ${cleanupMessage(error.message)}`);
  } else {
    ok(`Tabla ${table}`, `${count ?? 0} filas`);
  }
}

for (const table of ["profiles", "products", "orders"]) {
  const { error } = await admin.from(table).select("branch_id").limit(1);
  if (error) {
    fail(
      `Columna ${table}.branch_id`,
      `${error.code ?? ""} ${cleanupMessage(error.message)}`,
    );
  } else {
    ok(`Columna ${table}.branch_id`, "presente");
  }
}

for (const column of ["email", "status", "approved_at"]) {
  const { error } = await admin.from("profiles").select(column).limit(1);
  if (error) {
    fail(`Columna profiles.${column}`, `${error.code ?? ""} ${cleanupMessage(error.message)}`);
  } else {
    ok(`Columna profiles.${column}`, "presente");
  }
}

const branches = await admin
  .from("branches")
  .select("slug, name, active")
  .order("sort_order", { ascending: true });

if (branches.error) {
  fail("Sedes iniciales", cleanupMessage(branches.error.message));
} else {
  const slugs = new Set((branches.data ?? []).map((branch) => branch.slug));
  const expected = ["parana", "villaguay"];
  const missing = expected.filter((slug) => !slugs.has(slug));
  if (missing.length > 0) {
    fail("Sedes iniciales", `faltan: ${missing.join(", ")}`);
  } else {
    ok("Sedes iniciales", "parana, villaguay");
  }
}

const anonProducts = await anon
  .from("products")
  .select("id", { count: "exact" })
  .limit(1);

if (anonProducts.error) {
  fail(
    "Acceso anónimo a products",
    `${anonProducts.error.code ?? ""} ${cleanupMessage(anonProducts.error.message)}`,
  );
} else {
  ok("Acceso anónimo a products", "la API responde");
}

const functions = [
  [
    "create_order",
    {
      p_items: [],
      p_payment_method: "cash",
      p_fulfillment_method: "pickup",
      p_contact_phone: "000000",
    },
  ],
  ["cancel_order", { p_order_id: "00000000-0000-0000-0000-000000000000" }],
  [
    "admin_update_order_status",
    {
      p_order_id: "00000000-0000-0000-0000-000000000000",
      p_status: "pending",
      p_payment_status: "pending",
    },
  ],
  ["primary_support_admin_id", {}],
  ["open_support_conversation", {}],
  ["reset_support_chat_key", {}],
  [
    "submit_support_contact_request",
    {
      p_request_type: "invalid",
      p_full_name: "",
      p_email: "",
      p_phone: "",
    },
  ],
];

for (const [name, args] of functions) {
  const { error } = await admin.rpc(name, args);
  if (error?.code === "PGRST202") {
    fail(`RPC ${name}`, "no existe");
  } else if (error) {
    // La función existe y respondió con una validación esperada.
    ok(`RPC ${name}`, "existe");
  } else {
    ok(`RPC ${name}`, "existe");
  }
}

const bucket = await admin.storage.getBucket("product-images");
if (bucket.error) {
  fail("Bucket product-images", cleanupMessage(bucket.error.message));
} else {
  ok("Bucket product-images", `público=${bucket.data.public}`);
}

const documentsBucket = await admin.storage.getBucket("patient-documents");
if (documentsBucket.error) {
  fail("Bucket patient-documents", cleanupMessage(documentsBucket.error.message));
} else {
  ok("Bucket patient-documents", `público=${documentsBucket.data.public}`);
  if (documentsBucket.data.public) {
    fail("Bucket patient-documents", "debe ser privado");
  }
  if (documentsBucket.data.file_size_limit !== 10 * 1024 * 1024) {
    fail("Límite de patient-documents", "debe ser 10 MB");
  } else {
    ok("Límite de patient-documents", "10 MB");
  }
  const expectedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  const actualMimeTypes = [...(documentsBucket.data.allowed_mime_types ?? [])].sort();
  if (JSON.stringify(actualMimeTypes) !== JSON.stringify(expectedMimeTypes)) {
    fail("Formatos de patient-documents", "la lista MIME no coincide con los formatos permitidos");
  } else {
    ok("Formatos de patient-documents", "PDF, JPG, PNG y WebP");
  }
}

const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (users.error) {
  fail("Auth Admin", cleanupMessage(users.error.message));
} else {
  ok("Auth Admin", `${users.data.users.length} usuarios`);

  if (adminEmail) {
    const user = users.data.users.find(
      (item) => item.email?.toLowerCase() === adminEmail,
    );

    if (!user) {
      fail("Administrador inicial", "el email de ADMIN_EMAIL no existe en Auth");
    } else {
      const profile = await admin
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (profile.error) {
        fail("Perfil del administrador", cleanupMessage(profile.error.message));
      } else if (!profile.data) {
        fail("Perfil del administrador", "el usuario existe pero no tiene perfil");
      } else if (profile.data.role !== "admin") {
        fail("Perfil del administrador", `rol actual: ${profile.data.role}`);
      } else if (profile.data.status && profile.data.status !== "approved") {
        fail("Perfil del administrador", `estado actual: ${profile.data.status}`);
      } else {
        ok("Administrador inicial", "perfil con rol admin");
      }
    }
  }
}

console.log("");
if (hasErrors) {
  console.log(
    "Resultado: hay puntos pendientes. Revisá las migraciones y el bootstrap del administrador.",
  );
  process.exitCode = 1;
} else {
  console.log("Resultado: conexión y esquema mínimo verificados.");
}
