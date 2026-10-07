export const bondColumns = `id, isin, name, status, face_value AS "faceValue", quantity,
  purchase_price AS "purchasePrice", currency,
  interest_rate AS "interestRate", tax_rate AS "taxRate",
  purchase_date::text AS "purchaseDate", maturity_date::text AS "maturityDate",
  first_coupon_date::text AS "firstCouponDate", coupon_frequency AS "couponFrequency",
  day_count_convention AS "dayCountConvention", fixed_coupon AS "fixedCoupon"`;
