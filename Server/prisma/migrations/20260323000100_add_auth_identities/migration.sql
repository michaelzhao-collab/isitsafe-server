-- Add auth_identities for multi-provider login (phone/email/apple/google)

CREATE TABLE IF NOT EXISTS "auth_identities" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" VARCHAR(20) NOT NULL,
  "provider_sub" VARCHAR(191) NOT NULL,
  "provider_email" VARCHAR(191),
  "provider_phone" VARCHAR(32),
  "is_verified" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_provider_provider_sub_key"
  ON "auth_identities"("provider", "provider_sub");

CREATE INDEX IF NOT EXISTS "auth_identities_user_id_idx"
  ON "auth_identities"("user_id");

CREATE INDEX IF NOT EXISTS "auth_identities_provider_email_idx"
  ON "auth_identities"("provider_email");

CREATE INDEX IF NOT EXISTS "auth_identities_provider_phone_idx"
  ON "auth_identities"("provider_phone");
