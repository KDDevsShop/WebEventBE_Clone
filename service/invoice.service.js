import { PrismaClient } from "@prisma/client";
import {
  validateNumber,
  validateString,
  validateDateRange,
  parseAndValidateId,
  createValidationResult,
} from "../utils/validation.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

const validateInvoiceData = (invoiceData) => {
  const errors = [];

  // Required fields validation
  const totalAmountValidation = validateNumber(invoiceData.total_amount, "Total amount", {
    min: 0,
  });
  const eventIdValidation = parseAndValidateId(invoiceData.event_id, "Event ID");

  errors.push(...totalAmountValidation.errors);
  if (typeof eventIdValidation !== 'number') errors.push("Invalid event ID");

  // Optional fields validation
  if (invoiceData.account_id) {
    const accountIdValidation = parseAndValidateId(invoiceData.account_id, "Account ID");
    if (typeof accountIdValidation !== 'number') errors.push("Invalid account ID");
  }

  if (invoiceData.tax_amount) {
    const taxValidation = validateNumber(invoiceData.tax_amount, "Tax amount", {
      min: 0,
    });
    errors.push(...taxValidation.errors);
  }

  if (invoiceData.discount_amount) {
    const discountValidation = validateNumber(invoiceData.discount_amount, "Discount amount", {
      min: 0,
    });
    errors.push(...discountValidation.errors);
  }

  if (invoiceData.notes) {
    const notesValidation = validateString(invoiceData.notes, "Notes", {
      maxLength: 1000,
      sanitize: true,
    });
    errors.push(...notesValidation.errors);
  }

  if (invoiceData.status) {
    const validStatuses = ['PENDING', 'PAID', 'CANCELLED'];
    if (!validStatuses.includes(invoiceData.status)) {
      errors.push("Invalid invoice status");
    }
  }

  return errors;
};

const validateInvoiceDetailData = (detailData) => {
  const errors = [];

  const itemNameValidation = validateString(detailData.item_name, "Item name", {
    required: true,
    minLength: 3,
    maxLength: 255,
    sanitize: true,
  });
  const quantityValidation = validateNumber(detailData.quantity, "Quantity", {
    min: 1,
    integer: true,
  });
  const unitPriceValidation = validateNumber(detailData.unit_price, "Unit price", {
    min: 0,
  });
  const subtotalValidation = validateNumber(detailData.subtotal, "Subtotal", {
    min: 0,
  });

  errors.push(...itemNameValidation.errors, ...quantityValidation.errors, ...unitPriceValidation.errors, ...subtotalValidation.errors);

  if (detailData.service_id) {
    const serviceIdValidation = parseAndValidateId(detailData.service_id, "Service ID");
    if (typeof serviceIdValidation !== 'number') errors.push("Invalid service ID");
  }

  if (detailData.variation_id) {
    const variationIdValidation = parseAndValidateId(detailData.variation_id, "Variation ID");
    if (typeof variationIdValidation !== 'number') errors.push("Invalid variation ID");
  }

  if (detailData.item_type) {
    const validTypes = ['SERVICE', 'ROOM', 'OTHER'];
    if (!validTypes.includes(detailData.item_type)) {
      errors.push("Invalid item type");
    }
  }

  return errors;
};

