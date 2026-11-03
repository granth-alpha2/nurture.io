-- Migration 002: Create landmarks table with PostGIS geometry and pgvector HNSW index
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS landmarks (
    landmark_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326) NOT NULL,
    h3_index TEXT NOT NULL,
    geohash TEXT NOT NULL,
    embedding vector(512) NOT NULL,
    ocr_tokens TEXT[] NOT NULL DEFAULT '{}',
    visual_tags TEXT[] NOT NULL DEFAULT '{}',
    provenance JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index for radius and corridor bounding-box searches
CREATE INDEX IF NOT EXISTS landmarks_geom_gist_idx ON landmarks USING gist (geom);

-- Discrete spatial cell index for H3 tile-based candidate caching
CREATE INDEX IF NOT EXISTS landmarks_h3_idx ON landmarks (h3_index);

-- Geohash index
CREATE INDEX IF NOT EXISTS landmarks_geohash_idx ON landmarks (geohash);

-- HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor (ANN) cosine similarity
CREATE INDEX IF NOT EXISTS landmarks_embedding_hnsw_idx 
    ON landmarks USING hnsw (embedding vector_cosine_ops) 
    WITH (m = 16, ef_construction = 64);
