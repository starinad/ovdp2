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
  purchase_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  first_coupon_date DATE NOT NULL,
  coupon_frequency VARCHAR(12) NOT NULL CHECK (coupon_frequency IN ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'AT_MATURITY')),
  day_count_convention VARCHAR(7) NOT NULL CHECK (day_count_convention IN ('ACT/ACT', 'ACT/365', 'ACT/360', '30/360')),
  fixed_coupon BOOLEAN NOT NULL,
  CHECK (maturity_date >= purchase_date)
);

CREATE INDEX IF NOT EXISTS bonds_maturity_date_idx ON bonds (maturity_date);
