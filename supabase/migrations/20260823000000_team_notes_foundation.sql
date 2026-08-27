-- Team Notes V1: additive domain schema only.
-- Preserves auth.users, legacy personal-sync tables, Storage, and plugin data.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
SET search_path TO public, extensions;

CREATE TYPE "team_role" AS ENUM (
  'owner',
  'admin',
  'member'
);

CREATE TYPE "membership_status" AS ENUM (
  'key_pending',
  'active',
  'suspended',
  'removed'
);

CREATE TYPE "space_kind" AS ENUM (
  'team',
  'restricted'
);

CREATE TYPE "space_role" AS ENUM (
  'reader',
  'editor',
  'manager'
);

CREATE TYPE "device_status" AS ENUM (
  'active',
  'revoked'
);

CREATE TYPE "note_status" AS ENUM (
  'active',
  'tombstoned'
);

CREATE TYPE "mutation_result" AS ENUM (
  'accepted',
  'conflict',
  'rejected_access',
  'rejected_epoch',
  'retry_predecessor'
);

CREATE TYPE "sync_action_type" AS ENUM (
  'note_created',
  'revision_accepted',
  'note_tombstoned',
  'note_restored',
  'note_moved_out',
  'note_moved_in'
);

CREATE TYPE "revision_operation" AS ENUM (
  'write',
  'tombstone',
  'restore',
  'move'
);

CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "teams" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" text NOT NULL,
  "created_by" uuid NOT NULL,
  "current_permission_epoch" bigint NOT NULL DEFAULT 1,
  "current_key_epoch" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz,
  "archived_by" uuid,
  "retention_expires_at" timestamptz
);

CREATE TABLE "team_permission_epochs" (
  "team_id" uuid NOT NULL,
  "epoch" bigint NOT NULL,
  "reason_code" text NOT NULL,
  "changed_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("team_id", "epoch")
);

CREATE TABLE "team_memberships" (
  "team_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" team_role NOT NULL,
  "status" membership_status NOT NULL,
  "membership_version" bigint NOT NULL DEFAULT 1,
  "invited_by" uuid,
  "joined_at" timestamptz NOT NULL DEFAULT (now()),
  "suspended_at" timestamptz,
  "removed_at" timestamptz,
  PRIMARY KEY ("team_id", "user_id")
);

CREATE TABLE "team_invites" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "team_id" uuid NOT NULL,
  "email_normalized" citext NOT NULL,
  "token_hash" bytea UNIQUE NOT NULL,
  "role" team_role NOT NULL,
  "invited_by" uuid NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "accepted_by" uuid,
  "accepted_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "team_groups" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "team_id" uuid NOT NULL,
  "system_key" text,
  "name_ciphertext" bytea NOT NULL,
  "name_nonce" bytea NOT NULL,
  "key_epoch" integer NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "team_group_members" (
  "team_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "added_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("team_id", "group_id", "user_id")
);

CREATE TABLE "spaces" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "team_id" uuid NOT NULL,
  "kind" space_kind NOT NULL,
  "name_ciphertext" bytea NOT NULL,
  "name_nonce" bytea NOT NULL,
  "current_key_epoch" integer NOT NULL DEFAULT 1,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz,
  "archived_by" uuid,
  "retention_expires_at" timestamptz,
  "archived_with_team" boolean NOT NULL DEFAULT false
);

CREATE TABLE "space_member_grants" (
  "team_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" space_role NOT NULL,
  "granted_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("team_id", "space_id", "user_id")
);

CREATE TABLE "space_group_grants" (
  "team_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "role" space_role NOT NULL,
  "granted_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("team_id", "space_id", "group_id")
);

CREATE TABLE "invite_space_grants" (
  "team_id" uuid NOT NULL,
  "invite_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "role" space_role NOT NULL,
  PRIMARY KEY ("team_id", "invite_id", "space_id")
);

CREATE TABLE "devices" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "client_instance_id" uuid NOT NULL,
  "public_key" bytea NOT NULL,
  "public_key_fingerprint" bytea NOT NULL,
  "key_algorithm" text NOT NULL,
  "status" device_status NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "last_seen_at" timestamptz NOT NULL DEFAULT (now()),
  "revoked_at" timestamptz
);

CREATE TABLE "team_key_epochs" (
  "team_id" uuid NOT NULL,
  "epoch" integer NOT NULL,
  "reason_code" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("team_id", "epoch")
);

