
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pgroonga" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

CREATE TYPE "public"."membership_type" AS ENUM (
    'viewer',
    'admin'
);

ALTER TYPE "public"."membership_type" OWNER TO "postgres";

CREATE TYPE "public"."processed_type" AS ENUM (
    'processed',
    'ignored'
);

ALTER TYPE "public"."processed_type" OWNER TO "postgres";

CREATE TYPE "public"."query_stat_processed_state" AS ENUM (
    'processed',
    'unprocessed',
    'errored',
    'skipped'
);

ALTER TYPE "public"."query_stat_processed_state" OWNER TO "postgres";

CREATE TYPE "public"."source_type" AS ENUM (
    'github',
    'motif',
    'website',
    'salesforce',
    'file-upload',
    'api-upload'
);

ALTER TYPE "public"."source_type" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."conversations_encrypt_secret_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
		BEGIN
		        new.metadata = CASE WHEN new.metadata IS NULL THEN NULL ELSE
			CASE WHEN '1492541a-a585-409f-ab51-f745e4858d46' IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.metadata, 'utf8'),
				pg_catalog.convert_to(('')::text, 'utf8'),
				'1492541a-a585-409f-ab51-f745e4858d46'::uuid,
				NULL
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;

ALTER FUNCTION "public"."conversations_encrypt_secret_metadata"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_fts_index"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  create index idx_file_sections_fts
    on file_sections
    using pgroonga ((array[
        content,
        (cf_file_meta->>'title')::text,
        (meta->'leadHeading'->>'value')::text
      ]));
end;
$$;

ALTER FUNCTION "public"."create_fts_index"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_idx_file_sections_fts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  create index idx_file_sections_fts
  on file_sections
  using pgroonga ((array[
    content,
    (cf_file_meta->>'title')::text,
    (meta->'leadHeading'->>'value')::text
  ]),
  (cf_project_id::varchar));
end;
$$;

