-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CUSTOMER', 'PROVIDER', 'STAFF');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CASH', 'PAYPAL', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONFIRMATION', 'REMINDER', 'COMPLETED');

-- CreateTable
CREATE TABLE "accounts" (
    "account_id" SERIAL NOT NULL,
    "account_name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "dateOfBirth" DATE,
    "gender" VARCHAR(10),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "avatar_url" VARCHAR(500),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "service_types" (
    "service_type_id" SERIAL NOT NULL,
    "service_type_name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("service_type_id")
);

-- CreateTable
CREATE TABLE "services" (
    "service_id" SERIAL NOT NULL,
    "service_name" VARCHAR(1024) NOT NULL,
    "description" TEXT,
    "setup_time" INTEGER,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "service_type_id" INTEGER,

    CONSTRAINT "services_pkey" PRIMARY KEY ("service_id")
);

-- CreateTable
CREATE TABLE "variations" (
    "variation_id" SERIAL NOT NULL,
    "variation_name" VARCHAR(255) NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "duration_hours" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "service_id" INTEGER NOT NULL,

    CONSTRAINT "variations_pkey" PRIMARY KEY ("variation_id")
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "tier_id" SERIAL NOT NULL,
    "price_modifier" DECIMAL(10,2) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "variation_id" INTEGER NOT NULL,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("tier_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "type" "NotificationType" NOT NULL DEFAULT 'REMINDER',
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_id" INTEGER,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "room_id" SERIAL NOT NULL,
    "room_name" VARCHAR(1024) NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "guest_capacity" INTEGER,
    "base_price" DECIMAL(10,2),
    "hourly_rate" DECIMAL(10,2),
    "description" VARCHAR(1024),
    "amenities" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "event_types" (
    "type_id" SERIAL NOT NULL,
    "type_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("type_id")
);

-- CreateTable
CREATE TABLE "events" (
    "event_id" SERIAL NOT NULL,
    "event_name" VARCHAR(1024) NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP(6),
    "end_time" TIMESTAMP(6),
    "event_date" DATE NOT NULL,
    "estimated_cost" DECIMAL(10,2),
    "final_cost" DECIMAL(10,2),
    "room_service_fee" DECIMAL(10,2),
    "date_create" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "account_id" INTEGER,
    "room_id" INTEGER,
    "event_type_id" INTEGER,

    CONSTRAINT "events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "event_services" (
    "event_service_id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "custom_price" DECIMAL(10,2),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "scheduled_time" TIMESTAMP(6),
    "duration_hours" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "event_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "variation_id" INTEGER,

    CONSTRAINT "event_services_pkey" PRIMARY KEY ("event_service_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "invoice_id" SERIAL NOT NULL,
    "invoice_number" VARCHAR(100) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) DEFAULT 0,
    "discount_amount" DECIMAL(10,2) DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "issue_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(6),
    "paid_date" TIMESTAMP(6),
    "notes" TEXT,
    "account_id" INTEGER,
    "event_id" INTEGER NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "invoice_details" (
    "invoice_detail_id" SERIAL NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "item_type" TEXT NOT NULL DEFAULT 'SERVICE',
    "invoice_id" INTEGER NOT NULL,
    "service_id" INTEGER,
    "variation_id" INTEGER,

    CONSTRAINT "invoice_details_pkey" PRIMARY KEY ("invoice_detail_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" VARCHAR(255),
    "stripe_payment_id" VARCHAR(255),
    "payment_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "account_id" INTEGER,
    "invoice_id" INTEGER,
    "event_id" INTEGER,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" SERIAL NOT NULL,
    "rate" SMALLINT NOT NULL,
    "comment" TEXT,
    "review_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "account_id" INTEGER NOT NULL,
    "service_id" INTEGER,
    "event_id" INTEGER,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "images" (
    "image_id" SERIAL NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "alt_text" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "service_id" INTEGER,
    "room_id" INTEGER,

    CONSTRAINT "images_pkey" PRIMARY KEY ("image_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_name_key" ON "accounts"("account_name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "service_types_category_idx" ON "service_types"("category");

-- CreateIndex
CREATE INDEX "services_service_type_id_idx" ON "services"("service_type_id");

-- CreateIndex
CREATE INDEX "services_is_available_idx" ON "services"("is_available");

-- CreateIndex
CREATE INDEX "variations_service_id_idx" ON "variations"("service_id");

-- CreateIndex
CREATE INDEX "variations_is_active_idx" ON "variations"("is_active");

-- CreateIndex
CREATE INDEX "pricing_tiers_variation_id_idx" ON "pricing_tiers"("variation_id");

-- CreateIndex
CREATE INDEX "pricing_tiers_valid_from_valid_to_idx" ON "pricing_tiers"("valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "pricing_tiers_is_active_idx" ON "pricing_tiers"("is_active");

-- CreateIndex
CREATE INDEX "notifications_account_id_idx" ON "notifications"("account_id");

-- CreateIndex
CREATE INDEX "notifications_sent_at_idx" ON "notifications"("sent_at");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- CreateIndex
CREATE INDEX "rooms_guest_capacity_idx" ON "rooms"("guest_capacity");

-- CreateIndex
CREATE INDEX "rooms_created_at_idx" ON "rooms"("created_at");

-- CreateIndex
CREATE INDEX "event_types_created_at_idx" ON "event_types"("created_at");

-- CreateIndex
CREATE INDEX "events_account_id_idx" ON "events"("account_id");

-- CreateIndex
CREATE INDEX "events_room_id_idx" ON "events"("room_id");

-- CreateIndex
CREATE INDEX "events_event_type_id_idx" ON "events"("event_type_id");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "events"("event_date");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_date_create_idx" ON "events"("date_create");

-- CreateIndex
CREATE INDEX "event_services_event_id_idx" ON "event_services"("event_id");

-- CreateIndex
CREATE INDEX "event_services_service_id_idx" ON "event_services"("service_id");

-- CreateIndex
CREATE INDEX "event_services_variation_id_idx" ON "event_services"("variation_id");

-- CreateIndex
CREATE INDEX "event_services_status_idx" ON "event_services"("status");

-- CreateIndex
CREATE INDEX "event_services_created_at_idx" ON "event_services"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_event_id_key" ON "invoices"("event_id");

-- CreateIndex
CREATE INDEX "invoices_account_id_idx" ON "invoices"("account_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");

-- CreateIndex
CREATE INDEX "invoice_details_invoice_id_idx" ON "invoice_details"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_details_service_id_idx" ON "invoice_details"("service_id");

-- CreateIndex
CREATE INDEX "invoice_details_variation_id_idx" ON "invoice_details"("variation_id");

-- CreateIndex
CREATE INDEX "payments_account_id_idx" ON "payments"("account_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_event_id_idx" ON "payments"("event_id");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "reviews_account_id_idx" ON "reviews"("account_id");

-- CreateIndex
CREATE INDEX "reviews_service_id_idx" ON "reviews"("service_id");

-- CreateIndex
CREATE INDEX "reviews_event_id_idx" ON "reviews"("event_id");

-- CreateIndex
CREATE INDEX "reviews_review_date_idx" ON "reviews"("review_date");

-- CreateIndex
CREATE INDEX "images_service_id_idx" ON "images"("service_id");

-- CreateIndex
CREATE INDEX "images_room_id_idx" ON "images"("room_id");

-- CreateIndex
CREATE INDEX "images_is_primary_idx" ON "images"("is_primary");

-- CreateIndex
CREATE INDEX "images_created_at_idx" ON "images"("created_at");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("service_type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variations" ADD CONSTRAINT "variations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "variations"("variation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_services" ADD CONSTRAINT "event_services_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_services" ADD CONSTRAINT "event_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_services" ADD CONSTRAINT "event_services_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "variations"("variation_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "variations"("variation_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("room_id") ON DELETE CASCADE ON UPDATE CASCADE;
