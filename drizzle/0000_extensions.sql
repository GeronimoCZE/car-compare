CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION unaccent_immutable(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, lower($1)) $$;