ALTER FUNCTION "public"."create_idx_file_sections_fts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fts"("search_term" "text", "match_count" integer, "project_id" "text") RETURNS TABLE("id" bigint, "content" "text", "meta" "jsonb", "file_id" bigint, "file_meta" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    fs.id,
    fs.content,
    fs.meta,
    fs.file_id as file_id,
    fs.cf_file_meta as file_meta
  from file_sections fs
  where
    (
      array[
        fs.content,
        (fs.cf_file_meta->>'title')::text,
        (fs.meta->'leadHeading'->>'value')::text
      ] &@ (fts.search_term, array[1, 1000, 50], 'idx_file_sections_fts')::pgroonga_full_text_search_condition
    )
    and fs.cf_project_id::varchar = fts.project_id
  limit fts.match_count;
end;
$$;

ALTER FUNCTION "public"."fts"("search_term" "text", "match_count" integer, "project_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fts_file_section_content"("search_term" "text", "match_count" integer, "project_id" "uuid") RETURNS TABLE("id" bigint, "content" "text", "meta" "jsonb", "file_id" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    fs.id,
    fs.content,
    fs.meta,
    fs.file_id as file_id
  from file_sections fs
  where
    fs.cf_project_id = fts_file_section_content.project_id
    and fs.content ilike '%' || fts_file_section_content.search_term || '%'
  limit fts_file_section_content.match_count;
end;
$$;

ALTER FUNCTION "public"."fts_file_section_content"("search_term" "text", "match_count" integer, "project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fts_file_title"("search_term" "text", "match_count" integer, "project_id" "uuid") RETURNS TABLE("id" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select f.id
  from files f
  where
    f.project_id = fts_file_title.project_id
    and f.meta->>'title' &@ fts_file_title.search_term
  limit fts_file_title.match_count;
end;
$$;

ALTER FUNCTION "public"."fts_file_title"("search_term" "text", "match_count" integer, "project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_insights_query_histogram"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") RETURNS TABLE("date" timestamp without time zone, "occurrences" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select date_trunc(get_insights_query_histogram.trunc_interval, created_at at time zone get_insights_query_histogram.tz) as date, count(*) as occurrences
  from query_stats
  where query_stats.project_id = get_insights_query_histogram.project_id
  and query_stats.created_at >= get_insights_query_histogram.from_tz
  and query_stats.created_at <= get_insights_query_histogram.to_tz
  group by date_trunc(get_insights_query_histogram.trunc_interval, created_at at time zone get_insights_query_histogram.tz);
end;
$$;

ALTER FUNCTION "public"."get_insights_query_histogram"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_most_cited_references_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "max_results" integer) RETURNS TABLE("full_path" "text", "path" "text", "slug" "text", "title" "text", "heading" "text", "occurrences" bigint)
    LANGUAGE "plpgsql"
    AS $_$
begin
  return query
  with subquery as (
    select
      jsonb_array_elements(meta->'references') as expanded_json
    from
      query_stats qs
    where
      qs.project_id = get_most_cited_references_stats.project_id
      and qs.created_at >= from_tz
      and qs.created_at <= to_tz
  )
  select
    (jsonb_path_query(expanded_json, '$.file.path') #>> '{}') || '#' ||
      (jsonb_path_query(expanded_json, '$.meta.leadHeading.slug') #>> '{}') as full_path,
    jsonb_path_query(expanded_json::jsonb, '$.file.path') #>> '{}' as path,
    jsonb_path_query(expanded_json, '$.meta.leadHeading.slug') #>> '{}' as slug,
    jsonb_path_query(expanded_json, '$.file.title') #>> '{}' as title,
    jsonb_path_query(expanded_json, '$.meta.leadHeading.value') #>> '{}' as heading,
    count(*) as occurrences
  from
    subquery
  group by full_path, expanded_json
  order by occurrences desc
  limit get_most_cited_references_stats.max_results;
end;
$_$;

ALTER FUNCTION "public"."get_most_cited_references_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "max_results" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_project_file_stats"("project_id" "uuid") RETURNS TABLE("num_files" bigint, "num_sections" bigint, "num_tokens" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    count(distinct f.id) as num_files,
    count(fs.id) as num_sections,
    sum(fs.token_count) as num_tokens
  from file_sections fs
  join files f on f.id = fs.file_id
  join sources s on s.id = f.source_id
  where s.project_id = get_project_file_stats.project_id;
end;
$$;

ALTER FUNCTION "public"."get_project_file_stats"("project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_project_query_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) RETURNS TABLE("num_queries" bigint, "num_unanswered" bigint, "num_upvotes" bigint, "num_downvotes" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    count(distinct qs.id) as num_queries,
    count(case when
        qs.no_response = true
        and qs.prompt is not null
        and qs.prompt <> ''
        and qs.prompt <> '[REDACTED]'
        then qs.id
      end
    ) as num_unanswered,
    count(distinct case when qs.feedback ->> 'vote' = '1' then qs.id end) as num_upvotes,
    count(distinct case when qs.feedback ->> 'vote' = '-1' then qs.id end) as num_downvotes
  from
    projects p
  left join query_stats qs on p.id = qs.project_id
  where
    p.id = get_project_query_stats.project_id
    and qs.created_at >= from_tz
    and qs.created_at <= to_tz
    and (
      qs.processed_state = 'processed'
      or qs.processed_state = 'skipped'
    )
  group by p.name, p.slug;
end;
$$;

ALTER FUNCTION "public"."get_project_query_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_team_insights_query_histogram"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") RETURNS TABLE("date" timestamp without time zone, "occurrences" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select date_trunc(trunc_interval, created_at at time zone tz) as date, count(*) as occurrences
  from query_stats
  join projects on projects.id = query_stats.project_id
  where projects.team_id = get_team_insights_query_histogram.team_id
  and created_at >= from_tz
  and created_at <= to_tz
  group by date_trunc(trunc_interval, created_at at time zone tz);
end;
$$;

ALTER FUNCTION "public"."get_team_insights_query_histogram"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_team_num_completions"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) RETURNS TABLE("occurrences" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select count(*) as occurrences
  from query_stats
  join projects on projects.id = query_stats.project_id
  where projects.team_id = get_team_num_completions.team_id
  and created_at >= from_tz
  and created_at <= to_tz;
end;
$$;

ALTER FUNCTION "public"."get_team_num_completions"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_team_stats"("team_id" "uuid") RETURNS TABLE("project_id" "uuid", "project_name" "text", "project_slug" "text", "num_files" bigint, "num_file_sections" bigint, "num_tokens" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    projects.id as project_id,
    projects.name as project_name,
    projects.slug as project_slug,
    count(distinct files.id) as num_files,
    count(distinct file_sections.id) as num_file_sections,
    sum(file_sections.token_count) as num_tokens
  from projects
  join sources on projects.id = sources.project_id
  join files on sources.id = files.source_id
  join file_sections on files.id = file_sections.file_id
  where projects.team_id = get_team_stats.team_id
  group by projects.id;
end;
$$;

ALTER FUNCTION "public"."get_team_stats"("team_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.users (id, full_name, email, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_project_accessible_to_user"("user_id" "uuid", "project_id" "uuid") RETURNS TABLE("has_access" boolean)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    case when exists (
      select 1
      from projects p
      inner join teams t on p.team_id = t.id
      inner join memberships m on t.id = m.team_id
      where p.id = is_project_accessible_to_user.project_id
      and m.user_id = is_project_accessible_to_user.user_id
    ) then true else false end as has_access;
end;
$$;

ALTER FUNCTION "public"."is_project_accessible_to_user"("user_id" "uuid", "project_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."match_file_sections"("project_id" "uuid", "embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "min_content_length" integer) RETURNS TABLE("files_path" "text", "files_meta" "jsonb", "file_sections_content" "text", "file_sections_meta" "jsonb", "file_sections_token_count" integer, "file_sections_similarity" double precision, "source_type" "public"."source_type", "source_data" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
#variable_conflict use_variable
begin
  return query
  select
    f.path as files_path,
    f.meta as files_meta,
    fs.content as file_sections_content,
    fs.meta as file_sections_meta,
    fs.token_count as file_sections_token_count,
    (fs.embedding <#> embedding) * -1 as file_sections_similarity,
    s.type as source_type,
    s.data as source_data
  from file_sections fs
  join files f on fs.file_id = f.id
  join sources s on f.source_id = s.id
  where s.project_id = project_id
  -- We only care about sections that have a useful amount of content
  and length(fs.content) >= min_content_length
  -- The dot product is negative because of a Postgres limitation,
  -- so we negate it
  and (fs.embedding <#> embedding) * -1 > match_threshold
  -- OpenAI embeddings are normalized to length 1, so
  -- cosine similarity and dot product will produce the same results.
  -- Using dot product which can be computed slightly faster.
  -- For the different syntaxes, see https://github.com/pgvector/pgvector
  order by fs.embedding <#> embedding
  limit match_count;
end;
$$;

ALTER FUNCTION "public"."match_file_sections"("project_id" "uuid", "embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "min_content_length" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."query_stats_top_references"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "match_count" integer) RETURNS TABLE("path" "text", "source_type" "text", "source_data" "jsonb", "occurrences" bigint)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    reference->>'path' as path,
    reference->'source'->>'type' as source_type,
    reference->'source'->'data' as source_data,
    count(*) as occurrences
  from query_stats,
    jsonb_array_elements(meta->'references') as reference
  where
    query_stats.project_id = query_stats_top_references.project_id
    and query_stats.created_at >= query_stats_top_references.from_tz
    and query_stats.created_at <= query_stats_top_references.to_tz
    and reference->>'path' is not null
    and reference->'source'->>'type' is not null
  group by path, source_data, source_type
  order by occurrences desc
  limit query_stats_top_references.match_count;
end;
$$;

ALTER FUNCTION "public"."query_stats_top_references"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "match_count" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_file_sections_cf_file_meta"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  select meta into new.cf_file_meta from public.files where id = new.file_id;
  return new;
end;
$$;

ALTER FUNCTION "public"."update_file_sections_cf_file_meta"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_file_sections_cf_project_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.cf_project_id := (
    select s.project_id
    from sources s
    join files f on f.source_id = s.id
    where f.id = new.file_id
    limit 1
  );
  return new;
end;
$$;

ALTER FUNCTION "public"."update_file_sections_cf_project_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "project_id" "uuid" NOT NULL,
    "metadata" "text"
);

ALTER TABLE "public"."conversations" OWNER TO "postgres";

SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."conversations"."metadata" IS 'ENCRYPT WITH KEY ID 1492541a-a585-409f-ab51-f745e4858d46 SECURITY INVOKER';

CREATE OR REPLACE VIEW "public"."decrypted_conversations" AS
 SELECT "conversations"."id",
    "conversations"."created_at",
    "conversations"."project_id",
    "conversations"."metadata",
        CASE
            WHEN ("conversations"."metadata" IS NULL) THEN NULL::"text"
            ELSE
            CASE
                WHEN ('1492541a-a585-409f-ab51-f745e4858d46' IS NULL) THEN NULL::"text"
                ELSE "convert_from"("pgsodium"."crypto_aead_det_decrypt"("decode"("conversations"."metadata", 'base64'::"text"), "convert_to"(''::"text", 'utf8'::"name"), '1492541a-a585-409f-ab51-f745e4858d46'::"uuid", NULL::"bytea"), 'utf8'::"name")
            END
        END AS "decrypted_metadata"
   FROM "public"."conversations";

ALTER TABLE "public"."decrypted_conversations" OWNER TO "postgres";

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "github_repo" "text",
    "team_id" "uuid" NOT NULL,
    "is_starter" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" NOT NULL,
    "public_api_key" "text" NOT NULL,
    "private_dev_api_key" "text" NOT NULL,
    "openai_key" "text",
    "markprompt_config" "jsonb"
);

ALTER TABLE "public"."projects" OWNER TO "postgres";

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_private_dev_api_key_key" UNIQUE ("private_dev_api_key");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_public_api_key_key" UNIQUE ("public_api_key");


create table
  public.query_stats (
    id uuid not null default "extensions"."uuid_generate_v4"(),
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    project_id uuid not null,
    no_response boolean null,
    upvoted boolean null,
    downvoted boolean null,
    processed boolean not null default false,
    embedding public.vector null,
    reference_paths text[] null,
    meta jsonb null,
    feedback jsonb null,
    processed_state "public"."query_stat_processed_state" null default 'skipped'::"public"."query_stat_processed_state",
    prompt text null,
    response text null,
    prompt_clear text null,
    response_clear text null,
    conversation_id uuid null,
    constraint query_stats_pkey primary key (id),
    constraint query_stats_conversation_id_fkey foreign key (conversation_id) references "public"."conversations" (id) on delete cascade,
    constraint query_stats_project_id_fkey foreign key (project_id) references "public"."projects" (id) on delete cascade
  ) tablespace pg_default;

create index if not exists idx_query_stats_project_id_created_at_processed on public.query_stats using btree (project_id, created_at, processed) tablespace pg_default;

CREATE OR REPLACE FUNCTION "public"."query_stats_encrypt_secret_prompt"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
		BEGIN
		        new.prompt = CASE WHEN new.prompt IS NULL THEN NULL ELSE
			CASE WHEN '348d822d-5ac6-4c02-b301-b436a5d17831' IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.prompt, 'utf8'),
				pg_catalog.convert_to(('')::text, 'utf8'),
				'348d822d-5ac6-4c02-b301-b436a5d17831'::uuid,
				NULL
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;

ALTER FUNCTION "public"."query_stats_encrypt_secret_prompt"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."query_stats_encrypt_secret_prompt_encrypted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
		BEGIN
		        new.prompt_encrypted = CASE WHEN new.prompt_encrypted IS NULL THEN NULL ELSE
			CASE WHEN 'af56c6be-870c-40c6-9127-c4867a14e75e' IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.prompt_encrypted, 'utf8'),
				pg_catalog.convert_to(('')::text, 'utf8'),
				'af56c6be-870c-40c6-9127-c4867a14e75e'::uuid,
				NULL
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;

ALTER FUNCTION "public"."query_stats_encrypt_secret_prompt_encrypted"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."query_stats_encrypt_secret_response"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
		BEGIN
		        new.response = CASE WHEN new.response IS NULL THEN NULL ELSE
			CASE WHEN '348d822d-5ac6-4c02-b301-b436a5d17831' IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.response, 'utf8'),
				pg_catalog.convert_to(('')::text, 'utf8'),
				'348d822d-5ac6-4c02-b301-b436a5d17831'::uuid,
				NULL
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;

ALTER FUNCTION "public"."query_stats_encrypt_secret_response"() OWNER TO "postgres";



create trigger query_stats_encrypt_secret_trigger_prompt before insert
or
update of prompt on "public"."query_stats" for each row
execute function "public"."query_stats_encrypt_secret_prompt" ();

create trigger query_stats_encrypt_secret_trigger_response before insert
or
update of response on "public"."query_stats" for each row
execute function "public"."query_stats_encrypt_secret_response" ();

ALTER TABLE "public"."query_stats" OWNER TO "postgres";

SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."query_stats"."prompt" IS 'ENCRYPT WITH KEY ID 348d822d-5ac6-4c02-b301-b436a5d17831 SECURITY INVOKER';
SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."query_stats"."response" IS 'ENCRYPT WITH KEY ID 348d822d-5ac6-4c02-b301-b436a5d17831 SECURITY INVOKER';

CREATE OR REPLACE VIEW "public"."decrypted_query_stats" AS
 SELECT "query_stats"."id",
    "query_stats"."created_at",
    "query_stats"."project_id",
    "query_stats"."no_response",
    "query_stats"."upvoted",
    "query_stats"."downvoted",
    "query_stats"."processed",
    "query_stats"."embedding",
    "query_stats"."reference_paths",
    "query_stats"."meta",
    "query_stats"."feedback",
    "query_stats"."processed_state",
    "query_stats"."prompt",
        CASE
            WHEN ("query_stats"."prompt" IS NULL) THEN NULL::"text"
            ELSE
            CASE
                WHEN ('348d822d-5ac6-4c02-b301-b436a5d17831' IS NULL) THEN NULL::"text"
                ELSE "convert_from"("pgsodium"."crypto_aead_det_decrypt"("decode"("query_stats"."prompt", 'base64'::"text"), "convert_to"(''::"text", 'utf8'::"name"), '348d822d-5ac6-4c02-b301-b436a5d17831'::"uuid", NULL::"bytea"), 'utf8'::"name")
            END
        END AS "decrypted_prompt",
    "query_stats"."response",
        CASE
            WHEN ("query_stats"."response" IS NULL) THEN NULL::"text"
            ELSE
            CASE
                WHEN ('348d822d-5ac6-4c02-b301-b436a5d17831' IS NULL) THEN NULL::"text"
                ELSE "convert_from"("pgsodium"."crypto_aead_det_decrypt"("decode"("query_stats"."response", 'base64'::"text"), "convert_to"(''::"text", 'utf8'::"name"), '348d822d-5ac6-4c02-b301-b436a5d17831'::"uuid", NULL::"bytea"), 'utf8'::"name")
            END
        END AS "decrypted_response",
    "query_stats"."prompt_clear",
    "query_stats"."response_clear",
    "query_stats"."conversation_id"
   FROM "public"."query_stats";

ALTER TABLE "public"."decrypted_query_stats" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."domains" (
    "id" bigint NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "name" "text" NOT NULL,
    "project_id" "uuid" NOT NULL
);

ALTER TABLE "public"."domains" OWNER TO "postgres";

ALTER TABLE "public"."domains" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."domains_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."file_sections" (
    "id" bigint NOT NULL,
    "file_id" bigint NOT NULL,
    "content" "text",
    "token_count" integer,
    "embedding" "public"."vector"(1536),
    "meta" "jsonb",
    "cf_file_meta" "jsonb",
    "cf_project_id" "uuid"
);

ALTER TABLE "public"."file_sections" OWNER TO "postgres";

ALTER TABLE "public"."file_sections" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."file_sections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" bigint NOT NULL,
    "path" "text" NOT NULL,
    "meta" "jsonb",
    "project_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "source_id" "uuid",
    "checksum" "text",
    "raw_content" "text",
    "token_count" integer
);

ALTER TABLE "public"."files" OWNER TO "postgres";

ALTER TABLE "public"."files" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."files_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "type" "public"."membership_type" NOT NULL
);

ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "share_key" "text",
    "project_id" "uuid" NOT NULL,
    "config" "jsonb"
);

ALTER TABLE "public"."prompt_configs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."sources" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "project_id" "uuid" NOT NULL,
    "type" "public"."source_type" NOT NULL,
    "data" "jsonb"
);

ALTER TABLE "public"."sources" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text",
    "is_personal" boolean DEFAULT false,
    "stripe_customer_id" "text",
    "stripe_price_id" "text",
    "billing_cycle_start" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "plan_details" "jsonb"
);

ALTER TABLE "public"."teams" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tokens" (
    "id" bigint NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "value" "text" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL
);

ALTER TABLE "public"."tokens" OWNER TO "postgres";

ALTER TABLE "public"."tokens" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."user_access_tokens" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text",
    "access_token" "text",
    "refresh_token" "text",
    "scope" "text",
    "state" "text",
    "expires" bigint,
    "refresh_token_expires" bigint,
    "meta" "jsonb"
);

ALTER TABLE "public"."user_access_tokens" OWNER TO "postgres";

ALTER TABLE "public"."user_access_tokens" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_access_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "full_name" "text",
    "email" "text" NOT NULL,
    "avatar_url" "text",
    "has_completed_onboarding" boolean DEFAULT false NOT NULL,
    "subscribe_to_product_updates" boolean DEFAULT false NOT NULL,
    "outreach_tag" "text",
    "last_email_id" "text" DEFAULT ''::"text" NOT NULL,
    "config" "jsonb"
);

