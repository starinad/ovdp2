ALTER TABLE bonds
  ADD COLUMN usd_uah_rate NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (usd_uah_rate >= 0),
  ADD COLUMN eur_uah_rate NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (eur_uah_rate >= 0);
