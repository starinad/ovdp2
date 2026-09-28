ALTER TABLE bonds
  ADD COLUMN owner_id text NOT NULL;

CREATE INDEX bonds_owner_id_idx ON bonds (owner_id);
