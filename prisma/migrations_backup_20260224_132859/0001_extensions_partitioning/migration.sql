CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations', 'roles', 'modules', 'users', 'user_profiles',
    'system_configurations', 'notification_preferences', 'user_dashboard_layouts'
  ]
  LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trigger_update_%I_updated_at ON %I;',
        t, t
      );
      EXECUTE format(
        'CREATE TRIGGER trigger_update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
        t, t
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF to_regclass('users') IS NOT NULL THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_users_fulltext ON users
      USING gin(to_tsvector(''english'',
        coalesce(first_name,'''') || '' '' ||
        coalesce(last_name,'''') || '' '' ||
        coalesce(email,'''')
      ));
    ';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('audit_logs') IS NOT NULL THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS audit_logs_2026_02
      PARTITION OF audit_logs
      FOR VALUES FROM (''2026-02-01'') TO (''2026-03-01'');
    ';
  END IF;
END;
$$;
