-- Semantic matching: what a person means, not only what they ticked.
--
-- Additive and nullable. Nothing reads this until a profile has been
-- embedded, and nothing embeds until an API key exists, so this is safe to
-- apply ahead of the deploy and ahead of the credential.

create extension if not exists vector;

-- 256 dimensions, not 1536. text-embedding-3-small is trained to be
-- truncatable, the recall difference at this corpus size is noise, and the
-- stored vector is a sixth of the size — which matters because this column
-- is read for every candidate in a match run.
alter table users add column if not exists embedding vector(256);

-- Exactly the text the vector was built from.
--
-- Re-embedding on every profile save would spend a request to say nothing:
-- most saves change a location or a toggle. Comparing this against the
-- freshly-assembled text is how a save knows whether the meaning changed.
alter table users add column if not exists embedding_of text;

-- Cosine, because the embeddings are normalised and direction is the whole
-- signal. Lists are tiny for now; the index is here so the query shape does
-- not have to change when they aren't.
create index if not exists users_embedding_idx
  on users using hnsw (embedding vector_cosine_ops);