// ===== Create Invoice =====
export const createInvoice = async (invoiceData, details = [], tx = prisma) => {
  try {
    const { event_id, account_id, total_amount, tax_amount, discount_amount, status = 'PENDING', notes } = invoiceData;

    // Validate invoice data
    const validationErrors = validateInvoiceData(invoiceData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    // Validate event
    const event = await tx.event.findUnique({
      where: { event_id: Number(event_id) },
      select: { event_id: true, status: true },
    });
    if (!event || event.status === 'CANCELLED') {
      return createValidationResult(false, ["Event not found or cancelled"]);
    }

    // Validate account
    if (account_id) {
      const account = await tx.account.findUnique({
        where: { account_id: Number(account_id) },
        select: { account_id: true },
      });
      if (!account) {
        return createValidationResult(false, ["Account not found"]);
      }
    }

    // Validate invoice details
    for (const detail of details) {
      const detailErrors = validateInvoiceDetailData(detail);
      if (detailErrors.length > 0) {
        return createValidationResult(false, detailErrors);
      }
    }

    const newInvoice = await tx.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoice_number: `INV-${Date.now()}`,
          total_amount: Number(total_amount),
          tax_amount: tax_amount ? Number(tax_amount) : 0,
          discount_amount: discount_amount ? Number(discount_amount) : 0,
          status,
          event_id: Number(event_id),
          account_id: account_id ? Number(account_id) : null,
          notes: notes?.trim() || null,
          issue_date: new Date(),
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
        },
        include: {
          event: { select: { event_id: true, event_name: true } },
          account: { select: { account_id: true, account_name: true } },
        },
      });

      // Create invoice details
      if (details.length > 0) {
        await tx.invoiceDetail.createMany({
          data: details.map((detail) => ({
            invoice_id: invoice.invoice_id,
            item_name: detail.item_name.trim(),
            quantity: Number(detail.quantity),
            unit_price: Number(detail.unit_price),
            subtotal: Number(detail.subtotal),
            item_type: detail.item_type || 'SERVICE',
            service_id: detail.service_id ? Number(detail.service_id) : null,
            variation_id: detail.variation_id ? Number(detail.variation_id) : null,
          })),
        });
      }

      return invoice;
    });

    return createValidationResult(true, [], {
      ...newInvoice,
      detailsCount: details.length,
    });
  } catch (error) {
    return handleError("createInvoice", error);
  }
};

// ===== Get All Invoices =====
export const getAllInvoices = async (filters = {}) => {
  try {
    const { event_id, account_id, status, page = 1, limit = 20, sortBy = 'issue_date', sortOrder = 'asc' } = filters;

    // Validate pagination
    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return createValidationResult(false, paginationErrors);
    }

    // Build where clause
    const where = {};
    if (event_id) where.event_id = parseAndValidateId(event_id, "Event ID");
    if (account_id) where.account_id = parseAndValidateId(account_id, "Account ID");
    if (status) where.status = status;

    const skip = (validPage - 1) * validLimit;
    const orderBy = { [sortBy]: sortOrder?.toLowerCase() || 'asc' };

    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          event: { select: { event_id: true, event_name: true } },
          account: { select: { account_id: true, account_name: true } },
          details: { select: { invoice_detail_id: true, item_name: true, quantity: true, unit_price: true, subtotal: true } },
        },
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.invoice.count({ where }),
    ]);

    const processedInvoices = invoices.map((invoice) => ({
      ...invoice,
      detailsCount: invoice.details.length,
    }));

    return createValidationResult(true, [], {
      invoices: processedInvoices,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / validLimit),
        hasNextPage: validPage < Math.ceil(totalCount / validLimit),
        hasPreviousPage: validPage > 1,
      },
    });
  } catch (error) {
    return handleError("getAllInvoices", error);
  }
};

// ===== Get Invoice by ID =====
export const getInvoiceById = async (invoiceId) => {
  try {
    const validInvoiceId = parseAndValidateId(invoiceId, "Invoice ID");

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: validInvoiceId },
      include: {
        event: { select: { event_id: true, event_name: true } },
        account: { select: { account_id: true, account_name: true } },
        details: { select: { invoice_detail_id: true, item_name: true, quantity: true, unit_price: true, subtotal: true } },
      },
    });

    if (!invoice) {
      return createValidationResult(false, ["Invoice not found"]);
    }

    return createValidationResult(true, [], {
      ...invoice,
      detailsCount: invoice.details.length,
    });
  } catch (error) {
    return handleError("getInvoiceById", error);
  }
};

