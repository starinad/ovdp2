CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isin VARCHAR(12) NOT NULL CHECK (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  name VARCHAR(120) NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('ACTIVE', 'MATURED', 'REDEEMED', 'SOLD')),
  face_value NUMERIC(18, 6) NOT NULL CHECK (face_value > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purchase_price NUMERIC(18, 6) NOT NULL CHECK (purchase_price >= 0),
  currency CHAR(3) NOT NULL CHECK (currency IN ('UAH', 'USD', 'EUR')),
  interest_rate NUMERIC(9, 6) NOT NULL CHECK (interest_rate >= 0),
  tax_rate NUMERIC(9, 6) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
  purchase_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  first_coupon_date DATE NOT NULL,
  coupon_frequency VARCHAR(12) NOT NULL CHECK (coupon_frequency IN ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'AT_MATURITY')),
  day_count_convention VARCHAR(7) NOT NULL CHECK (day_count_convention IN ('ACT/ACT', 'ACT/365', 'ACT/360', '30/360')),
  fixed_coupon NUMERIC(18, 6) NOT NULL CHECK (fixed_coupon >= 0),
  CHECK (maturity_date >= purchase_date)
);

CREATE INDEX IF NOT EXISTS bonds_maturity_date_idx ON bonds (maturity_date);

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bond_id UUID NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  payment_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  accrued_days INTEGER NOT NULL CHECK (accrued_days > 0),
  gross_amount NUMERIC(18, 2) NOT NULL CHECK (gross_amount >= 0),
  tax_amount NUMERIC(18, 2) NOT NULL CHECK (tax_amount >= 0),
  net_amount NUMERIC(18, 2) NOT NULL CHECK (net_amount >= 0),
  day_count_convention VARCHAR(7) NOT NULL,
  status VARCHAR(9) NOT NULL CHECK (status IN ('PAID', 'SCHEDULED')),
  is_first BOOLEAN NOT NULL,
  is_last BOOLEAN NOT NULL,
  accrued_adjustment NUMERIC(18, 2) NOT NULL DEFAULT 0,
  UNIQUE (bond_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS coupons_payment_date_idx ON coupons (payment_date);
