CREATE TABLE envelop_purchases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id text NOT NULL,
  spent_uah numeric(14, 2) NOT NULL CHECK (spent_uah > 0),
  received_usd numeric(14, 2) NOT NULL CHECK (received_usd > 0),
  purchased_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX envelop_purchases_owner_id_idx ON envelop_purchases (owner_id, purchased_at DESC);
