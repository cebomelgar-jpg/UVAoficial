import type { PatientDocumentType } from "./documents";

export type ProfileRole = "patient" | "admin" | "applicant";

export type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";

export type Branch = {
  id: string;
  slug: string;
  name: string;
  city: string;
  province: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  sort_order: number;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  branch_id: string | null;
  branch?: Branch | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdhesionApplication = {
  user_id: string;
  clinical_reason: string;
  full_name: string;
  age: number;
  dni: string;
  birth_date: string;
  address: string;
  locality: string;
  email: string;
  health_insurance: string;
  phone: string;
  completed_steps: number[];
  current_step: number;
  created_at: string;
  updated_at: string;
};

export type AdminProfile = Profile;

export type SupportConversation = {
  id: string;
  patient_id: string;
  admin_id: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  patient?: Pick<Profile, "full_name" | "email" | "phone"> | null;
};

export type SupportChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  iv: string;
  created_at: string;
};

export type SupportContactRequest = {
  id: string;
  request_type: "password" | "privacy" | "general";
  full_name: string;
  email: string;
  phone: string;
  status: "pending" | "handled";
  created_at: string;
};

export type ProductCategory = "flores" | "rosin_hash" | "vapes" | "derivados";

export type Product = {
  id: string;
  branch_id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  description: string | null;
  thc: string | null;
  cbd: string | null;
  sativa_percent: number | null;
  indica_percent: number | null;
  aromas: string[];
  flavors: string[];
  effects: string[];
  price: number;
  stock: number;
  made_to_order: boolean;
  presentation: string | null;
  image_url: string | null;
  active: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CatalogProduct = Omit<Product, "stock"> & {
  available: boolean;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "bank_transfer";
export type PaymentStatus = "pending" | "paid" | "cancelled";
export type FulfillmentMethod = "pickup" | "delivery";

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  category: ProductCategory | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type Order = {
  id: string;
  order_number: number;
  user_id: string | null;
  branch_id: string | null;
  branch?: Branch | null;
  patient_name: string;
  patient_email: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  fulfillment_method: FulfillmentMethod;
  contact_phone: string;
  delivery_address: string | null;
  subtotal: number;
  total: number;
  notes: string | null;
  therapeutic_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
};

export type AdminOrder = Order & {
  items: OrderItem[];
  profile: Pick<Profile, "full_name" | "phone" | "branch_id"> | null;
};

export type AnalyticsRange = "semana" | "mes" | "anio";

export type AnalyticsBucket = {
  key: string;
  label: string;
  orders: number;
  revenue: number;
};

export type AnalyticsData = {
  range: AnalyticsRange;
  rangeLabel: string;
  start: string;
  end: string;
  metrics: {
    revenue: number;
    orders: number;
    averageTicket: number;
    patients: number;
    pending: number;
    cancelled: number;
  };
  buckets: AnalyticsBucket[];
  statusBreakdown: Array<{ status: OrderStatus; count: number; total: number }>;
  paymentBreakdown: Array<{ method: PaymentMethod; count: number; total: number }>;
  topProducts: Array<{
    name: string;
    category: ProductCategory | null;
    quantity: number;
    revenue: number;
  }>;
  categoryBreakdown: Array<{
    category: ProductCategory;
    quantity: number;
    revenue: number;
  }>;
};

export type CartItem = {
  productId: string;
  branchId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: ProductCategory;
  quantity: number;
};

export type PatientDocument = {
  id: string;
  user_id: string;
  document_type: PatientDocumentType;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  updated_at: string;
};

export type PatientDocumentWithUrl = PatientDocument & {
  signed_url: string | null;
};

export type AdminPatientDocument = PatientDocumentWithUrl & {
  patient: Pick<Profile, "full_name" | "email">;
};

export type ActionState = {
  error?: string;
  message?: string;
};