ALTER TABLE "public"."users" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_distinct_unprocessed_query_stats_project_ids" AS
 SELECT "query_stats"."project_id",
    "min"("query_stats"."created_at") AS "min_created_at"
   FROM "public"."query_stats"
  WHERE ("query_stats"."processed" = false)
  GROUP BY "query_stats"."project_id"
  ORDER BY ("min"("query_stats"."created_at"));

ALTER TABLE "public"."v_distinct_unprocessed_query_stats_project_ids" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_file_section_search_infos" AS
 SELECT "f"."id" AS "file_id",
    "f"."path" AS "file_path",
    "f"."meta" AS "file_meta",
    "fs"."content" AS "section_content",
    "fs"."meta" AS "section_meta",
    "s"."type" AS "source_type",
    "s"."data" AS "source_data",
    "p"."id" AS "project_id",
    "p"."public_api_key",
    "p"."private_dev_api_key",
    "tok"."value" AS "token",
    "d"."name" AS "domain",
    "t"."stripe_price_id"
   FROM (((((("public"."file_sections" "fs"
     LEFT JOIN "public"."files" "f" ON (("fs"."file_id" = "f"."id")))
     LEFT JOIN "public"."sources" "s" ON (("f"."source_id" = "s"."id")))
     LEFT JOIN "public"."projects" "p" ON (("s"."project_id" = "p"."id")))
     LEFT JOIN "public"."tokens" "tok" ON (("p"."id" = "tok"."project_id")))
     LEFT JOIN "public"."domains" "d" ON (("p"."id" = "d"."project_id")))
     LEFT JOIN "public"."teams" "t" ON (("t"."id" = "p"."team_id")));

