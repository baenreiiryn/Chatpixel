CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY,
  secret_hash text NOT NULL,
  state jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_updated_at_idx
  ON campaigns (updated_at DESC);

CREATE TABLE IF NOT EXISTS app_accounts (
  id uuid PRIMARY KEY,
  openai_issuer text NOT NULL,
  openai_sub text NOT NULL,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (openai_issuer, openai_sub)
);

CREATE TABLE IF NOT EXISTS campaign_accounts (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'player')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, account_id)
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  secret_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx
  ON app_sessions (expires_at);

CREATE TABLE IF NOT EXISTS openai_login_transactions (
  id uuid PRIMARY KEY,
  state_hash text NOT NULL UNIQUE,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS openai_login_transactions_expires_at_idx
  ON openai_login_transactions (expires_at);
