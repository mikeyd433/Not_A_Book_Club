-- pg_net was created without an explicit schema in 0022, which defaults to
-- public -- flagged by the advisor ("Extension in Public"). This project's
-- other extensions (pgcrypto, uuid-ossp) already live in the `extensions`
-- schema; move pg_net to match. pg_net doesn't support `alter extension ...
-- set schema` (not relocatable), so this drops and recreates it instead --
-- safe here since nothing depends on it at the catalog level (PL/pgSQL
-- function bodies that call net.http_post(...) don't record a hard
-- dependency on it), and pg_net itself is stateless besides a response log
-- that isn't worth preserving.
drop extension pg_net;
create extension pg_net schema extensions;
