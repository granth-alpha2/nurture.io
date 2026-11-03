CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS demo_routes (
  route_id UUID PRIMARY KEY,
  route_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS navigation_sessions (
  session_id UUID PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES demo_routes(route_id),
  state TEXT NOT NULL CHECK (state IN ('active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS navigation_sessions_state_idx
  ON navigation_sessions (state);

CREATE TABLE IF NOT EXISTS navigation_feedback (
  feedback_id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES navigation_sessions(session_id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
