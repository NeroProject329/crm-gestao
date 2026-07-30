-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "company_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ads_entry_status" AS ENUM ('ACTIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "payment_receipt_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'REVERSED');

-- CreateEnum
CREATE TYPE "daily_financial_result_status" AS ENUM ('POSITIVE', 'ADS_DEBT', 'ZERO');

-- CreateEnum
CREATE TYPE "weekly_settlement_status" AS ENUM ('OPEN', 'CLOSED', 'REVIEW_REQUIRED', 'PAID');

-- CreateEnum
CREATE TYPE "financial_adjustment_type" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "push_delivery_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "outbox_event_status" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "company_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "timezone" TEXT NOT NULL,
    "week_start_day" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_fee_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "percentage_bps" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_fee_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_commission_policies" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "percentage_bps" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_commission_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads_entries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ads_entry_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "canceled_at" TIMESTAMPTZ(3),

    CONSTRAINT "ads_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payer_name" TEXT NOT NULL,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "business_date" DATE NOT NULL,
    "status" "payment_receipt_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "review_note" TEXT,
    "reversed_by_user_id" UUID,
    "reversed_at" TIMESTAMPTZ(3),
    "reversal_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_files" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_financial_results" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "approved_revenue" DECIMAL(14,2) NOT NULL,
    "bank_fee_percentage_bps" INTEGER NOT NULL,
    "bank_cost" DECIMAL(14,2) NOT NULL,
    "revenue_after_bank" DECIMAL(14,2) NOT NULL,
    "ads_cost" DECIMAL(14,2) NOT NULL,
    "opening_ads_debt" DECIMAL(14,2) NOT NULL,
    "result_before_commission" DECIMAL(14,2) NOT NULL,
    "employee_commission_percentage_bps" INTEGER NOT NULL,
    "employee_amount" DECIMAL(14,2) NOT NULL,
    "admin_profit" DECIMAL(14,2) NOT NULL,
    "closing_ads_debt" DECIMAL(14,2) NOT NULL,
    "status" "daily_financial_result_status" NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_financial_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_settlements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "weekly_settlement_status" NOT NULL DEFAULT 'OPEN',
    "approved_revenue" DECIMAL(14,2) NOT NULL,
    "bank_cost" DECIMAL(14,2) NOT NULL,
    "ads_cost" DECIMAL(14,2) NOT NULL,
    "employee_amount" DECIMAL(14,2) NOT NULL,
    "admin_profit" DECIMAL(14,2) NOT NULL,
    "opening_ads_debt" DECIMAL(14,2) NOT NULL,
    "closing_ads_debt" DECIMAL(14,2) NOT NULL,
    "closed_by_user_id" UUID,
    "closed_at" TIMESTAMPTZ(3),
    "paid_by_user_id" UUID,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "weekly_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_adjustments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "type" "financial_adjustment_type" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "origin_type" TEXT NOT NULL,
    "origin_id" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "push_delivery_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider_id" TEXT,
    "next_attempt_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_event_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_company_id_key" ON "company_settings"("company_id");

-- CreateIndex
CREATE INDEX "users_company_id_status_idx" ON "users"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_company_id_email_key" ON "users"("company_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_expires_at_idx" ON "refresh_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "bank_fee_policies_company_id_effective_from_idx" ON "bank_fee_policies"("company_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_commission_policies_employee_id_effective_from_idx" ON "employee_commission_policies"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "ads_entries_employee_id_business_date_status_idx" ON "ads_entries"("employee_id", "business_date", "status");

-- CreateIndex
CREATE INDEX "ads_entries_company_id_business_date_status_idx" ON "ads_entries"("company_id", "business_date", "status");

-- CreateIndex
CREATE INDEX "payment_receipts_employee_id_business_date_status_idx" ON "payment_receipts"("employee_id", "business_date", "status");

-- CreateIndex
CREATE INDEX "payment_receipts_company_id_business_date_status_idx" ON "payment_receipts"("company_id", "business_date", "status");

-- CreateIndex
CREATE INDEX "payment_receipts_status_created_at_idx" ON "payment_receipts"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_files_receipt_id_key" ON "receipt_files"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_files_object_key_key" ON "receipt_files"("object_key");

-- CreateIndex
CREATE INDEX "daily_financial_results_company_id_business_date_idx" ON "daily_financial_results"("company_id", "business_date");

-- CreateIndex
CREATE INDEX "daily_financial_results_employee_id_business_date_idx" ON "daily_financial_results"("employee_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_financial_results_employee_id_business_date_key" ON "daily_financial_results"("employee_id", "business_date");

-- CreateIndex
CREATE INDEX "weekly_settlements_company_id_period_start_period_end_idx" ON "weekly_settlements"("company_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "weekly_settlements_employee_id_status_idx" ON "weekly_settlements"("employee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_settlements_employee_id_period_start_period_end_key" ON "weekly_settlements"("employee_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "financial_adjustments_settlement_id_created_at_idx" ON "financial_adjustments"("settlement_id", "created_at");

-- CreateIndex
CREATE INDEX "financial_adjustments_employee_id_created_at_idx" ON "financial_adjustments"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_company_id_created_at_idx" ON "notifications"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_recipients_user_id_read_at_idx" ON "notification_recipients"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipients_notification_id_user_id_key" ON "notification_recipients"("notification_id", "user_id");

-- CreateIndex
CREATE INDEX "push_deliveries_status_next_attempt_at_idx" ON "push_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_deliveries_notification_id_user_id_key" ON "push_deliveries"("notification_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_company_id_created_at_idx" ON "outbox_events"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_fee_policies" ADD CONSTRAINT "bank_fee_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commission_policies" ADD CONSTRAINT "employee_commission_policies_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads_entries" ADD CONSTRAINT "ads_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads_entries" ADD CONSTRAINT "ads_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reversed_by_user_id_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_files" ADD CONSTRAINT "receipt_files_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_financial_results" ADD CONSTRAINT "daily_financial_results_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_financial_results" ADD CONSTRAINT "daily_financial_results_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "weekly_settlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "weekly_settlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "weekly_settlements_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "weekly_settlements_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "weekly_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_adjustments" ADD CONSTRAINT "financial_adjustments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================
-- CRM V1 - PostgreSQL domain constraints
-- =========================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================================================
-- COMPANY SETTINGS
-- =========================================================

ALTER TABLE "company_settings"
ADD CONSTRAINT "company_settings_week_start_day_check"
CHECK ("week_start_day" BETWEEN 0 AND 6);

-- =========================================================
-- BANK FEE POLICIES
-- =========================================================

ALTER TABLE "bank_fee_policies"
ADD CONSTRAINT "bank_fee_policies_percentage_bps_check"
CHECK ("percentage_bps" BETWEEN 0 AND 10000);

ALTER TABLE "bank_fee_policies"
ADD CONSTRAINT "bank_fee_policies_dates_check"
CHECK (
  "effective_until" IS NULL
  OR "effective_until" >= "effective_from"
);

ALTER TABLE "bank_fee_policies"
ADD CONSTRAINT "bank_fee_policies_no_overlap"
EXCLUDE USING gist (
  "company_id" WITH =,
  daterange(
    "effective_from",
    COALESCE("effective_until", 'infinity'::date),
    '[]'
  ) WITH &&
);

-- =========================================================
-- EMPLOYEE COMMISSION POLICIES
-- =========================================================

ALTER TABLE "employee_commission_policies"
ADD CONSTRAINT "employee_commission_policies_percentage_bps_check"
CHECK ("percentage_bps" BETWEEN 0 AND 10000);

ALTER TABLE "employee_commission_policies"
ADD CONSTRAINT "employee_commission_policies_dates_check"
CHECK (
  "effective_until" IS NULL
  OR "effective_until" >= "effective_from"
);

ALTER TABLE "employee_commission_policies"
ADD CONSTRAINT "employee_commission_policies_no_overlap"
EXCLUDE USING gist (
  "employee_id" WITH =,
  daterange(
    "effective_from",
    COALESCE("effective_until", 'infinity'::date),
    '[]'
  ) WITH &&
);

-- =========================================================
-- ADS
-- =========================================================

ALTER TABLE "ads_entries"
ADD CONSTRAINT "ads_entries_amount_positive"
CHECK ("amount" > 0);

-- =========================================================
-- PAYMENT RECEIPTS
-- =========================================================

ALTER TABLE "payment_receipts"
ADD CONSTRAINT "payment_receipts_amount_positive"
CHECK ("amount" > 0);

ALTER TABLE "receipt_files"
ADD CONSTRAINT "receipt_files_size_positive"
CHECK ("size_bytes" > 0);

-- =========================================================
-- DAILY FINANCIAL RESULTS
-- =========================================================

ALTER TABLE "daily_financial_results"
ADD CONSTRAINT "daily_financial_results_bank_bps_check"
CHECK ("bank_fee_percentage_bps" BETWEEN 0 AND 10000);

ALTER TABLE "daily_financial_results"
ADD CONSTRAINT "daily_financial_results_commission_bps_check"
CHECK ("employee_commission_percentage_bps" BETWEEN 0 AND 10000);

ALTER TABLE "daily_financial_results"
ADD CONSTRAINT "daily_financial_results_nonnegative_check"
CHECK (
  "approved_revenue" >= 0
  AND "bank_cost" >= 0
  AND "ads_cost" >= 0
  AND "opening_ads_debt" >= 0
  AND "employee_amount" >= 0
  AND "admin_profit" >= 0
  AND "closing_ads_debt" >= 0
);

-- =========================================================
-- WEEKLY SETTLEMENTS
-- =========================================================

ALTER TABLE "weekly_settlements"
ADD CONSTRAINT "weekly_settlements_period_check"
CHECK ("period_end" >= "period_start");

ALTER TABLE "weekly_settlements"
ADD CONSTRAINT "weekly_settlements_nonnegative_check"
CHECK (
  "approved_revenue" >= 0
  AND "bank_cost" >= 0
  AND "ads_cost" >= 0
  AND "employee_amount" >= 0
  AND "admin_profit" >= 0
  AND "opening_ads_debt" >= 0
  AND "closing_ads_debt" >= 0
);

-- =========================================================
-- FINANCIAL ADJUSTMENTS
-- =========================================================

ALTER TABLE "financial_adjustments"
ADD CONSTRAINT "financial_adjustments_amount_positive"
CHECK ("amount" > 0);

-- =========================================================
-- PUSH DELIVERY
-- =========================================================

ALTER TABLE "push_deliveries"
ADD CONSTRAINT "push_deliveries_attempts_nonnegative"
CHECK ("attempts" >= 0);

-- =========================================================
-- OUTBOX
-- =========================================================

ALTER TABLE "outbox_events"
ADD CONSTRAINT "outbox_events_attempts_nonnegative"
CHECK ("attempts" >= 0);