ALTER TABLE "public"."v_file_section_search_infos" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_insights_query_histogram_day" AS
 SELECT "query_stats"."project_id",
    "date_trunc"('day'::"text", "query_stats"."created_at") AS "date",
    "count"(*) AS "count"
   FROM "public"."query_stats"
  GROUP BY ("date_trunc"('day'::"text", "query_stats"."created_at")), "query_stats"."project_id"
  ORDER BY ("date_trunc"('day'::"text", "query_stats"."created_at"));

ALTER TABLE "public"."v_insights_query_histogram_day" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_insights_query_histogram_hour" AS
 SELECT "query_stats"."project_id",
    "date_trunc"('hour'::"text", "query_stats"."created_at") AS "date",
    "count"(*) AS "count"
   FROM "public"."query_stats"
  GROUP BY ("date_trunc"('hour'::"text", "query_stats"."created_at")), "query_stats"."project_id"
  ORDER BY ("date_trunc"('hour'::"text", "query_stats"."created_at"));

ALTER TABLE "public"."v_insights_query_histogram_hour" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_insights_query_histogram_month" AS
 SELECT "query_stats"."project_id",
    "date_trunc"('month'::"text", "query_stats"."created_at") AS "date",
    "count"(*) AS "count"
   FROM "public"."query_stats"
  GROUP BY ("date_trunc"('month'::"text", "query_stats"."created_at")), "query_stats"."project_id"
  ORDER BY ("date_trunc"('month'::"text", "query_stats"."created_at"));

