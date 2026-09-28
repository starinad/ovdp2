CREATE TABLE live_prices_cache (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL
);

INSERT INTO live_prices_cache (id, payload, fetched_at)
VALUES (1, '{}'::jsonb, 'epoch')
ON CONFLICT (id) DO NOTHING;
