-- M0 foundation. Public bibliographic metadata is separate from private source text.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE password_credentials (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Auth.js PostgreSQL adapter tables, with uniqueness and foreign keys added.
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT, access_token TEXT, expires_at BIGINT, id_token TEXT,
  scope TEXT, session_state TEXT, token_type TEXT,
  UNIQUE (provider, "providerAccountId")
);
CREATE INDEX accounts_user_idx ON accounts("userId");
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  "sessionToken" TEXT NOT NULL UNIQUE
);
CREATE INDEX sessions_user_idx ON sessions("userId");
CREATE TABLE verification_token (
  identifier TEXT NOT NULL, expires TIMESTAMPTZ NOT NULL, token TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doi TEXT UNIQUE CHECK (doi = lower(trim(doi))),
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(authors) = 'array'),
  year INTEGER CHECK (year BETWEEN 1000 AND 9999),
  venue TEXT, abstract TEXT, study_type TEXT,
  citation_count INTEGER NOT NULL DEFAULT 0 CHECK (citation_count >= 0),
  oa_url TEXT, source TEXT NOT NULL, source_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
CREATE TABLE source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID REFERENCES papers(id),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  access TEXT NOT NULL CHECK (access IN ('public', 'private')),
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  parse_quality TEXT CHECK (parse_quality IN ('text','ocr','low')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((access = 'public' AND user_id IS NULL) OR (access = 'private' AND user_id IS NOT NULL)),
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, paper_id),
  UNIQUE (user_id, sha256)
);
CREATE TABLE paper_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  page INTEGER NOT NULL CHECK (page > 0), section TEXT,
  text TEXT NOT NULL,
  coordinates JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(coordinates) = 'array'),
  embedding vector, embedding_model TEXT,
  CHECK ((embedding IS NULL) = (embedding_model IS NULL)),
  UNIQUE (document_id, ordinal)
);
CREATE TABLE library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES papers(id),
  private_document_id UUID,
  notes TEXT NOT NULL DEFAULT '', tags TEXT[] NOT NULL DEFAULT '{}',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, paper_id), UNIQUE (id, user_id),
  FOREIGN KEY (private_document_id, user_id, paper_id) REFERENCES source_documents(id, user_id, paper_id)
);
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE TABLE collection_items (
  collection_id UUID NOT NULL, library_item_id UUID NOT NULL, user_id INTEGER NOT NULL,
  PRIMARY KEY (collection_id, library_item_id),
  FOREIGN KEY (collection_id, user_id) REFERENCES collections(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (library_item_id, user_id) REFERENCES library_items(id, user_id) ON DELETE CASCADE
);
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL, filters JSONB NOT NULL DEFAULT '{}', answer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (id, user_id)
);
CREATE TABLE search_results (
  search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES papers(id), rank INTEGER NOT NULL CHECK (rank > 0),
  key_finding TEXT, classification TEXT CHECK (classification IN ('yes','possibly','no','mixed')),
  PRIMARY KEY (search_id, paper_id), UNIQUE (search_id, rank)
);
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('paper','collection','library')),
  library_item_id UUID, collection_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (id, user_id),
  CHECK ((scope_type='paper' AND library_item_id IS NOT NULL AND collection_id IS NULL)
    OR (scope_type='collection' AND collection_id IS NOT NULL AND library_item_id IS NULL)
    OR (scope_type='library' AND library_item_id IS NULL AND collection_id IS NULL)),
  FOREIGN KEY (library_item_id, user_id) REFERENCES library_items(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id, user_id) REFERENCES collections(id, user_id) ON DELETE CASCADE
);
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(citations)='array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_chat_idx ON chat_messages(chat_id, created_at);
CREATE TABLE extraction_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id UUID, name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (id, user_id),
  FOREIGN KEY (collection_id, user_id) REFERENCES collections(id, user_id)
);
CREATE TABLE extraction_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES extraction_tables(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('text','number','boolean','categorical')),
  UNIQUE (id, table_id)
);
CREATE TABLE extraction_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL, column_id UUID NOT NULL, library_item_id UUID NOT NULL, user_id INTEGER NOT NULL,
  value JSONB, quote TEXT, page INTEGER CHECK (page > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  verified BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (column_id, library_item_id),
  FOREIGN KEY (table_id, user_id) REFERENCES extraction_tables(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (column_id, table_id) REFERENCES extraction_columns(id, table_id) ON DELETE CASCADE,
  FOREIGN KEY (library_item_id, user_id) REFERENCES library_items(id, user_id) ON DELETE CASCADE,
  CHECK (NOT verified OR status='done')
);
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, tokens INTEGER NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  cost NUMERIC(14,8) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX usage_user_type_time_idx ON usage_events(user_id, type, created_at);