ALTER TABLE "public"."v_insights_query_histogram_month" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_insights_query_histogram_week" AS
 SELECT "query_stats"."project_id",
    "date_trunc"('week'::"text", "query_stats"."created_at") AS "date",
    "count"(*) AS "count"
   FROM "public"."query_stats"
  GROUP BY ("date_trunc"('week'::"text", "query_stats"."created_at")), "query_stats"."project_id"
  ORDER BY ("date_trunc"('week'::"text", "query_stats"."created_at"));

ALTER TABLE "public"."v_insights_query_histogram_week" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_insights_query_histogram_year" AS
 SELECT "query_stats"."project_id",
    "date_trunc"('year'::"text", "query_stats"."created_at") AS "date",
    "count"(*) AS "count"
   FROM "public"."query_stats"
  GROUP BY ("date_trunc"('year'::"text", "query_stats"."created_at")), "query_stats"."project_id"
  ORDER BY ("date_trunc"('year'::"text", "query_stats"."created_at"));

ALTER TABLE "public"."v_insights_query_histogram_year" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_team_project_info" AS
 SELECT "projects"."id" AS "project_id",
    "teams"."id" AS "team_id",
    "teams"."stripe_price_id",
    "teams"."plan_details"
   FROM ("public"."projects"
     LEFT JOIN "public"."teams" ON (("projects"."team_id" = "teams"."id")));

ALTER TABLE "public"."v_team_project_info" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_team_project_usage_info" AS
SELECT
    NULL::"uuid" AS "project_id",
    NULL::"uuid" AS "team_id",
    NULL::"text" AS "stripe_price_id",
    NULL::"jsonb" AS "plan_details",
    NULL::bigint AS "team_token_count";