CREATE TABLE "team_key_envelopes" (
  "team_id" uuid NOT NULL,
  "epoch" integer NOT NULL,
  "recipient_device_id" uuid NOT NULL,
  "wrapped_key" bytea NOT NULL,
  "wrapping_nonce" bytea NOT NULL,
  "algorithm" text NOT NULL,
  "created_by_device_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("team_id", "epoch", "recipient_device_id")
);

CREATE TABLE "space_key_epochs" (
  "space_id" uuid NOT NULL,
  "epoch" integer NOT NULL,
  "reason" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("space_id", "epoch")
);

CREATE TABLE "space_key_envelopes" (
  "space_id" uuid NOT NULL,
  "epoch" integer NOT NULL,
  "recipient_device_id" uuid NOT NULL,
  "wrapped_key" bytea NOT NULL,
  "wrapping_nonce" bytea NOT NULL,
  "algorithm" text NOT NULL,
  "created_by_device_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("space_id", "epoch", "recipient_device_id")
);

CREATE TABLE "notes" (
  "id" uuid PRIMARY KEY,
  "team_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "status" note_status NOT NULL DEFAULT 'active',
  "schema_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "note_revisions" (
  "id" uuid PRIMARY KEY,
  "team_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "note_id" uuid NOT NULL,
  "base_revision_id" uuid,
  "previous_head_id" uuid,
  "author_user_id" uuid NOT NULL,
  "author_device_id" uuid NOT NULL,
  "key_epoch" integer NOT NULL,
  "codec_version" integer NOT NULL,
  "object_key" text UNIQUE NOT NULL,
  "ciphertext_size" bigint NOT NULL,
  "ciphertext_sha256" bytea NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "note_heads" (
  "note_id" uuid PRIMARY KEY,
  "revision_id" uuid UNIQUE NOT NULL,
  "head_version" bigint NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "pending_revision_uploads" (
  "op_id" uuid PRIMARY KEY,
  "revision_id" uuid UNIQUE NOT NULL,
  "team_id" uuid NOT NULL,
  "note_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "actor_device_id" uuid NOT NULL,
  "client_sequence" bigint NOT NULL,
  "operation_kind" revision_operation NOT NULL DEFAULT 'write',
  "key_epoch" integer NOT NULL,
  "object_key" text UNIQUE NOT NULL,
  "ciphertext_size" bigint NOT NULL,
  "ciphertext_sha256" bytea NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "space_sync_counters" (
  "space_id" uuid PRIMARY KEY,
  "last_sequence" bigint NOT NULL DEFAULT 0
);

CREATE TABLE "sync_actions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "team_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "sequence" bigint NOT NULL,
  "action_type" sync_action_type NOT NULL,
  "note_id" uuid NOT NULL,
  "revision_id" uuid,
  "actor_user_id" uuid NOT NULL,
  "actor_device_id" uuid NOT NULL,
  "op_id" uuid NOT NULL,
  "permission_epoch" bigint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "mutation_receipts" (
  "actor_device_id" uuid NOT NULL,
  "op_id" uuid NOT NULL,
  "client_sequence" bigint NOT NULL,
  "team_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "note_id" uuid NOT NULL,
  "result" mutation_result NOT NULL,
  "result_revision_id" uuid,
  "result_action_sequence" bigint,
  "error_code" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("actor_device_id", "op_id")
);

CREATE TABLE "replica_checkpoint_observations" (
  "device_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "reported_applied_sequence" bigint NOT NULL,
  "reported_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("device_id", "space_id")
);

CREATE TABLE "note_tombstones" (
  "team_id" uuid NOT NULL,
  "note_id" uuid PRIMARY KEY,
  "space_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  "deleted_by_user_id" uuid NOT NULL,
  "deleted_by_device_id" uuid NOT NULL,
  "deleted_at" timestamptz NOT NULL DEFAULT (now()),
  "retention_expires_at" timestamptz NOT NULL,
  "restored_by_revision_id" uuid,
  "restored_at" timestamptz
);

CREATE TABLE "note_space_transitions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "team_id" uuid NOT NULL,
  "note_id" uuid NOT NULL,
  "from_space_id" uuid NOT NULL,
  "to_space_id" uuid NOT NULL,
  "target_revision_id" uuid NOT NULL,
  "source_action_sequence" bigint NOT NULL,
  "target_action_sequence" bigint NOT NULL,
  "moved_by_user_id" uuid NOT NULL,
  "moved_by_device_id" uuid NOT NULL,
  "op_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "team_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "team_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "actor_device_id" uuid,
  "event_type" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid,
  "affected_user_id" uuid,
  "affected_space_id" uuid,
  "old_status" text,
  "new_status" text,
  "permission_epoch" bigint,
  "team_key_epoch" integer,
  "space_key_epoch" integer,
  "reason_code" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "team_memberships" ("user_id", "status");

CREATE UNIQUE INDEX ON "team_invites" ("team_id", "id");

CREATE INDEX ON "team_invites" ("team_id", "email_normalized");

CREATE INDEX ON "team_invites" ("team_id", "expires_at");

CREATE UNIQUE INDEX ON "team_groups" ("team_id", "id");

CREATE UNIQUE INDEX ON "team_groups" ("team_id", "system_key");

CREATE INDEX ON "team_group_members" ("team_id", "user_id");

CREATE UNIQUE INDEX ON "spaces" ("team_id", "id");

CREATE INDEX ON "spaces" ("team_id", "kind");

CREATE INDEX ON "space_member_grants" ("team_id", "user_id");

CREATE INDEX ON "space_group_grants" ("team_id", "group_id");

CREATE UNIQUE INDEX ON "devices" ("user_id", "client_instance_id");

CREATE UNIQUE INDEX ON "devices" ("user_id", "public_key_fingerprint");

CREATE INDEX ON "devices" ("user_id", "status");

CREATE INDEX ON "team_key_envelopes" ("recipient_device_id");

CREATE INDEX ON "space_key_envelopes" ("recipient_device_id");

CREATE UNIQUE INDEX ON "notes" ("team_id", "id");

CREATE INDEX ON "notes" ("team_id", "space_id", "status");

CREATE UNIQUE INDEX ON "note_revisions" ("team_id", "note_id", "id");

CREATE UNIQUE INDEX ON "note_revisions" ("team_id", "space_id", "id");

CREATE UNIQUE INDEX ON "note_revisions" ("note_id", "id");

CREATE UNIQUE INDEX ON "note_revisions" ("space_id", "id");

CREATE INDEX ON "note_revisions" ("note_id", "created_at");

CREATE INDEX ON "note_revisions" ("author_device_id", "created_at");

CREATE INDEX ON "pending_revision_uploads" ("actor_user_id", "expires_at");

CREATE INDEX ON "pending_revision_uploads" ("space_id", "expires_at");

CREATE UNIQUE INDEX ON "sync_actions" ("space_id", "sequence");

CREATE UNIQUE INDEX ON "sync_actions" ("actor_device_id", "op_id", "space_id");

CREATE INDEX ON "sync_actions" ("note_id", "sequence");

CREATE UNIQUE INDEX ON "mutation_receipts" ("actor_device_id", "client_sequence");

CREATE INDEX ON "replica_checkpoint_observations" ("space_id", "reported_applied_sequence");

CREATE INDEX ON "note_space_transitions" ("note_id", "created_at");

CREATE UNIQUE INDEX ON "note_space_transitions" ("moved_by_device_id", "op_id");

CREATE INDEX ON "team_audit_events" ("team_id", "created_at");

CREATE INDEX ON "team_audit_events" ("target_type", "target_id");

COMMENT ON TABLE "team_groups" IS 'system_key is NULL for custom groups or ''everyone'' for the singleton system group. Migration adds a CHECK constraint.';

COMMENT ON TABLE "team_key_epochs" IS 'Encrypts team metadata such as group names. Note content continues to use space keys.';

COMMENT ON TABLE "notes" IS 'Stable routing metadata only. No plaintext title, path, body, tags, links, or content hash.';

COMMENT ON TABLE "replica_checkpoint_observations" IS 'Observability/retention hint only. pull_sync_actions always trusts the client-supplied cursor from local SQLite.';

COMMENT ON TABLE "note_space_transitions" IS 'A move keeps note_id, accepts a fresh snapshot encrypted for the target space, and emits moved-out/moved-in actions atomically.';

COMMENT ON TABLE "team_audit_events" IS 'Typed audit columns only. V1 intentionally has no free-form JSON metadata field.';

ALTER TABLE "profiles" ADD FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "teams" ADD FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "teams" ADD FOREIGN KEY ("archived_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_permission_epochs" ADD FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_permission_epochs" ADD FOREIGN KEY ("changed_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_memberships" ADD FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_memberships" ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_memberships" ADD FOREIGN KEY ("invited_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_invites" ADD FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_invites" ADD FOREIGN KEY ("invited_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_invites" ADD FOREIGN KEY ("accepted_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_groups" ADD FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_groups" ADD FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_group_members" ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_group_members" ADD FOREIGN KEY ("added_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "spaces" ADD FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "spaces" ADD FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "spaces" ADD FOREIGN KEY ("archived_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_member_grants" ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_member_grants" ADD FOREIGN KEY ("granted_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_group_grants" ADD FOREIGN KEY ("granted_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "devices" ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_key_epochs" ADD FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_key_epochs" ADD FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_key_envelopes" ADD FOREIGN KEY ("recipient_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_key_envelopes" ADD FOREIGN KEY ("created_by_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_key_epochs" ADD FOREIGN KEY ("space_id") REFERENCES "spaces" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_key_epochs" ADD FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_key_envelopes" ADD FOREIGN KEY ("recipient_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_key_envelopes" ADD FOREIGN KEY ("created_by_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notes" ADD FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_revisions" ADD FOREIGN KEY ("author_user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_revisions" ADD FOREIGN KEY ("author_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_heads" ADD FOREIGN KEY ("note_id") REFERENCES "notes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pending_revision_uploads" ADD FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pending_revision_uploads" ADD FOREIGN KEY ("actor_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_sync_counters" ADD FOREIGN KEY ("space_id") REFERENCES "spaces" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sync_actions" ADD FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sync_actions" ADD FOREIGN KEY ("actor_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mutation_receipts" ADD FOREIGN KEY ("actor_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "replica_checkpoint_observations" ADD FOREIGN KEY ("device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "replica_checkpoint_observations" ADD FOREIGN KEY ("space_id") REFERENCES "spaces" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_tombstones" ADD FOREIGN KEY ("note_id") REFERENCES "notes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_tombstones" ADD FOREIGN KEY ("deleted_by_user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_tombstones" ADD FOREIGN KEY ("deleted_by_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("note_id") REFERENCES "notes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("moved_by_user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("moved_by_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("team_id") REFERENCES "teams" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("actor_device_id") REFERENCES "devices" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("affected_user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("affected_space_id") REFERENCES "spaces" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_group_members" ADD FOREIGN KEY ("team_id", "group_id") REFERENCES "team_groups" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_group_members" ADD FOREIGN KEY ("team_id", "user_id") REFERENCES "team_memberships" ("team_id", "user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_member_grants" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_member_grants" ADD FOREIGN KEY ("team_id", "user_id") REFERENCES "team_memberships" ("team_id", "user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_group_grants" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_group_grants" ADD FOREIGN KEY ("team_id", "group_id") REFERENCES "team_groups" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "invite_space_grants" ADD FOREIGN KEY ("team_id", "invite_id") REFERENCES "team_invites" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "invite_space_grants" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_groups" ADD FOREIGN KEY ("team_id", "key_epoch") REFERENCES "team_key_epochs" ("team_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_key_envelopes" ADD FOREIGN KEY ("team_id", "epoch") REFERENCES "team_key_epochs" ("team_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "teams" ADD FOREIGN KEY ("id", "current_key_epoch") REFERENCES "team_key_epochs" ("team_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "teams" ADD FOREIGN KEY ("id", "current_permission_epoch") REFERENCES "team_permission_epochs" ("team_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "space_key_envelopes" ADD FOREIGN KEY ("space_id", "epoch") REFERENCES "space_key_epochs" ("space_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "spaces" ADD FOREIGN KEY ("id", "current_key_epoch") REFERENCES "space_key_epochs" ("space_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notes" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_revisions" ADD FOREIGN KEY ("team_id", "note_id") REFERENCES "notes" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_revisions" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_revisions" ADD FOREIGN KEY ("space_id", "key_epoch") REFERENCES "space_key_epochs" ("space_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_revisions" ADD FOREIGN KEY ("note_id", "base_revision_id") REFERENCES "note_revisions" ("note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_revisions" ADD FOREIGN KEY ("note_id", "previous_head_id") REFERENCES "note_revisions" ("note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_heads" ADD FOREIGN KEY ("note_id", "revision_id") REFERENCES "note_revisions" ("note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pending_revision_uploads" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pending_revision_uploads" ADD FOREIGN KEY ("space_id", "key_epoch") REFERENCES "space_key_epochs" ("space_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sync_actions" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sync_actions" ADD FOREIGN KEY ("team_id", "permission_epoch") REFERENCES "team_permission_epochs" ("team_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sync_actions" ADD FOREIGN KEY ("team_id", "note_id") REFERENCES "notes" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sync_actions" ADD FOREIGN KEY ("team_id", "note_id", "revision_id") REFERENCES "note_revisions" ("team_id", "note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sync_actions" ADD FOREIGN KEY ("team_id", "space_id", "revision_id") REFERENCES "note_revisions" ("team_id", "space_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mutation_receipts" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mutation_receipts" ADD FOREIGN KEY ("team_id", "note_id") REFERENCES "notes" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mutation_receipts" ADD FOREIGN KEY ("team_id", "note_id", "result_revision_id") REFERENCES "note_revisions" ("team_id", "note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_tombstones" ADD FOREIGN KEY ("team_id", "space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_tombstones" ADD FOREIGN KEY ("team_id", "note_id") REFERENCES "notes" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_tombstones" ADD FOREIGN KEY ("team_id", "note_id", "revision_id") REFERENCES "note_revisions" ("team_id", "note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_tombstones" ADD FOREIGN KEY ("team_id", "note_id", "restored_by_revision_id") REFERENCES "note_revisions" ("team_id", "note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("team_id", "note_id") REFERENCES "notes" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("team_id", "note_id", "target_revision_id") REFERENCES "note_revisions" ("team_id", "note_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("team_id", "to_space_id", "target_revision_id") REFERENCES "note_revisions" ("team_id", "space_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("team_id", "from_space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "note_space_transitions" ADD FOREIGN KEY ("team_id", "to_space_id") REFERENCES "spaces" ("team_id", "id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("team_id", "permission_epoch") REFERENCES "team_permission_epochs" ("team_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("team_id", "team_key_epoch") REFERENCES "team_key_epochs" ("team_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "team_audit_events" ADD FOREIGN KEY ("affected_space_id", "space_key_epoch") REFERENCES "space_key_epochs" ("space_id", "epoch") DEFERRABLE INITIALLY IMMEDIATE;

-- Cross-row lifecycle checks not expressible in DBML.
ALTER TABLE public.teams
  ADD CONSTRAINT teams_epoch_positive
  CHECK (current_permission_epoch > 0 AND current_key_epoch > 0),
  ADD CONSTRAINT teams_archive_state_check CHECK (
    (
      deleted_at IS NULL
      AND archived_by IS NULL
      AND retention_expires_at IS NULL
    )
    OR (
      deleted_at IS NOT NULL
      AND archived_by IS NOT NULL
      AND retention_expires_at > deleted_at
    )
  );

ALTER TABLE public.team_memberships
  ADD CONSTRAINT team_memberships_lifecycle_check
  CHECK (
    (status = 'suspended' AND suspended_at IS NOT NULL AND removed_at IS NULL)
    OR (status = 'removed' AND removed_at IS NOT NULL)
    OR (status IN ('key_pending', 'active') AND suspended_at IS NULL AND removed_at IS NULL)
  );

ALTER TABLE public.team_invites
  ADD CONSTRAINT team_invites_terminal_state_check
  CHECK (NOT (accepted_at IS NOT NULL AND revoked_at IS NOT NULL)),
  ADD CONSTRAINT team_invites_expiry_check
  CHECK (expires_at > created_at);

ALTER TABLE public.team_groups
  ADD CONSTRAINT team_groups_system_key_check
  CHECK (system_key IS NULL OR system_key = 'everyone');

ALTER TABLE public.devices
  ADD CONSTRAINT devices_revocation_check
  CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL)
    OR (status = 'active' AND revoked_at IS NULL)
  );

ALTER TABLE public.spaces
  ADD CONSTRAINT spaces_key_epoch_positive CHECK (current_key_epoch > 0),
  ADD CONSTRAINT spaces_archive_state_check CHECK (
    (
      deleted_at IS NULL
      AND archived_by IS NULL
      AND retention_expires_at IS NULL
      AND archived_with_team IS FALSE
    )
    OR (
      deleted_at IS NOT NULL
      AND archived_by IS NOT NULL
      AND retention_expires_at > deleted_at
    )
  );

ALTER TABLE public.note_revisions
  ADD CONSTRAINT note_revisions_size_check CHECK (ciphertext_size >= 0),
  ADD CONSTRAINT note_revisions_key_epoch_positive CHECK (key_epoch > 0);

ALTER TABLE public.pending_revision_uploads
  ADD CONSTRAINT pending_revision_uploads_size_check CHECK (ciphertext_size >= 0),
  ADD CONSTRAINT pending_revision_uploads_expiry_check CHECK (expires_at > created_at);

ALTER TABLE public.note_tombstones
  ADD CONSTRAINT note_tombstones_retention_check CHECK (retention_expires_at > deleted_at),
  ADD CONSTRAINT note_tombstones_restore_check CHECK (
    (restored_by_revision_id IS NULL AND restored_at IS NULL)
    OR (restored_by_revision_id IS NOT NULL AND restored_at IS NOT NULL)
  );

ALTER TABLE public.note_space_transitions
  ADD CONSTRAINT note_space_transitions_distinct_spaces CHECK (from_space_id <> to_space_id);
