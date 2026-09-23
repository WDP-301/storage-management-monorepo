import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorageRentalBusinessSchema1789776000002 implements MigrationInterface {
  name = 'AddStorageRentalBusinessSchema1789776000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE OR REPLACE FUNCTION uuid_generate_v7()
        RETURNS uuid
        LANGUAGE sql
        VOLATILE
        PARALLEL SAFE
        AS $function$
          WITH uuid_v7_parts AS (
            SELECT
              floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS unix_ts_ms,
              replace(gen_random_uuid()::text, '-', '') AS random_hex
          )
          SELECT (
            lpad(to_hex(unix_ts_ms), 12, '0') ||
            '7' ||
            substr(random_hex, 1, 3) ||
            substr('89ab', (get_byte(decode(substr(random_hex, 4, 2), 'hex'), 0) & 3) + 1, 1) ||
            substr(random_hex, 6, 15)
          )::uuid
          FROM uuid_v7_parts
        $function$`,
      `CREATE EXTENSION IF NOT EXISTS "btree_gist"`,
      `DROP TABLE "storage_items"`,
      `DROP TABLE "storage_locations"`,
      `DROP TYPE "public"."storage_items_status_enum"`,
      `CREATE TABLE "facilities" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "code" varchar(50) NOT NULL UNIQUE,
        "name" varchar(150) NOT NULL, "address_line" varchar(255) NOT NULL, "ward" varchar(100), "district" varchar(100), "city" varchar(100) NOT NULL,
        "latitude" numeric(9,6) NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
        "longitude" numeric(9,6) NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','INACTIVE','MAINTENANCE')),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
      )`,
      `CREATE TABLE "app_users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
        "email" varchar(255) NOT NULL,
        "phone" varchar(30),
        "full_name" varchar(150) NOT NULL,
        "password_hash" varchar(255),
        "oauth_provider" varchar(30), "oauth_subject" varchar(255), "email_verified_at" timestamptz,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','SUSPENDED','DISABLED')),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
        CHECK (("oauth_provider" IS NULL) = ("oauth_subject" IS NULL))
      )`,
      `CREATE UNIQUE INDEX "UQ_app_users_email" ON "app_users" (lower("email"))`,
      `CREATE UNIQUE INDEX "UQ_app_users_oauth" ON "app_users" ("oauth_provider","oauth_subject") WHERE "oauth_provider" IS NOT NULL`,
      `CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "user_id" uuid NOT NULL,
        "refresh_token_hash" varchar(128) NOT NULL UNIQUE, "user_agent" varchar(500), "ip_address" inet,
        "expires_at" timestamptz NOT NULL, "last_used_at" timestamptz, "revoked_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_session_user" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE
      )`,
      `CREATE TABLE "user_role_assignments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "user_id" uuid NOT NULL, "role" varchar(40) NOT NULL, "facility_id" uuid,
        "assigned_by" uuid, "starts_at" timestamptz NOT NULL DEFAULT now(), "ends_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ura_user" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ura_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id"),
        CONSTRAINT "FK_ura_assigner" FOREIGN KEY ("assigned_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_ura_role" CHECK ("role" IN ('CUSTOMER','FACILITY_STAFF','FACILITY_MANAGER','OPERATIONS_MANAGER','ADMIN')),
        CONSTRAINT "CK_ura_role_scope" CHECK (
          ("role" IN ('CUSTOMER','OPERATIONS_MANAGER','ADMIN') AND "facility_id" IS NULL) OR
          ("role" IN ('FACILITY_STAFF','FACILITY_MANAGER') AND "facility_id" IS NOT NULL)
        ),
        CONSTRAINT "CK_ura_period" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
      )`,
      `CREATE UNIQUE INDEX "UQ_ura_global_role" ON "user_role_assignments" ("user_id","role") WHERE "facility_id" IS NULL`,
      `CREATE UNIQUE INDEX "UQ_ura_facility_role" ON "user_role_assignments" ("user_id","role","facility_id") WHERE "facility_id" IS NOT NULL`,
      `CREATE TABLE "unit_types" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "code" varchar(50) NOT NULL UNIQUE, "name" varchar(100) NOT NULL,
        "width_m" numeric(7,2) NOT NULL CHECK ("width_m" > 0), "length_m" numeric(7,2) NOT NULL CHECK ("length_m" > 0),
        "height_m" numeric(7,2) CHECK ("height_m" IS NULL OR "height_m" > 0), "monthly_price" numeric(14,2) NOT NULL CHECK ("monthly_price" >= 0),
        "default_deposit_months" numeric(4,2) NOT NULL DEFAULT 1 CHECK ("default_deposit_months" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
      )`,
      `CREATE TABLE "storage_units" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "facility_id" uuid NOT NULL, "unit_type_id" uuid NOT NULL, "code" varchar(50) NOT NULL,
        "zone" varchar(20), "pos_x" numeric(9,2), "pos_y" numeric(9,2),
        "area_m2" numeric(9,2) NOT NULL CHECK ("area_m2" > 0),
        "status" varchar(25) NOT NULL DEFAULT 'AVAILABLE' CHECK ("status" IN ('AVAILABLE','HELD','BOOKED','RENTED','PENDING_INSPECTION','MAINTENANCE','INACTIVE')),
        "notes" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
        CONSTRAINT "FK_units_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id"),
        CONSTRAINT "FK_units_type" FOREIGN KEY ("unit_type_id") REFERENCES "unit_types"("id"), CONSTRAINT "UQ_units_facility_code" UNIQUE ("facility_id","code"),
        CHECK (("pos_x" IS NULL) = ("pos_y" IS NULL))
      )`,
      `CREATE TABLE "bookings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "booking_no" varchar(40) NOT NULL UNIQUE, "customer_id" uuid NOT NULL,
        "preferred_facility_id" uuid, "status" varchar(25) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','HOLDING','PENDING_DEPOSIT','CONFIRMED','EXPIRED','CANCELLED')),
        "requested_start_at" timestamptz NOT NULL, "rental_months" integer NOT NULL CHECK ("rental_months" > 0), "currency" char(3) NOT NULL DEFAULT 'VND',
        "subtotal" numeric(14,2) NOT NULL DEFAULT 0 CHECK ("subtotal" >= 0), "deposit_total" numeric(14,2) NOT NULL DEFAULT 0 CHECK ("deposit_total" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_bookings_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id"),
        CONSTRAINT "FK_bookings_facility" FOREIGN KEY ("preferred_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL
      )`,
      `CREATE TABLE "booking_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "booking_id" uuid NOT NULL, "storage_unit_id" uuid NOT NULL,
        "monthly_price_snapshot" numeric(14,2) NOT NULL CHECK ("monthly_price_snapshot" >= 0), "deposit_snapshot" numeric(14,2) NOT NULL CHECK ("deposit_snapshot" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "FK_booking_items_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_booking_items_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id"), CONSTRAINT "UQ_booking_item_unit" UNIQUE ("booking_id","storage_unit_id")
      )`,
      `CREATE TABLE "unit_holds" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "booking_id" uuid NOT NULL, "storage_unit_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','CONVERTED','EXPIRED','RELEASED')),
        "held_at" timestamptz NOT NULL DEFAULT now(), "expires_at" timestamptz NOT NULL, "released_at" timestamptz,
        CONSTRAINT "FK_holds_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_holds_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id"), CHECK ("expires_at" > "held_at")
      )`,
      `CREATE UNIQUE INDEX "UQ_active_unit_hold" ON "unit_holds" ("storage_unit_id") WHERE "status" = 'ACTIVE'`,
      `CREATE TABLE "contracts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_no" varchar(40) NOT NULL UNIQUE, "booking_id" uuid UNIQUE, "customer_id" uuid NOT NULL,
        "status" varchar(25) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','ACTIVE','ENDED','CANCELLED')),
        "signed_at" timestamptz, "effective_at" timestamptz NOT NULL, "ended_at" timestamptz, "terms_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_contract_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_contract_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id")
      )`,
      `CREATE TABLE "contract_units" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_id" uuid NOT NULL, "storage_unit_id" uuid NOT NULL,
        "start_at" timestamptz NOT NULL, "end_at" timestamptz NOT NULL, "monthly_price_snapshot" numeric(14,2) NOT NULL CHECK ("monthly_price_snapshot" >= 0),
        "deposit_snapshot" numeric(14,2) NOT NULL CHECK ("deposit_snapshot" >= 0), "status" varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('PENDING','ACTIVE','TRANSITIONING','ENDED')),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_contract_units_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contract_units_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id"), CHECK ("end_at" > "start_at")
      )`,
      `ALTER TABLE "contract_units" ADD CONSTRAINT "EXCL_contract_units_overlap" EXCLUDE USING gist ("storage_unit_id" WITH =, tstzrange("start_at","end_at",'[)') WITH &&) WHERE ("status" IN ('PENDING','ACTIVE','TRANSITIONING'))`,
      `CREATE TABLE "rental_periods" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_unit_id" uuid NOT NULL, "period_no" integer NOT NULL CHECK ("period_no" > 0),
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('INITIAL','RENEWAL')),
        "start_at" timestamptz NOT NULL, "end_at" timestamptz NOT NULL, "months" integer NOT NULL CHECK ("months" > 0),
        "monthly_price_snapshot" numeric(14,2) NOT NULL CHECK ("monthly_price_snapshot" >= 0), "rent_total" numeric(14,2) NOT NULL CHECK ("rent_total" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "FK_period_contract_unit" FOREIGN KEY ("contract_unit_id") REFERENCES "contract_units"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_period_no" UNIQUE ("contract_unit_id","period_no"), CHECK ("end_at" > "start_at")
      )`,
      `ALTER TABLE "rental_periods" ADD CONSTRAINT "EXCL_rental_periods_overlap" EXCLUDE USING gist ("contract_unit_id" WITH =, tstzrange("start_at","end_at",'[)') WITH &&)`,
      `CREATE TABLE "unit_change_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_unit_id" uuid NOT NULL, "old_unit_id" uuid NOT NULL, "new_unit_id" uuid,
        "requested_by" uuid NOT NULL, "approved_by" uuid, "reason" text NOT NULL, "requirements" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar(25) NOT NULL DEFAULT 'REQUESTED' CHECK ("status" IN ('REQUESTED','PROPOSED','APPROVED','TRANSITIONING','COMPLETED','REJECTED','CANCELLED')),
        "transition_start_at" timestamptz, "transition_end_at" timestamptz, "rent_difference" numeric(14,2) NOT NULL DEFAULT 0, "deposit_difference" numeric(14,2) NOT NULL DEFAULT 0,
        "decision_note" text, "history" jsonb NOT NULL DEFAULT '[]'::jsonb, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_change_contract_unit" FOREIGN KEY ("contract_unit_id") REFERENCES "contract_units"("id"),
        CONSTRAINT "FK_change_old_unit" FOREIGN KEY ("old_unit_id") REFERENCES "storage_units"("id"), CONSTRAINT "FK_change_new_unit" FOREIGN KEY ("new_unit_id") REFERENCES "storage_units"("id"),
        CONSTRAINT "FK_change_requester" FOREIGN KEY ("requested_by") REFERENCES "app_users"("id"), CONSTRAINT "FK_change_approver" FOREIGN KEY ("approved_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CHECK ("transition_end_at" IS NULL OR "transition_start_at" IS NOT NULL AND "transition_end_at" > "transition_start_at"), CHECK ("new_unit_id" IS NULL OR "new_unit_id" <> "old_unit_id")
      )`,
      `CREATE TABLE "waitlist_entries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "customer_id" uuid NOT NULL, "booking_id" uuid, "facility_id" uuid NOT NULL, "unit_type_id" uuid,
        "quantity" integer NOT NULL DEFAULT 1 CHECK ("quantity" > 0), "min_price" numeric(14,2) CHECK ("min_price" >= 0), "max_price" numeric(14,2) CHECK ("max_price" >= 0),
        "nearby_required" boolean NOT NULL DEFAULT false, "status" varchar(20) NOT NULL DEFAULT 'WAITING' CHECK ("status" IN ('WAITING','OFFERED','ACCEPTED','EXPIRED','CANCELLED')),
        "offer_expires_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_wait_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id"), CONSTRAINT "FK_wait_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_wait_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id"),
        CONSTRAINT "FK_wait_type" FOREIGN KEY ("unit_type_id") REFERENCES "unit_types"("id") ON DELETE SET NULL, CHECK ("max_price" IS NULL OR "min_price" IS NULL OR "max_price" >= "min_price")
      )`,
      `CREATE TABLE "invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "invoice_no" varchar(40) NOT NULL UNIQUE, "customer_id" uuid NOT NULL, "contract_id" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','VOID')),
        "currency" char(3) NOT NULL DEFAULT 'VND', "subtotal" numeric(14,2) NOT NULL DEFAULT 0, "tax_amount" numeric(14,2) NOT NULL DEFAULT 0, "total" numeric(14,2) NOT NULL DEFAULT 0,
        "due_at" timestamptz, "issued_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_invoice_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id"), CONSTRAINT "FK_invoice_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL,
        CHECK ("subtotal" >= 0 AND "tax_amount" >= 0 AND "total" = "subtotal" + "tax_amount")
      )`,
      `CREATE TABLE "invoice_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "invoice_id" uuid NOT NULL, "storage_unit_id" uuid, "rental_period_id" uuid,
        "item_type" varchar(25) NOT NULL CHECK ("item_type" IN ('RENT','DEPOSIT','DAMAGE','SERVICE','ADJUSTMENT')),
        "description" varchar(255) NOT NULL, "quantity" numeric(10,2) NOT NULL DEFAULT 1 CHECK ("quantity" > 0), "unit_amount" numeric(14,2) NOT NULL,
        "amount" numeric(14,2) NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_invoice_item_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoice_item_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_invoice_item_period" FOREIGN KEY ("rental_period_id") REFERENCES "rental_periods"("id") ON DELETE SET NULL
      )`,
      `CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "payment_no" varchar(40) NOT NULL UNIQUE, "invoice_id" uuid, "booking_id" uuid, "customer_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL CHECK ("type" IN ('RENT','DEPOSIT','FEE','MIXED')),
        "method" varchar(20) NOT NULL DEFAULT 'SIMULATED' CHECK ("method" IN ('CASH','BANK_TRANSFER','VNPAY','MOMO','SIMULATED')),
        "status" varchar(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','SUCCEEDED','FAILED','CANCELLED')),
        "amount" numeric(14,2) NOT NULL CHECK ("amount" > 0), "provider_ref" varchar(100), "paid_at" timestamptz, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_payment_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL, CONSTRAINT "FK_payment_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_payment_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id"),
        CHECK ("invoice_id" IS NOT NULL OR "booking_id" IS NOT NULL)
      )`,
      `CREATE TABLE "deposits" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_unit_id" uuid NOT NULL UNIQUE, "payment_id" uuid,
        "amount_snapshot" numeric(14,2) NOT NULL CHECK ("amount_snapshot" >= 0), "held_amount" numeric(14,2) NOT NULL CHECK ("held_amount" >= 0),
        "status" varchar(20) NOT NULL DEFAULT 'HELD' CHECK ("status" IN ('PENDING','HELD','PARTIALLY_REFUNDED','REFUNDED','FORFEITED')),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_deposit_contract_unit" FOREIGN KEY ("contract_unit_id") REFERENCES "contract_units"("id"), CONSTRAINT "FK_deposit_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL,
        CHECK ("held_amount" <= "amount_snapshot")
      )`,
      `CREATE TABLE "refunds" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "refund_no" varchar(40) NOT NULL UNIQUE, "deposit_id" uuid, "payment_id" uuid, "approved_by" uuid,
        "amount" numeric(14,2) NOT NULL CHECK ("amount" > 0), "status" varchar(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','SUCCEEDED','FAILED','CANCELLED')),
        "reason" text NOT NULL, "processed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_refund_deposit" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id") ON DELETE SET NULL, CONSTRAINT "FK_refund_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_refund_approver" FOREIGN KEY ("approved_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CHECK ("deposit_id" IS NOT NULL OR "payment_id" IS NOT NULL)
      )`,
      `CREATE TABLE "access_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_unit_id" uuid NOT NULL, "event_type" varchar(20) NOT NULL CHECK ("event_type" IN ('CHECK_IN','CHECK_OUT')),
        "qr_token_hash" varchar(128) NOT NULL UNIQUE, "expires_at" timestamptz NOT NULL, "used_at" timestamptz, "verified_by" uuid, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_access_contract_unit" FOREIGN KEY ("contract_unit_id") REFERENCES "contract_units"("id"), CONSTRAINT "FK_access_verifier" FOREIGN KEY ("verified_by") REFERENCES "app_users"("id") ON DELETE SET NULL
      )`,
      `CREATE TABLE "inspections" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_unit_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL CHECK ("type" IN ('PRE_HANDOVER','RETURN','MAINTENANCE')), "status" varchar(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','PASSED','DAMAGE_FOUND')),
        "inspected_by" uuid, "condition_notes" text, "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb, "inspected_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_inspection_contract_unit" FOREIGN KEY ("contract_unit_id") REFERENCES "contract_units"("id"),
        CONSTRAINT "FK_inspection_user" FOREIGN KEY ("inspected_by") REFERENCES "app_users"("id") ON DELETE SET NULL
      )`,
      `CREATE TABLE "damage_fees" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "inspection_id" uuid NOT NULL, "invoice_item_id" uuid, "confirmed_by" uuid,
        "description" text NOT NULL, "amount" numeric(14,2) NOT NULL CHECK ("amount" >= 0), "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar(20) NOT NULL DEFAULT 'PROPOSED' CHECK ("status" IN ('PROPOSED','CONFIRMED','WAIVED','PAID')),
        "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "FK_damage_inspection" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_damage_invoice_item" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE SET NULL, CONSTRAINT "FK_damage_confirmer" FOREIGN KEY ("confirmed_by") REFERENCES "app_users"("id") ON DELETE SET NULL
      )`,
      `CREATE TABLE "handover_assets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "contract_unit_id" uuid NOT NULL, "direction" varchar(15) NOT NULL CHECK ("direction" IN ('HANDOVER','RETURN')),
        "asset_type" varchar(30) NOT NULL CHECK ("asset_type" IN ('PHOTO','VIDEO','DOCUMENT','SIGNATURE')), "file_url" varchar(1000) NOT NULL, "uploaded_by" uuid,
        "notes" text, "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "FK_asset_contract_unit" FOREIGN KEY ("contract_unit_id") REFERENCES "contract_units"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_asset_uploader" FOREIGN KEY ("uploaded_by") REFERENCES "app_users"("id") ON DELETE SET NULL
      )`,
      `CREATE TABLE "service_tickets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "ticket_no" varchar(40) NOT NULL UNIQUE, "type" varchar(20) NOT NULL CHECK ("type" IN ('SUPPORT','MAINTENANCE')),
        "facility_id" uuid NOT NULL, "storage_unit_id" uuid, "customer_id" uuid, "assigned_to" uuid, "priority" varchar(15) NOT NULL DEFAULT 'NORMAL' CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT')),
        "status" varchar(20) NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED')),
        "subject" varchar(200) NOT NULL, "description" text NOT NULL, "resolution" text, "history" jsonb NOT NULL DEFAULT '[]'::jsonb, "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "resolved_at" timestamptz,
        CONSTRAINT "FK_ticket_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id"), CONSTRAINT "FK_ticket_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ticket_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE SET NULL, CONSTRAINT "FK_ticket_assignee" FOREIGN KEY ("assigned_to") REFERENCES "app_users"("id") ON DELETE SET NULL
      )`,
      `CREATE TABLE "favorites" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "customer_id" uuid NOT NULL, "facility_id" uuid, "storage_unit_id" uuid, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_favorite_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id") ON DELETE CASCADE, CONSTRAINT "FK_favorite_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_favorite_unit" FOREIGN KEY ("storage_unit_id") REFERENCES "storage_units"("id") ON DELETE CASCADE, CHECK (("facility_id" IS NOT NULL)::int + ("storage_unit_id" IS NOT NULL)::int = 1)
      )`,
      `CREATE UNIQUE INDEX "UQ_favorite_facility" ON "favorites" ("customer_id","facility_id") WHERE "facility_id" IS NOT NULL`,
      `CREATE UNIQUE INDEX "UQ_favorite_unit" ON "favorites" ("customer_id","storage_unit_id") WHERE "storage_unit_id" IS NOT NULL`,
      `CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "user_id" uuid NOT NULL, "channel" varchar(15) NOT NULL CHECK ("channel" IN ('IN_APP','EMAIL','SMS')),
        "type" varchar(50) NOT NULL, "title" varchar(200) NOT NULL, "body" text NOT NULL, "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar(15) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','SENT','FAILED','READ')), "sent_at" timestamptz, "read_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_notification_user" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE
      )`,
      `CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "owner_user_id" uuid, "contract_id" uuid, "facility_id" uuid,
        "type" varchar(30) NOT NULL CHECK ("type" IN ('IDENTITY','CONTRACT','INVOICE','HANDOVER','POLICY','OTHER')), "name" varchar(255) NOT NULL, "file_url" varchar(1000) NOT NULL,
        "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0), "uploaded_by" uuid, "created_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
        CONSTRAINT "FK_document_owner" FOREIGN KEY ("owner_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL, CONSTRAINT "FK_document_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_document_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL, CONSTRAINT "FK_document_uploader" FOREIGN KEY ("uploaded_by") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CHECK (("owner_user_id" IS NOT NULL)::int + ("contract_id" IS NOT NULL)::int + ("facility_id" IS NOT NULL)::int > 0)
      )`,
      `CREATE TABLE "feedback" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "customer_id" uuid NOT NULL, "facility_id" uuid NOT NULL, "contract_id" uuid,
        "rating" smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5), "comment" text, "status" varchar(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','PUBLISHED','HIDDEN')),
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_feedback_customer" FOREIGN KEY ("customer_id") REFERENCES "app_users"("id"), CONSTRAINT "FK_feedback_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id"),
        CONSTRAINT "FK_feedback_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL, CONSTRAINT "UQ_feedback_contract" UNIQUE ("customer_id","contract_id")
      )`,
      `CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(), "actor_user_id" uuid, "facility_id" uuid, "action" varchar(80) NOT NULL,
        "entity_type" varchar(80) NOT NULL, "entity_id" uuid, "reason" text, "before_data" jsonb, "after_data" jsonb, "ip_address" inet,
        "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "FK_audit_actor" FOREIGN KEY ("actor_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_audit_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL
      )`,
      `CREATE UNIQUE INDEX "UQ_feedback_facility" ON "feedback" ("customer_id","facility_id") WHERE "contract_id" IS NULL`,
    ];

    for (const statement of statements) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'audit_logs',
      'feedback',
      'documents',
      'notifications',
      'favorites',
      'service_tickets',
      'handover_assets',
      'damage_fees',
      'inspections',
      'access_events',
      'refunds',
      'deposits',
      'payments',
      'invoice_items',
      'invoices',
      'waitlist_entries',
      'unit_change_requests',
      'rental_periods',
      'contract_units',
      'contracts',
      'unit_holds',
      'booking_items',
      'bookings',
      'storage_units',
      'unit_types',
      'sessions',
      'user_role_assignments',
      'app_users',
      'facilities',
    ];
    for (const table of tables) await queryRunner.query(`DROP TABLE "${table}"`);

    await queryRunner.query(
      `CREATE TYPE "public"."storage_items_status_enum" AS ENUM('IN_STOCK','LOW_STOCK','OUT_OF_STOCK','DISCONTINUED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "storage_locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" text,
        "address" character varying(255),
        "capacity" integer DEFAULT 1000,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_storage_locations_code" UNIQUE ("code"),
        CONSTRAINT "PK_storage_locations" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_da3de2fe02ef924a9f262b9445" ON "storage_locations" ("created_at")',
    );
    await queryRunner.query(
      `CREATE TABLE "storage_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sku" character varying(50) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "quantity" integer NOT NULL DEFAULT 0,
        "min_quantity" integer NOT NULL DEFAULT 5,
        "unit" character varying(30) NOT NULL DEFAULT 'pcs',
        "price" numeric(12,2) NOT NULL DEFAULT 0,
        "status" "public"."storage_items_status_enum" NOT NULL DEFAULT 'IN_STOCK',
        "location_id" uuid,
        "image_url" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_storage_items_sku" UNIQUE ("sku"),
        CONSTRAINT "PK_storage_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_134b522a28bf503d51f2b26f2d8" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d05620f34fb48706c569f6c6c1" ON "storage_items" ("created_at")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_a022addd45d14b78d1ff225af1" ON "storage_items" ("sku")',
    );
    await queryRunner.query(`DROP FUNCTION uuid_generate_v7()`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "btree_gist"`);
  }
}