ALTER TABLE "public"."v_team_project_usage_info" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_users_with_pending_weekly_update_email" AS
 SELECT "u"."id",
    "u"."email",
    "u"."config",
    "t"."stripe_price_id",
    "t"."plan_details"
   FROM (("public"."users" "u"
     JOIN "public"."memberships" "m" ON (("u"."id" = "m"."user_id")))
     JOIN "public"."teams" "t" ON (("m"."team_id" = "t"."id")))
  WHERE ((("u"."config" IS NULL) OR (((("u"."config" ->> 'sendWeeklyUpdates'::"text") = 'true'::"text") OR (NOT "jsonb_exists"("u"."config", 'sendWeeklyUpdates'::"text"))) AND ((NOT "jsonb_exists"("u"."config", 'lastWeeklyUpdateEmail'::"text")) OR ((("u"."config" ->> 'lastWeeklyUpdateEmail'::"text"))::timestamp with time zone <= ("now"() - '14 days'::interval))))) AND (("t"."stripe_price_id" IS NOT NULL) OR ("t"."plan_details" IS NOT NULL)));

ALTER TABLE "public"."v_users_with_pending_weekly_update_email" OWNER TO "postgres";



ALTER TABLE ONLY "public"."domains"
    ADD CONSTRAINT "domains_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."domains"
    ADD CONSTRAINT "domains_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."file_sections"
    ADD CONSTRAINT "file_sections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."prompt_configs"
    ADD CONSTRAINT "prompt_configs_pkey" PRIMARY KEY ("id");

-- ALTER TABLE ONLY "public"."query_stats"
--     ADD CONSTRAINT "query_stats_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."tokens"
    ADD CONSTRAINT "tokens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_access_tokens"
    ADD CONSTRAINT "user_access_tokens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_domain_project_id" ON "public"."domains" USING "btree" ("project_id");

CREATE INDEX "idx_file_id" ON "public"."file_sections" USING "btree" ("file_id");

CREATE INDEX "idx_file_sections_cf_project_id" ON "public"."file_sections" USING "btree" ("cf_project_id");

CREATE INDEX "idx_file_sections_fts" ON "public"."file_sections" USING "pgroonga" ((ARRAY["content", ("cf_file_meta" ->> 'title'::"text"), (("meta" -> 'leadHeading'::"text") ->> 'value'::"text")]), (("cf_project_id")::character varying));

CREATE INDEX "idx_files_path" ON "public"."files" USING "btree" ("path");

CREATE INDEX "idx_memberships_user_id" ON "public"."memberships" USING "btree" ("user_id");

CREATE INDEX "idx_pgroonga_file_sections_content" ON "public"."file_sections" USING "pgroonga" ("content");

CREATE INDEX "idx_pgroonga_file_sections_fts" ON "public"."file_sections" USING "pgroonga" ("content");

CREATE INDEX "idx_pgroonga_files_meta" ON "public"."files" USING "pgroonga" ("meta");

CREATE INDEX "idx_pgroonga_files_meta_title" ON "public"."files" USING "pgroonga" ((("meta" ->> 'title'::"text")));

CREATE INDEX "idx_project_id" ON "public"."files" USING "btree" ("project_id");

CREATE INDEX "idx_projects_private_dev_api_key" ON "public"."projects" USING "btree" ("private_dev_api_key");

CREATE INDEX "idx_projects_public_api_key" ON "public"."projects" USING "btree" ("public_api_key");

CREATE INDEX "idx_projects_team_id" ON "public"."projects" USING "btree" ("team_id");

-- CREATE INDEX "idx_query_stats_project_id_created_at_processed" ON "public"."query_stats" USING "btree" ("project_id", "created_at", "processed");

CREATE INDEX "idx_tokens_project_id" ON "public"."tokens" USING "btree" ("project_id");

CREATE OR REPLACE VIEW "public"."v_team_project_usage_info" AS
 SELECT "projects"."id" AS "project_id",
    "teams"."id" AS "team_id",
    "teams"."stripe_price_id",
    "teams"."plan_details",
    "sum"("file_sections"."token_count") AS "team_token_count"
   FROM (((("public"."file_sections"
     LEFT JOIN "public"."files" ON (("file_sections"."file_id" = "files"."id")))
     LEFT JOIN "public"."sources" ON (("files"."source_id" = "sources"."id")))
     LEFT JOIN "public"."projects" ON (("sources"."project_id" = "projects"."id")))
     LEFT JOIN "public"."teams" ON (("projects"."team_id" = "teams"."id")))
  GROUP BY "projects"."id", "teams"."id";

-- CREATE TRIGGER "conversations_encrypt_secret_trigger_metadata" BEFORE INSERT OR UPDATE OF "metadata" ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."conversations_encrypt_secret_metadata"();

-- CREATE TRIGGER "query_stats_encrypt_secret_trigger_prompt" BEFORE INSERT OR UPDATE OF "prompt" ON "public"."query_stats" FOR EACH ROW EXECUTE FUNCTION "public"."query_stats_encrypt_secret_prompt"();

-- CREATE TRIGGER "query_stats_encrypt_secret_trigger_response" BEFORE INSERT OR UPDATE OF "response" ON "public"."query_stats" FOR EACH ROW EXECUTE FUNCTION "public"."query_stats_encrypt_secret_response"();

ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."domains"
    ADD CONSTRAINT "domains_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."file_sections"
    ADD CONSTRAINT "file_sections_cf_project_id_fkey" FOREIGN KEY ("cf_project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."file_sections"
    ADD CONSTRAINT "file_sections_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."prompt_configs"
    ADD CONSTRAINT "prompt_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."tokens"
    ADD CONSTRAINT "tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");

