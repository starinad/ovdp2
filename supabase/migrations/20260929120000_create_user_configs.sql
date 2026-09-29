CREATE TABLE user_configs (
  user_id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb
);
