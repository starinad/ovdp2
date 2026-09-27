-- The previous boolean did not contain a coupon amount, so initialize old
-- rows to zero and let users enter their actual payment amounts.
ALTER TABLE bonds
  ALTER COLUMN fixed_coupon TYPE NUMERIC(18, 6)
  USING 0;

ALTER TABLE bonds
  ADD CONSTRAINT bonds_fixed_coupon_nonnegative CHECK (fixed_coupon >= 0);
