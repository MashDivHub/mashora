-- Product eCommerce fields (Group B)
-- Adds: public categories, accessory/alternative product rels, out-of-stock behavior columns.
-- Idempotent: safe to re-run. Guards with IF NOT EXISTS.

BEGIN;

-- 1. product_public_category (hierarchical storefront category)
CREATE TABLE IF NOT EXISTS product_public_category (
    id              SERIAL PRIMARY KEY,
    name            JSONB NOT NULL,
    parent_id       INTEGER REFERENCES product_public_category(id) ON DELETE SET NULL,
    sequence        INTEGER,
    active          BOOLEAN DEFAULT TRUE,
    create_uid      INTEGER,
    write_uid       INTEGER,
    create_date     TIMESTAMP DEFAULT NOW(),
    write_date      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_product_public_category_parent ON product_public_category(parent_id);

-- 2. M2M: product_template <-> product_public_category
CREATE TABLE IF NOT EXISTS product_template_public_category_rel (
    product_template_id INTEGER NOT NULL REFERENCES product_template(id) ON DELETE CASCADE,
    product_public_category_id INTEGER NOT NULL REFERENCES product_public_category(id) ON DELETE CASCADE,
    PRIMARY KEY (product_template_id, product_public_category_id)
);

-- 3. M2M: product_template <-> product_template (accessory products)
CREATE TABLE IF NOT EXISTS product_accessory_rel (
    src_id  INTEGER NOT NULL REFERENCES product_template(id) ON DELETE CASCADE,
    dest_id INTEGER NOT NULL REFERENCES product_template(id) ON DELETE CASCADE,
    PRIMARY KEY (src_id, dest_id)
);

-- 4. M2M: product_template <-> product_template (alternative products)
CREATE TABLE IF NOT EXISTS product_alternative_rel (
    src_id  INTEGER NOT NULL REFERENCES product_template(id) ON DELETE CASCADE,
    dest_id INTEGER NOT NULL REFERENCES product_template(id) ON DELETE CASCADE,
    PRIMARY KEY (src_id, dest_id)
);

-- 5. Out-of-stock behavior + availability display on product_template
ALTER TABLE product_template
    ADD COLUMN IF NOT EXISTS allow_out_of_stock_order BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS out_of_stock_message TEXT,
    ADD COLUMN IF NOT EXISTS available_threshold DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS show_availability BOOLEAN DEFAULT FALSE;

-- 6. eCommerce media gallery (ordered images beyond the main product image)
CREATE TABLE IF NOT EXISTS product_ecommerce_image (
    id              SERIAL PRIMARY KEY,
    product_tmpl_id INTEGER REFERENCES product_template(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES product_product(id) ON DELETE CASCADE,
    sequence        INTEGER DEFAULT 10,
    name            JSONB,
    image_1920      BYTEA,
    video_url       VARCHAR,
    create_uid      INTEGER,
    write_uid       INTEGER,
    create_date     TIMESTAMP DEFAULT NOW(),
    write_date      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_product_ecommerce_image_tmpl ON product_ecommerce_image(product_tmpl_id);

COMMIT;
