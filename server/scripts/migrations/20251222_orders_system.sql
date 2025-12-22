-- Order System Hybrid Strategy Migration
-- 1. LOINC Reference Table
CREATE TABLE IF NOT EXISTS loinc_codes (
    loinc_code TEXT PRIMARY KEY,
    component TEXT,
    property TEXT,
    timing TEXT,
    system TEXT,
    scale TEXT,
    method TEXT,
    long_common_name TEXT,
    status TEXT,
    version TEXT
);

-- 2. Master Orders Catalog
DO $$ BEGIN
    CREATE TYPE order_catalog_type AS ENUM ('LAB', 'IMAGING', 'PROCEDURE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS orders_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type order_catalog_type NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    specialty_tags TEXT[] DEFAULT '{}',
    synonyms TEXT[] DEFAULT '{}',
    loinc_code TEXT REFERENCES loinc_codes(loinc_code),
    loinc_component TEXT,
    loinc_system TEXT,
    loinc_method TEXT,
    vendor TEXT,
    vendor_code TEXT,
    specimen TEXT,
    default_priority TEXT DEFAULT 'ROUTINE',
    instructions TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Catalog
CREATE INDEX IF NOT EXISTS idx_orders_catalog_type ON orders_catalog(type);
CREATE INDEX IF NOT EXISTS idx_orders_catalog_loinc ON orders_catalog(loinc_code);
CREATE INDEX IF NOT EXISTS idx_orders_catalog_vendor ON orders_catalog(vendor, vendor_code);
-- Create an immutable function for search vector concatenation
CREATE OR REPLACE FUNCTION orders_catalog_search_vector(name text, synonyms text[], category text, instructions text)
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('english', 
        name || ' ' || 
        array_to_string(synonyms, ' ') || ' ' || 
        COALESCE(category, '') || ' ' || 
        COALESCE(instructions, '')
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE INDEX IF NOT EXISTS idx_orders_catalog_search ON orders_catalog USING GIN (
    orders_catalog_search_vector(name, synonyms, category, instructions)
);

-- 3. Usage Tracking
CREATE TABLE IF NOT EXISTS orders_usage (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    catalog_id UUID REFERENCES orders_catalog(id) ON DELETE CASCADE,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    use_count INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, catalog_id)
);

-- 4. Favorites
CREATE TABLE IF NOT EXISTS orders_favorites (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    catalog_id UUID REFERENCES orders_catalog(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, catalog_id)
);

-- 5. Visit Orders (The actual instances)
DO $$ BEGIN
    CREATE TYPE visit_order_status AS ENUM ('PENDING', 'SIGNED', 'SENT', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS visit_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    ordering_provider_id UUID REFERENCES users(id),
    catalog_id UUID REFERENCES orders_catalog(id),
    status visit_order_status DEFAULT 'PENDING',
    priority TEXT DEFAULT 'ROUTINE',
    diagnosis_icd10_ids JSONB DEFAULT '[]',
    order_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    signed_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_visit_orders_visit ON visit_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_orders_patient ON visit_orders(patient_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_catalog_updated_at BEFORE UPDATE ON orders_catalog FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_visit_orders_updated_at BEFORE UPDATE ON visit_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
