# Portal de pacientes · Un Viaje Astral

Portal privado para pacientes registrados de **Un Viaje Astral**. Conserva la identidad visual del sitio público (oscuro, mint y neón) y agrega autenticación, catálogo, carrito, pedidos con necesidades terapéuticas y un panel de administración con operación en tiempo real.

El portal opera con **dos sedes independientes: Paraná y Villaguay**. Cada sede tiene su propio catálogo, stock, pacientes y pedidos. El panel de administración permite filtrar todas las vistas por sede.

> Este proyecto es independiente del sitio público que está en la raíz del repositorio. Todavía no está enlazado desde el sitio público: puede publicarse en un subdominio, por ejemplo `portal.unviajeastral.com`. **No modifiques el DNS de `unviajeastral.com`**: el sitio público sigue siendo un despliegue separado.

---

## Stack

- **Next.js 15** (App Router) + **React 19**
- **Tailwind CSS 4** con tema propio en `src/app/globals.css`
- **Supabase**: Auth, Postgres con RLS, Storage y Realtime
- **Zod** para validación
- **lucide-react** para iconografía
- TypeScript, ESLint y fuentes locales self-hosted

## Puesta en marcha

Requisitos: Node.js 20.9 o superior, npm y un proyecto de Supabase.

```bash
cd portal
npm install
```

Copiá el archivo de variables de entorno y completá los valores:

```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# macOS / Linux
cp .env.example .env.local
```

Después de configurar Supabase (ver abajo):

```bash
npm run dev
```

