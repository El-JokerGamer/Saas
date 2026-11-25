-- [اسم المنصة] — منصة إدارة المطاعم عبر QR
-- Supabase (PostgreSQL) — نفّذ هذا الملف في SQL Editor في Supabase
-- كل جدول يحمل restaurant_id لعزل بيانات كل مطعم (Multi-Tenant)

-- ===================== المطاعم =====================
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  phone text,
  address text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===================== الطاولات =====================
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_number int not null,
  qr_code text, -- رابط القائمة الخاص بالطاولة، مثل: /menu.html?restaurant=<id>&table=5
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, table_number)
);

-- ===================== تصنيفات القائمة =====================
create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ===================== أصناف القائمة =====================
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===================== الطلبات =====================
-- الحالة: 'new' جديد، 'ready' جاهز، 'served' تم التقديم
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_id uuid references tables(id) on delete set null,
  table_number int not null,
  status text not null default 'new'
    check (status in ('new', 'ready', 'served')),
  total numeric(10,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  price numeric(10,2) not null default 0,
  quantity int not null default 1,
  created_at timestamptz not null default now()
);

-- ===================== العاملون =====================
-- الدور: 'manager' مدير مطعم، 'kitchen' مطبخ، 'waiter' نادل
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  user_id uuid, -- يربط بـ auth.users في Supabase عند تفعيل تسجيل الدخول
  name text not null,
  role text not null check (role in ('manager', 'kitchen', 'waiter')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- فهارس للاستعلامات الشائعة
create index if not exists idx_tables_restaurant on tables(restaurant_id);
create index if not exists idx_menu_items_restaurant on menu_items(restaurant_id);
create index if not exists idx_orders_restaurant_status on orders(restaurant_id, status, created_at);
create index if not exists idx_order_items_order on order_items(order_id);

-- ============================================================
-- ملاحظات Row Level Security (RLS):
-- 1) فعّل RLS على كل جدول: alter table <table> enable row level security;
-- 2) أنشئ سياسة لكل جدول تقيد الصفوف بـ restaurant_id الخاص بالمستخدم،
--    مثل: using (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid)
-- 3) للعميل (بدون تسجيل): أنشئ سياسة قراءة عامة على menu_categories و
--    menu_items للمطاعم المفعّلة فقط، وسياسة إدراج على orders و order_items
--    من دون قراءة طلبات المطاعم الأخرى.
-- 4) للمشرف العام (Super Admin): سياسة منفصلة تسمح بإدارة كل المطاعم
--    بناءً على دور في app_metadata، مثل role = 'super_admin'.
-- ============================================================
