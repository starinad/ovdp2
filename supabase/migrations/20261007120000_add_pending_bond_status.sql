ALTER TABLE bonds DROP CONSTRAINT bonds_status_check;
ALTER TABLE bonds ADD CONSTRAINT bonds_status_check
  CHECK (status IN ('ACTIVE', 'PENDING', 'MATURED', 'REDEEMED', 'SOLD'));