El portal queda disponible en [http://localhost:3000](http://localhost:3000).

### Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con Turbopack |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir archivos |
| `npm run bootstrap:admin` | Crea o promueve el administrador inicial |
| `npm run verify:supabase` | Verifica conexión, tablas, RPCs, Storage y administrador |

## Variables de entorno

Las variables se documentan en `.env.example`. Nunca subas `.env.local` al repositorio.

> Las variables `NEXT_PUBLIC_*` se incorporan al bundle durante el build. En Vercel se recomienda cargarlas en **Production** y **Preview** antes de compilar; si las cambiás, hacé un nuevo deploy. El código incluye un fallback público para `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, por lo que el portal no se bloquea si Vercel no las inyecta. Las claves secretas (`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_*`) son solo para scripts locales y no deben configurarse en el runtime de Vercel.

### Públicas (seguras para el navegador)

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase; protegida por RLS |
| `NEXT_PUBLIC_PORTAL_URL` | URL pública del portal; se usa en metadata y redirects |
| `NEXT_PUBLIC_MAIN_SITE_URL` | URL del sitio público de Un Viaje Astral |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp en formato internacional, sin `+` |
| `NEXT_PUBLIC_BANK_ALIAS` | Alias para transferencias; si está vacío se muestra WhatsApp |
| `NEXT_PUBLIC_BANK_CBU` | CBU/CVU para transferencias |
| `NEXT_PUBLIC_BANK_HOLDER` | Titular de la cuenta |

> **Fallback público:** `src/lib/config.ts` define la URL y la publishable/anon key del proyecto por defecto. Se usan cuando las variables no están inyectadas o la URL no es HTTP(S). La key es pública por diseño y las tablas siguen protegidas por RLS.

### Secretas (solo servidor o scripts locales)

| Variable | Uso |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo para `scripts/bootstrap-admin.mjs` y `scripts/verify-supabase.mjs`; nunca en el navegador |
| `ADMIN_EMAIL` | Email del administrador inicial |
| `ADMIN_PASSWORD` | Contraseña inicial, mínimo 8 caracteres |
| `ADMIN_FULL_NAME` | Nombre visible del administrador |

> `SUPABASE_SERVICE_ROLE_KEY` omite RLS. No debe llevar el prefijo `NEXT_PUBLIC_`, no debe exponerse en el cliente ni en el repositorio. En producción, el portal no necesita esta clave; solo se usa localmente para crear el primer administrador y verificar la base.

### Verificar la conexión

Después de completar `.env.local`:

```bash
npm run verify:supabase
```

El comando comprueba la URL, las seis tablas (incluidas `branches` y `patient_documents`), las columnas `branch_id`, las sedes iniciales, las RPC principales, los buckets `product-images` y `patient-documents`, el acceso con la anon/publishable key y el perfil del administrador. No imprime claves ni datos personales. Si falta alguna migración, lo indica con un `✗`.

## Configurar Supabase

### 1. Crear el proyecto

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Copiá **Project URL** y **anon public key** desde *Project Settings → API* a `.env.local`.
3. Copiá la **service_role key** únicamente para ejecutar el bootstrap del administrador.

### 2. Aplicar las migraciones

Las migraciones están en `supabase/migrations/` y deben ejecutarse **en orden**:

1. `202610250001_initial_schema.sql` — tablas y triggers de `updated_at`.
2. `202610250002_rls.sql` — Row Level Security, `is_admin()` y lectura del catálogo.
3. `202610250003_functions.sql` — perfil automático, `create_order`, cancelación y funciones de administración.
4. `202610250004_storage.sql` — bucket `product-images` y políticas de Storage.
5. `202610250005_realtime.sql` — publicación Realtime para `orders` y `products`.
6. `202610250006_seed_catalog.sql` — catálogo inicial (compatible con y sin `branch_id`).
7. `202610260001_multi_branch.sql` — sedes, columnas `branch_id`, backfill a Paraná, RLS por sede y `create_order` con validación de catálogo.
8. `202610270001_patient_documents.sql` — documentación del paciente, bucket privado `patient-documents` y políticas de Storage.
9. `202610280001_profile_approval.sql` — habilitación de cuentas, email y estado en perfiles, tabla `profile_credentials`, RLS de aprobación y gestión de contraseñas por el administrador.

**Opción A: SQL Editor**

Abrí el SQL Editor de Supabase y ejecutá el contenido completo de cada archivo, uno por uno, en el orden indicado.

Para una aplicación única, también podés abrir `supabase/apply-all.sql`, copiar todo su contenido y ejecutarlo. Incluye las ocho migraciones en orden dentro de una transacción; si una sentencia falla, no se aplica ningún cambio.

Si el portal ya estaba funcionando antes de la versión multi-sede, **no ejecutes `apply-all.sql` completo sobre la base existente**. Ejecutá únicamente `202610260001_multi_branch.sql`, que es incremental e idempotente. El backfill asigna todos los datos históricos a **Paraná**; Villaguay comienza con el catálogo vacío para que el administrador lo cargue de forma independiente.

**Opción B: Supabase CLI**

```bash
npx supabase init   # solo la primera vez, si no existe supabase/config.toml
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

Si ya tenés datos reales, revisá `202610250006_seed_catalog.sql` antes de ejecutarlo. El seed detecta si existe `products.branch_id`: antes de multi-sede usa `slug` y después usa `(branch_id, slug)`. Es idempotente y **no sobreescribe** productos existentes.

### Multi-sede: Paraná y Villaguay

La migración `202610260001_multi_branch.sql` crea la tabla `branches` y agrega `branch_id` a `profiles`, `products` y `orders`.

- **Paraná** (`b0000000-0000-4000-8000-000000000001`, slug `parana`) recibe todos los datos históricos.
- **Villaguay** (`b0000000-0000-4000-8000-000000000002`, slug `villaguay`) comienza vacía.
- `products` tiene unicidad por `(branch_id, slug)`: el mismo slug puede existir en ambas sedes.
- Los pacientes ven únicamente el catálogo de su sede. El perfil del paciente es obligatorio y se elige al registrarse o desde `/portal/perfil`.
- Los pedidos guardan la sede del catálogo con el que fueron creados. Si el paciente cambia de sede, su historial anterior sigue visible.
- El carrito local se identifica con `branchId`; al cambiar de sede se descartan los productos del catálogo anterior.
- En el panel, `?sede=parana` o `?sede=villaguay` filtra dashboard, pedidos, catálogo y analíticas. Sin `sede`, se muestra la operación de todas las sedes.
- Los administradores pueden ver y operar todas las sedes; el filtro por sede es operativo y no restringe el RLS de administración.

Para reasignar un paciente o un producto legacy, editá su `branch_id` desde el panel de catálogo (productos) o desde el SQL Editor / Table Editor de Supabase (pacientes). Los pedidos no se reasignan: conservan la sede original como registro histórico.

### 3. Configurar autenticación

En *Authentication → URL Configuration*:

- **Site URL**: `http://localhost:3000` en desarrollo o `https://uva-oficial.vercel.app` en producción.
- **Redirect URLs**:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `https://uva-oficial.vercel.app/auth/callback`
  - `https://uva-oficial.vercel.app/auth/confirm`

En *Authentication → Providers → Email*:

- Para probar rápido en desarrollo podés desactivar **Confirm email**.
- En producción se recomienda mantener la confirmación de email activada.
- Revisá la plantilla de confirmación si personalizás el enlace. El portal soporta `/auth/callback` (intercambio de código) y `/auth/confirm` (verificación por `token_hash`).

El registro público crea únicamente cuentas con rol `patient`. El rol `admin` solo se asigna con el script de bootstrap o desde el SQL Editor con la service role.

### 4. Crear el administrador inicial

Con `.env.local` completo:

```bash
npm run bootstrap:admin
```

El script:

- busca el email en Supabase Auth;
- si no existe, crea el usuario con email confirmado;
- crea o actualiza el perfil y lo marca como `admin`.

Si el usuario ya existía, **no cambia su contraseña**: solo promueve el perfil. Para cambiar la clave de un usuario existente, usá *Authentication → Users* en Supabase o generá un enlace de recuperación.

Después podés iniciar sesión en `/login` y entrar a `/admin`.

### 5. Cargar precios, stock y visibilidad

El seed deja **todos los productos con precio 0, stock 0 y `active = false`**. Esto es intencional: no se inventan precios ni concentraciones.

1. Entrá a `/admin/catalogo`.
2. Editá cada producto y asigná precio y stock reales.
3. Marcá **Publicado** solo cuando la ficha esté revisada.
4. Verificá que la imagen y las concentraciones coincidan con la información real.

El catálogo de pacientes solo muestra productos con `active = true`. Un producto activo con stock 0 se muestra como agotado y no se puede agregar al carrito. Los productos con precio 0 no pueden publicarse.

## Flujo del paciente

1. **Registro** en `/registro` con nombre, teléfono, email, contraseña, **sede** y aceptación de condiciones.
2. **Login** en `/login`.
3. **Catálogo privado** en `/portal/catalogo`, limitado a la sede del perfil, con búsqueda, filtros por categoría, ficha de producto y carrito persistido en el navegador.
4. **Checkout** en `/portal/checkout`:
   - datos de contacto;
   - retiro en sede o entrega;
   - efectivo o transferencia bancaria;
   - necesidades terapéuticas y notas.
5. **Confirmación**: el pedido se crea con una RPC segura que valida la sede del paciente, recalcula precios, valida stock y descuenta unidades.
6. **Seguimiento** en `/portal/pedidos` y `/portal/pedidos/[id]`, con la sede del catálogo usado.
7. **Documentación** en `/portal/documentacion`: certificado de trámite habilitado y credencial REPROCANN.
8. **Perfil** en `/portal/perfil`, donde se puede cambiar la sede.

Si no hay datos bancarios configurados, la pantalla de pago indica coordinar los datos por WhatsApp. El portal **no cobra online** ni procesa tarjetas.

### Documentación del paciente

En `/portal/documentacion` cada paciente puede subir:

- **Certificado de trámite habilitado** vigente.
- **Credencial REPROCANN** vigente, con número de registro y vencimiento visibles.

Se aceptan PDF, JPG, PNG y WebP de hasta 10 MB. Se guarda un archivo vigente por tipo; al reemplazarlo se elimina el anterior. El bucket `patient-documents` es privado: la visualización usa enlaces firmados temporales y solo el paciente titular o un administrador pueden leer los archivos.

## Panel de administración

- `/admin`: resumen de 30 días, pedidos recientes, stock bajo y accesos rápidos, filtrable por sede.
- `/admin/pedidos`: planilla de despacho con búsqueda, filtros, edición inline de estado y pago, notas internas, exportación CSV, impresión, actualización en tiempo real y columna de sede.
- `/admin/catalogo`: alta y edición de productos con sede obligatoria, stock inline, visibilidad, eliminación con confirmación y subida de imágenes.
- `/admin/analiticas`: rangos de 7 días, 30 días y 12 meses, con ingresos, pedidos, ticket promedio, pacientes, estados, pagos, categorías y ranking de productos; filtrable por sede.

Todas las vistas aceptan `?sede=parana` o `?sede=villaguay`. El enlace **Ver catálogo** abre la vista previa del catálogo del paciente para la sede seleccionada.

Los estados de pedido son: `pending`, `confirmed`, `preparing`, `delivered` y `cancelled`. Los pedidos cancelados no se incluyen en ingresos ni en el ranking de productos. Los ingresos del panel son una métrica operativa, no un reporte contable.

## Modelo de datos

| Tabla | Contenido |
| --- | --- |
| `branches` | Sedes operativas (`Paraná`, `Villaguay`), slug estable y estado activo |
| `profiles` | Datos del paciente, rol (`patient` / `admin`) y sede (`branch_id`) |
| `products` | Fichas del catálogo por sede, precio, stock, categoría, aromas, sabores y visibilidad |
| `orders` | Pedido, sede del catálogo, estado, pago, entrega, notas terapéuticas y notas internas |
| `order_items` | Detalle histórico con nombre y precio unitario al momento de la compra |
| `patient_documents` | Certificado de trámite y credencial REPROCANN por paciente, con archivo privado en Storage |

El detalle del pedido conserva nombre, precio y categoría del producto aunque luego se edite o elimine la ficha. El stock se descuenta dentro de `create_order` y se repone al cancelar un pedido pendiente. La sede de un pedido no cambia después de crearlo.

## Seguridad y privacidad

- **RLS activo** en todas las tablas. Un paciente solo puede leer y modificar sus propios datos y pedidos, y únicamente ve el catálogo activo de su sede. Los administradores pueden operar todas las sedes; el filtro por sede se aplica en la interfaz.
- **Aislamiento por sede**: `create_order` valida que cada producto pertenezca a la sede del paciente; las políticas de `products`, `orders` y `profiles` usan `current_branch_id()` para pacientes y `is_admin()` para administración.
- **Administración protegida** por el middleware, `requireAdmin()` y políticas `is_admin()` en la base.
- **Precios y stock del servidor**: el checkout nunca confía en los totales del cliente. `create_order` valida producto activo, stock, precio y cantidades, y recalcula el total.
- **RPCs `security definer`** con `search_path` fijo y comprobaciones explícitas de usuario y rol.
- **Sesiones SSR** con cookies de Supabase y refresh en middleware. El middleware captura errores de configuración, red, cookies y consultas de rol en Edge Runtime; si Supabase no está disponible, las rutas privadas derivan a `/login?error=unavailable` en lugar de devolver un HTTP 500. Las respuestas que renuevan cookies incluyen `Cache-Control: private, no-store`.
- **Storage**: bucket público de solo lectura para imágenes (`product-images`), con escritura exclusiva de administradores. La documentación usa el bucket privado `patient-documents`: cada paciente accede solo a su carpeta `<uid>/` y los administradores pueden leerla.
- **Cabeceras**: CSP, `X-Frame-Options`, `nosniff`, HSTS en producción y `Referrer-Policy`.
- **No indexable**: metadata `noindex`, `robots.txt` con `Disallow: /` y cabecera `X-Robots-Tag`.
- **Dependencias**: `npm audit` sin vulnerabilidades conocidas con Next `15.5.29`. `package.json` incluye un override de PostCSS `^8.5.31` para corregir la versión transitiva de Next 15; revisarlo al actualizar Next.
- **Datos sensibles**: las notas terapéuticas son información personal. Limitá el acceso de administradores, no exportes datos innecesariamente y rotá claves si se comprometen.

### Checklist antes de producción

- [ ] Aplicar todas las migraciones.
- [ ] Verificar que el bucket `patient-documents` sea privado y que la tabla `patient_documents` tenga RLS activo.
- [ ] Verificar que existan las sedes `parana` y `villaguay` y que los datos históricos hayan quedado en Paraná.
- [ ] Revisar el catálogo y los pacientes de cada sede después del backfill.
- [ ] Configurar Site URL y Redirect URLs con el dominio real.
- [ ] Activar confirmación de email.
- [ ] Ejecutar `npm run bootstrap:admin` con una contraseña fuerte.
- [ ] Borrar `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` y `ADMIN_*` del entorno de producción si no se usan.
- [ ] Configurar datos bancarios reales o dejar el fallback de WhatsApp.
- [ ] Revisar fichas, precios y concentraciones con el equipo responsable.
- [ ] Probar registro, login, checkout, cancelación y panel de administración.
- [ ] Verificar que la CSP no bloquee Supabase en el dominio final.
- [ ] Confirmar que `/robots.txt` y las cabeceras `noindex` responden correctamente.

## Despliegue

### Vercel

1. Importá el proyecto en Vercel.
2. Configurá **Root Directory** como `portal` si desplegás desde este repositorio.
3. Cargá las variables públicas y `NEXT_PUBLIC_PORTAL_URL` con el dominio final en **Production** y **Preview**.
4. Build command: `npm run build`. Output: Next.js por defecto.
5. Agregá el dominio o subdominio y actualizá la configuración de Auth en Supabase.

No hace falta un `vercel.json`: Vercel detecta Next.js automáticamente en el directorio `portal`. El proyecto declara Node.js `>=20.9.0` en `package.json`; se recomienda Node 22 en Vercel.

El portal se despliega en su propio proyecto de Vercel (`uva-oficial`). El sitio público de `unviajeastral.com` es un despliegue separado y no debe modificarse desde este repositorio.

No es necesario desplegar `SUPABASE_SERVICE_ROLE_KEY` ni las variables `ADMIN_*` en Vercel. Son solo para el bootstrap local.

Antes de publicar, verificá el build local:

```bash
npm run typecheck
npm run lint
npm run build
```

### Servidor propio

```bash
npm ci
npm run build
npm run start
```

Usá HTTPS y un proxy inverso. Las cookies de sesión requieren un dominio seguro en producción.

## Estructura

```text
portal/
├── scripts/bootstrap-admin.mjs       # Alta/promoción del administrador
├── src/
│   ├── app/
│   │   ├── (auth)/                   # Login y registro
│   │   ├── admin/                    # Dashboard, pedidos, catálogo y analíticas
│   │   ├── auth/                     # Callback y confirmación de Supabase
│   │   ├── portal/                   # Catálogo, carrito, checkout, pedidos, documentación y perfil
│   │   └── legal/                    # Condiciones y privacidad
│   ├── components/                   # UI, catálogo, carrito y administración
│   ├── lib/
│   │   ├── actions/                  # Server Actions
│   │   ├── supabase/                 # Clientes browser/server/middleware
│   │   ├── data.ts                   # Consultas y analíticas
│   │   └── ...                       # Tipos, validación, fechas y formato
│   └── middleware.ts                 # Protección de rutas y refresh de sesión
└── supabase/migrations/              # Esquema, RLS, RPCs, Storage, Realtime y seed
```

## Limitaciones conocidas

- No hay cobro online ni integración con pasarela de pagos.
- No hay envío automático de emails de cambio de estado; el seguimiento se consulta en el portal.
- No hay recuperación automática de contraseña desde la interfaz. Se puede generar un enlace desde Supabase Auth.
- Las analíticas usan períodos móviles (últimos 7 días, 30 días o 12 meses), no semanas o meses calendario.
- El catálogo semilla incluye fichas inactivas de relleno; no deben publicarse hasta completar datos reales.

## Soporte

- WhatsApp: [wa.me/5493434151054](https://wa.me/5493434151054)
- Email: `unviajeastralclub@gmail.com`
- Dirección: Victoria 235, Paraná, Entre Ríos

---

Proyecto privado de Un Viaje Astral. No redistribuir sin autorización.