ALTER TABLE ONLY "public"."tokens"
    ADD CONSTRAINT "tokens_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_access_tokens"
    ADD CONSTRAINT "user_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Users can delete conversations associated to projects they have" ON "public"."conversations" FOR DELETE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can delete domains associated to projects they have acces" ON "public"."domains" FOR DELETE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can delete files associated to sources associated to proj" ON "public"."files" FOR DELETE USING (("source_id" IN ( SELECT "sources"."id"
   FROM (("public"."sources"
     LEFT JOIN "public"."projects" ON (("sources"."project_id" = "projects"."id")))
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can delete projects associated to teams they are members " ON "public"."projects" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."team_id" = "projects"."team_id")))));

CREATE POLICY "Users can delete prompt configs associated to projects they hav" ON "public"."prompt_configs" FOR DELETE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can delete query stats associated to projects they have a" ON "public"."query_stats" FOR DELETE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can delete sources associated to projects they have acces" ON "public"."sources" FOR DELETE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can delete teams they are members of." ON "public"."teams" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."team_id" = "teams"."id")))));

CREATE POLICY "Users can delete their own memberships." ON "public"."memberships" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their tokens." ON "public"."user_access_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete tokens associated to projects they have access" ON "public"."tokens" FOR DELETE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can insert conversations associated to projects they have" ON "public"."conversations" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can insert domains associated to projects they have acces" ON "public"."domains" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can insert entries with their user id." ON "public"."user_access_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert files associated to sources associated to proj" ON "public"."files" FOR INSERT WITH CHECK (("source_id" IN ( SELECT "sources"."id"
   FROM (("public"."sources"
     LEFT JOIN "public"."projects" ON (("sources"."project_id" = "projects"."id")))
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can insert memberships they belong to." ON "public"."memberships" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert projects associated to teams they are members " ON "public"."projects" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."team_id" = "projects"."team_id")))));

CREATE POLICY "Users can insert prompt configs associated to projects they hav" ON "public"."prompt_configs" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can insert query stats associated to projects they have a" ON "public"."query_stats" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can insert sources associated to projects they have acces" ON "public"."sources" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can insert teams." ON "public"."teams" FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can insert their own user." ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can insert tokens associated to projects they have access" ON "public"."tokens" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can only see conversations associated to projects they ha" ON "public"."conversations" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can only see domains associated to projects they have acc" ON "public"."domains" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can only see files associated to sources associated to pr" ON "public"."files" FOR SELECT USING (("source_id" IN ( SELECT "sources"."id"
   FROM (("public"."sources"
     LEFT JOIN "public"."projects" ON (("sources"."project_id" = "projects"."id")))
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can only see projects associated to teams they are member" ON "public"."projects" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."team_id" = "projects"."team_id")))));

CREATE POLICY "Users can only see prompt configs associated to projects they h" ON "public"."prompt_configs" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can only see query stats associated to projects they have" ON "public"."query_stats" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can only see sources associated to projects they have acc" ON "public"."sources" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can only see teams they are members of." ON "public"."teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."team_id" = "teams"."id")))));

CREATE POLICY "Users can only see their own memberships." ON "public"."memberships" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can only see their tokens." ON "public"."user_access_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can only see themselves." ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "Users can only see tokens associated to projects they have acce" ON "public"."tokens" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can update conversations associated to projects they have" ON "public"."conversations" FOR UPDATE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can update files associated to sources associated to proj" ON "public"."files" FOR UPDATE USING (("source_id" IN ( SELECT "sources"."id"
   FROM (("public"."sources"
     LEFT JOIN "public"."projects" ON (("sources"."project_id" = "projects"."id")))
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can update own user." ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));

CREATE POLICY "Users can update projects associated to teams they are members " ON "public"."projects" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."team_id" = "projects"."team_id")))));

CREATE POLICY "Users can update prompt configs associated to projects they hav" ON "public"."prompt_configs" FOR UPDATE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can update query stats associated to projects they have a" ON "public"."query_stats" FOR UPDATE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can update sources associated to projects they have acces" ON "public"."sources" FOR UPDATE USING (("project_id" IN ( SELECT "projects"."id"
   FROM ("public"."projects"
     LEFT JOIN "public"."memberships" ON (("projects"."team_id" = "memberships"."team_id")))
  WHERE ("memberships"."user_id" = "auth"."uid"()))));

CREATE POLICY "Users can update teams they are members of." ON "public"."teams" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."team_id" = "teams"."id")))));

CREATE POLICY "Users can update their own memberships." ON "public"."memberships" FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their tokens." ON "public"."user_access_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."domains" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."file_sections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."prompt_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."query_stats" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sources" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_access_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."conversations_encrypt_secret_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."conversations_encrypt_secret_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."conversations_encrypt_secret_metadata"() TO "service_role";

GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_fts_index"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_fts_index"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_fts_index"() TO "service_role";

