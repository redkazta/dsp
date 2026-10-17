-- =====================================================
-- Dinero Sobre Problemas / WildForgeLabs - Schema Supabase
-- PostgreSQL con RLS para multi-tenancy
-- =====================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLAS
-- =====================================================

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('admin', 'seller', 'warehouse', 'customer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    parent_category_id UUID REFERENCES categories(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    category_id UUID REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) DEFAULT 0,
    sku TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Product Variants (talla, color, material)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT,
    color TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Product Images
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'shipping' CHECK (type IN ('shipping', 'billing')),
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'MX',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    order_number TEXT UNIQUE,
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Order Status History
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago', 'conekta')),
    provider_transaction_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- POLICIES PÚBLICAS (storefront anónimo)
-- -----------------------------------------------------

-- Catálogo público: solo lectura de datos activos
CREATE POLICY "public_read_products" ON products
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND is_deleted = false);

CREATE POLICY "public_read_variants" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (is_deleted = false);

CREATE POLICY "public_read_categories" ON categories
  FOR SELECT TO anon, authenticated
  USING (is_deleted = false);

CREATE POLICY "public_read_images" ON product_images
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_tenants" ON tenants
  FOR SELECT TO anon, authenticated
  USING (is_deleted = false);

-- -----------------------------------------------------
-- POLICIES POR TENANT (usuarios autenticados del ERP)
-- Requiere JWT con claim 'tenant_id'
-- -----------------------------------------------------

CREATE POLICY "tenant_products" ON products
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_categories" ON categories
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_customers" ON customers
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_orders" ON orders
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_payments" ON payments
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_users" ON users
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_variants" ON product_variants
  FOR ALL TO authenticated
  USING (product_id IN (SELECT id FROM products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID))
  WITH CHECK (product_id IN (SELECT id FROM products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID));

CREATE POLICY "tenant_images" ON product_images
  FOR ALL TO authenticated
  USING (product_id IN (SELECT id FROM products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID))
  WITH CHECK (product_id IN (SELECT id FROM products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID));

CREATE POLICY "tenant_order_items" ON order_items
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID));

CREATE POLICY "tenant_order_history" ON order_status_history
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID));

CREATE POLICY "tenant_addresses" ON addresses
  FOR ALL TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID));

-- =====================================================
-- SEED: Tenant inicial de Dinero Sobre Problemas
-- =====================================================
INSERT INTO tenants (id, slug, name, plan)
VALUES ('11111111-1111-1111-1111-111111111111', 'dinerosobreproblemas', 'Dinero Sobre Problemas', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- Categorías de ejemplo
INSERT INTO categories (tenant_id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Playeras'),
  ('11111111-1111-1111-1111-111111111111', 'Hoodies'),
  ('11111111-1111-1111-1111-111111111111', 'Pantalones'),
  ('11111111-1111-1111-1111-111111111111', 'Accesorios')
ON CONFLICT DO NOTHING;

-- Producto de ejemplo
INSERT INTO products (id, tenant_id, name, description, base_price, sku)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Playera General Clothes Example',
  'Playera premium de algodón peinado. Corte oversize.',
  599.00,
  'DSP-PLY-001'
) ON CONFLICT DO NOTHING;

INSERT INTO product_variants (product_id, name, size, color, price, stock) VALUES
  ('22222222-2222-2222-2222-222222222222', 'S / Negro', 'S', 'Negro', 599.00, 10),
  ('22222222-2222-2222-2222-222222222222', 'M / Negro', 'M', 'Negro', 599.00, 15),
  ('22222222-2222-2222-2222-222222222222', 'L / Negro', 'L', 'Negro', 599.00, 8),
  ('22222222-2222-2222-2222-222222222222', 'XL / Negro', 'XL', 'Negro', 599.00, 5)
ON CONFLICT DO NOTHING;
