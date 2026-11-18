CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  post TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  is_author INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post_status ON comments (post, status);
CREATE INDEX IF NOT EXISTS idx_comments_ip_created ON comments (ip_hash, created_at);