GRANT ALL ON FUNCTION "public"."create_idx_file_sections_fts"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_idx_file_sections_fts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_idx_file_sections_fts"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fts"("search_term" "text", "match_count" integer, "project_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fts"("search_term" "text", "match_count" integer, "project_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fts"("search_term" "text", "match_count" integer, "project_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."fts_file_section_content"("search_term" "text", "match_count" integer, "project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fts_file_section_content"("search_term" "text", "match_count" integer, "project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fts_file_section_content"("search_term" "text", "match_count" integer, "project_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."fts_file_title"("search_term" "text", "match_count" integer, "project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fts_file_title"("search_term" "text", "match_count" integer, "project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fts_file_title"("search_term" "text", "match_count" integer, "project_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_insights_query_histogram"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_insights_query_histogram"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_insights_query_histogram"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_most_cited_references_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "max_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_most_cited_references_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "max_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_most_cited_references_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "max_results" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_project_file_stats"("project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_file_stats"("project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_file_stats"("project_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_project_query_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_query_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_query_stats"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_team_insights_query_histogram"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_insights_query_histogram"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_insights_query_histogram"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "tz" "text", "trunc_interval" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_team_num_completions"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_num_completions"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_num_completions"("team_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_team_stats"("team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_stats"("team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_stats"("team_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."is_project_accessible_to_user"("user_id" "uuid", "project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_project_accessible_to_user"("user_id" "uuid", "project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_project_accessible_to_user"("user_id" "uuid", "project_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";

GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."match_file_sections"("project_id" "uuid", "embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "min_content_length" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_file_sections"("project_id" "uuid", "embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "min_content_length" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_file_sections"("project_id" "uuid", "embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "min_content_length" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_prompt"() TO "anon";
GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_prompt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_prompt"() TO "service_role";

GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_prompt_encrypted"() TO "anon";
GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_prompt_encrypted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_prompt_encrypted"() TO "service_role";

GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_response"() TO "anon";
GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_response"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."query_stats_encrypt_secret_response"() TO "service_role";

GRANT ALL ON FUNCTION "public"."query_stats_top_references"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."query_stats_top_references"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."query_stats_top_references"("project_id" "uuid", "from_tz" timestamp with time zone, "to_tz" timestamp with time zone, "match_count" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."update_file_sections_cf_file_meta"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_file_sections_cf_file_meta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_file_sections_cf_file_meta"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_file_sections_cf_project_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_file_sections_cf_project_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_file_sections_cf_project_id"() TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";

GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";

GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";

GRANT ALL ON TABLE "public"."decrypted_conversations" TO "anon";
GRANT ALL ON TABLE "public"."decrypted_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."decrypted_conversations" TO "service_role";

GRANT ALL ON TABLE "public"."query_stats" TO "anon";
GRANT ALL ON TABLE "public"."query_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."query_stats" TO "service_role";

GRANT ALL ON TABLE "public"."decrypted_query_stats" TO "anon";
GRANT ALL ON TABLE "public"."decrypted_query_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."decrypted_query_stats" TO "service_role";

GRANT ALL ON TABLE "public"."domains" TO "anon";
GRANT ALL ON TABLE "public"."domains" TO "authenticated";
GRANT ALL ON TABLE "public"."domains" TO "service_role";

GRANT ALL ON SEQUENCE "public"."domains_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."domains_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."domains_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."file_sections" TO "anon";
GRANT ALL ON TABLE "public"."file_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."file_sections" TO "service_role";

GRANT ALL ON SEQUENCE "public"."file_sections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."file_sections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."file_sections_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";

GRANT ALL ON SEQUENCE "public"."files_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."files_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."files_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";

GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";

GRANT ALL ON TABLE "public"."prompt_configs" TO "anon";
GRANT ALL ON TABLE "public"."prompt_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_configs" TO "service_role";

GRANT ALL ON TABLE "public"."sources" TO "anon";
GRANT ALL ON TABLE "public"."sources" TO "authenticated";
GRANT ALL ON TABLE "public"."sources" TO "service_role";

GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";

GRANT ALL ON TABLE "public"."tokens" TO "anon";
GRANT ALL ON TABLE "public"."tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."tokens" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tokens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tokens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tokens_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."user_access_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_access_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_access_tokens" TO "service_role";

GRANT ALL ON SEQUENCE "public"."user_access_tokens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_access_tokens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_access_tokens_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";

GRANT ALL ON TABLE "public"."v_distinct_unprocessed_query_stats_project_ids" TO "anon";
GRANT ALL ON TABLE "public"."v_distinct_unprocessed_query_stats_project_ids" TO "authenticated";
GRANT ALL ON TABLE "public"."v_distinct_unprocessed_query_stats_project_ids" TO "service_role";

GRANT ALL ON TABLE "public"."v_file_section_search_infos" TO "anon";
GRANT ALL ON TABLE "public"."v_file_section_search_infos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_file_section_search_infos" TO "service_role";

GRANT ALL ON TABLE "public"."v_insights_query_histogram_day" TO "anon";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_day" TO "authenticated";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_day" TO "service_role";

GRANT ALL ON TABLE "public"."v_insights_query_histogram_hour" TO "anon";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_hour" TO "authenticated";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_hour" TO "service_role";

GRANT ALL ON TABLE "public"."v_insights_query_histogram_month" TO "anon";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_month" TO "service_role";

GRANT ALL ON TABLE "public"."v_insights_query_histogram_week" TO "anon";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_insights_query_histogram_year" TO "anon";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_year" TO "authenticated";
GRANT ALL ON TABLE "public"."v_insights_query_histogram_year" TO "service_role";

GRANT ALL ON TABLE "public"."v_team_project_info" TO "anon";
GRANT ALL ON TABLE "public"."v_team_project_info" TO "authenticated";
GRANT ALL ON TABLE "public"."v_team_project_info" TO "service_role";

GRANT ALL ON TABLE "public"."v_team_project_usage_info" TO "anon";
GRANT ALL ON TABLE "public"."v_team_project_usage_info" TO "authenticated";
GRANT ALL ON TABLE "public"."v_team_project_usage_info" TO "service_role";

GRANT ALL ON TABLE "public"."v_users_with_pending_weekly_update_email" TO "anon";
GRANT ALL ON TABLE "public"."v_users_with_pending_weekly_update_email" TO "authenticated";
GRANT ALL ON TABLE "public"."v_users_with_pending_weekly_update_email" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;