// ===== Update Invoice =====
export const updateInvoice = async (invoiceId, updateData, tx = prisma) => {
  try {
    const validInvoiceId = parseAndValidateId(invoiceId, "Invoice ID");

    // Check if invoice exists
    const existingInvoice = await tx.invoice.findUnique({
      where: { invoice_id: validInvoiceId },
    });

    if (!existingInvoice) {
      return createValidationResult(false, ["Invoice not found"]);
    }

    // Validate update data
    const validationErrors = validateInvoiceData(updateData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const { event_id, account_id, total_amount, tax_amount, discount_amount, status, notes, paid_at } = updateData;

    // Validate references
    if (event_id && event_id !== existingInvoice.event_id) {
      const event = await tx.event.findUnique({
        where: { event_id: Number(event_id) },
        select: { event_id: true, status: true },
      });
      if (!event || event.status === 'CANCELLED') {
        return createValidationResult(false, ["Event not found or cancelled"]);
      }
    }

    if (account_id && account_id !== existingInvoice.account_id) {
      const account = await tx.account.findUnique({
        where: { account_id: Number(account_id) },
        select: { account_id: true },
      });
      if (!account) {
        return createValidationResult(false, ["Account not found"]);
      }
    }

    // Prepare update data
    const updateFields = {};
    if (event_id !== undefined) updateFields.event_id = Number(event_id);
    if (account_id !== undefined) updateFields.account_id = account_id ? Number(account_id) : null;
    if (total_amount !== undefined) updateFields.total_amount = Number(total_amount);
    if (tax_amount !== undefined) updateFields.tax_amount = Number(tax_amount);
    if (discount_amount !== undefined) updateFields.discount_amount = Number(discount_amount);
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes?.trim() || null;
    if (paid_at !== undefined) updateFields.paid_at = paid_at ? new Date(paid_at) : null;

    const updatedInvoice = await tx.invoice.update({
      where: { invoice_id: validInvoiceId },
      data: updateFields,
      include: {
        event: { select: { event_id: true, event_name: true } },
        account: { select: { account_id: true, account_name: true } },
        details: { select: { invoice_detail_id: true, item_name: true, quantity: true, unit_price: true, subtotal: true } },
      },
    });

    return createValidationResult(true, [], {
      ...updatedInvoice,
      detailsCount: updatedInvoice.details.length,
    });
  } catch (error) {
    return handleError("updateInvoice", error);
  }
};

// ===== Delete Invoice =====
export const deleteInvoice = async (invoiceId) => {
  try {
    const validInvoiceId = parseAndValidateId(invoiceId, "Invoice ID");

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoice_id: validInvoiceId },
      include: {
        payments: { select: { payment_id: true } },
      },
    });

    if (!existingInvoice) {
      return createValidationResult(false, ["Invoice not found"]);
    }

    // Check for dependencies
    if (existingInvoice.payments.length > 0) {
      return createValidationResult(false, [
        `Cannot delete invoice. It has ${existingInvoice.payments.length} associated payments.`,
      ], {
        paymentsCount: existingInvoice.payments.length,
      });
    }

    await prisma.invoice.delete({
      where: { invoice_id: validInvoiceId },
    });

    return createValidationResult(true, [], {
      invoice_id: validInvoiceId,
    });
  } catch (error) {
    return handleError("deleteInvoice", error);
  }
};

export const getInvoiceStats = async (filter = {}) => {
  try {
    // Optional: filter by account_id for user analytics
    const where = {};
    if (filter.account_id) where.account_id = filter.account_id;

    // Aggregate stats
    const [
      totalInvoices,
      totalAmount,
      paidInvoices,
      pendingInvoices,
      cancelledInvoices,
      overdueInvoices,
      refundedInvoices,
      totalPaidAmount,
      totalOverdueAmount
    ] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({ _sum: { total_amount: true }, where }),
      prisma.invoice.count({ where: { ...where, status: "PAID" } }),
      prisma.invoice.count({ where: { ...where, status: "PENDING" } }),
      prisma.invoice.count({ where: { ...where, status: "CANCELLED" } }),
      prisma.invoice.count({ where: { ...where, status: "OVERDUE" } }),
      prisma.invoice.count({ where: { ...where, status: "REFUNDED" } }),
      prisma.invoice.aggregate({ _sum: { total_amount: true }, where: { ...where, status: "PAID" } }),
      prisma.invoice.aggregate({ _sum: { total_amount: true }, where: { ...where, status: "OVERDUE" } }),
    ]);

    return {
      totalInvoices,
      totalAmount: totalAmount._sum.total_amount || 0,
      paidInvoices,
      pendingInvoices,
      cancelledInvoices,
      overdueInvoices,
      refundedInvoices,
      totalPaidAmount: totalPaidAmount._sum.total_amount || 0,
      totalOverdueAmount: totalOverdueAmount._sum.total_amount || 0,
    };
  } catch (error) {
    console.error("Error in getInvoiceStats:", error);
    throw error;
  }
};