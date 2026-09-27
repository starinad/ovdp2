ALTER TABLE bonds
  ADD COLUMN tax_rate NUMERIC(9, 6) NOT NULL DEFAULT 0
  CHECK (tax_rate BETWEEN 0 AND 100);

CREATE TABLE coupons (
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
  day_count_convention VARCHAR(7) NOT NULL CHECK (day_count_convention IN ('ACT/ACT', 'ACT/365', 'ACT/360', '30/360')),
  status VARCHAR(9) NOT NULL CHECK (status IN ('PAID', 'SCHEDULED')),
  is_first BOOLEAN NOT NULL,
  is_last BOOLEAN NOT NULL,
  accrued_adjustment NUMERIC(18, 2) NOT NULL DEFAULT 0,
  UNIQUE (bond_id, sequence_number)
);

CREATE INDEX coupons_payment_date_idx ON coupons (payment_date);
