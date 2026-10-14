DO $$
DECLARE
  role_type text;
  admin_constraint record;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Cannot unify user roles: expected public.users. The applied init migration does not match the current database schema.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS type
    JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'Role'
  ) THEN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
  END IF;

  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMP(3);

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role "Role" NOT NULL DEFAULT 'USER';
  ELSE
    SELECT udt_name INTO role_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role';

    IF role_type <> 'Role' THEN
      ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
      ALTER TABLE public.users
        ALTER COLUMN role TYPE "Role"
        USING CASE
          WHEN UPPER(role::text) IN ('ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN', 'OPERATOR', 'MODERATOR')
            THEN 'ADMIN'::"Role"
          ELSE 'USER'::"Role"
        END;
      ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'USER';
    END IF;
  END IF;

  IF to_regclass('public.system_admins') IS NOT NULL THEN
    IF NOT (
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'admin_id')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'email')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'password_hash')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'username')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'is_active')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'created_at')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'two_factor_secret')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'two_factor_enabled')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_admins' AND column_name = 'last_login')
    ) THEN
      RAISE EXCEPTION 'Cannot migrate system_admins: one or more expected legacy columns are missing.';
    END IF;

    INSERT INTO public.users (
      user_id, email, password_hash, full_name, role, status,
      two_factor_secret, two_factor_enabled, last_login, created_at, updated_at
    )
    SELECT
      legacy.admin_id, LOWER(legacy.email), legacy.password_hash, legacy.username, 'ADMIN'::"Role",
      CASE WHEN legacy.is_active THEN 'ACTIVE' ELSE 'LOCKED' END,
      legacy.two_factor_secret, legacy.two_factor_enabled, legacy.last_login, legacy.created_at, CURRENT_TIMESTAMP
    FROM public.system_admins AS legacy
    WHERE NOT EXISTS (
      SELECT 1 FROM public.users AS account
      WHERE LOWER(account.email) = LOWER(legacy.email)
    );

    UPDATE public.users AS account
    SET
      role = 'ADMIN',
      two_factor_secret = legacy.two_factor_secret,
      two_factor_enabled = legacy.two_factor_enabled,
      last_login = legacy.last_login
    FROM public.system_admins AS legacy
    WHERE LOWER(account.email) = LOWER(legacy.email);

    IF to_regclass('public.audit_logs') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'admin_id'
       ) THEN
      FOR admin_constraint IN
        SELECT constraint_row.conname
        FROM pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.audit_logs'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.confrelid = 'public.system_admins'::regclass
      LOOP
        EXECUTE format('ALTER TABLE public.audit_logs DROP CONSTRAINT %I', admin_constraint.conname);
      END LOOP;

      UPDATE public.audit_logs AS log
      SET admin_id = account.user_id
      FROM public.system_admins AS legacy
      JOIN public.users AS account ON LOWER(account.email) = LOWER(legacy.email)
      WHERE log.admin_id = legacy.admin_id;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.audit_logs'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.conkey = ARRAY[
            (SELECT attribute.attnum
             FROM pg_attribute AS attribute
             WHERE attribute.attrelid = 'public.audit_logs'::regclass AND attribute.attname = 'admin_id')
          ]::smallint[]
          AND constraint_row.confrelid = 'public.users'::regclass
      ) THEN
        ALTER TABLE public.audit_logs
          ADD CONSTRAINT audit_logs_admin_id_fkey
          FOREIGN KEY (admin_id) REFERENCES public.users(user_id)
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END IF;

    DROP TABLE public.system_admins;
  END IF;
END $$;
