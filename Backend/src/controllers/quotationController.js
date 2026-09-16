const db = require('../db');
const { generateDocumentNumber } = require('../utils/documentNumber');
const { calculateQuotationTotals } = require('../utils/calculations');

async function getQuotations(req, res, next) {
  try {
    const query = `
      SELECT 
        q.id,
        q.quotation_number,
        q.enquiry_id,
        q.customer_id,
        q.valid_until,
        q.status,
        q.subtotal,
        q.discount_amount,
        q.gst_amount,
        q.grand_total,
        q.created_at,
        c.company_name,
        c.contact_person,
        e.enquiry_number,
        u.name as created_by_name,
        so.id as sales_order_id,
        so.order_number as sales_order_number
      FROM quotations q
      JOIN customers c ON c.id = q.customer_id
      JOIN enquiries e ON e.id = q.enquiry_id
      LEFT JOIN users u ON u.id = q.created_by
      LEFT JOIN sales_orders so ON so.quotation_id = q.id
      ORDER BY q.id DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getQuotationById(req, res, next) {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        q.id,
        q.quotation_number,
        q.enquiry_id,
        q.customer_id,
        q.valid_until,
        q.status,
        q.subtotal,
        q.discount_amount,
        q.gst_amount,
        q.grand_total,
        q.created_at,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        e.enquiry_number,
        u.name as created_by_name,
        so.id as sales_order_id,
        so.order_number as sales_order_number
      FROM quotations q
      JOIN customers c ON c.id = q.customer_id
      JOIN enquiries e ON e.id = q.enquiry_id
      LEFT JOIN users u ON u.id = q.created_by
      LEFT JOIN sales_orders so ON so.quotation_id = q.id
      WHERE q.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    const itemsQuery = `
      SELECT 
        qi.id,
        qi.product_id,
        qi.quantity,
        qi.unit_price,
        qi.discount_pct,
        qi.gst_pct,
        qi.line_amount,
        p.product_code,
        p.product_name,
        p.category,
        p.unit
      FROM quotation_items qi
      JOIN products p ON p.id = qi.product_id
      WHERE qi.quotation_id = $1
      ORDER BY qi.id ASC
    `;
    const itemsRes = await db.query(itemsQuery, [id]);

    res.json({
      ...result.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Preview endpoint for calculation without persisting
 */
async function calculatePreview(req, res, next) {
  try {
    const { items } = req.body;
    const totals = calculateQuotationTotals(items);
    res.json(totals);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function createQuotation(req, res, next) {
  const client = await db.getClient();
  try {
    const { enquiry_id, valid_until, items } = req.body;

    if (!enquiry_id || !valid_until) {
      return res.status(400).json({ message: 'Enquiry reference and valid until date are required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Quotation must have at least one product item' });
    }

    await client.query('BEGIN');

    // 1. Verify enquiry exists
    const enquiryRes = await client.query(
      'SELECT id, customer_id, status FROM enquiries WHERE id = $1',
      [enquiry_id]
    );
    if (enquiryRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Referenced enquiry not found' });
    }
    const enquiry = enquiryRes.rows[0];

    // 2. Verify products exist
    for (const it of items) {
      const pRes = await client.query('SELECT id FROM products WHERE id = $1', [it.product_id]);
      if (pRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product with ID ${it.product_id} not found` });
      }
    }

    // 3. Backend strictly calculates all lines and totals
    let calculatedTotals;
    try {
      calculatedTotals = calculateQuotationTotals(items);
    } catch (calcErr) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: calcErr.message });
    }

    // 4. Generate unique quotation number
    const quotationNumber = await generateDocumentNumber(client, 'quotations', 'QT');

    // 5. Insert quotation header
    const insertQuotationQuery = `
      INSERT INTO quotations (
        quotation_number, enquiry_id, customer_id, valid_until, status,
        subtotal, discount_amount, gst_amount, grand_total, created_by
      )
      VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const quotationRes = await client.query(insertQuotationQuery, [
      quotationNumber,
      enquiry.id,
      enquiry.customer_id,
      valid_until,
      calculatedTotals.subtotal,
      calculatedTotals.discount_amount,
      calculatedTotals.gst_amount,
      calculatedTotals.grand_total,
      req.user.id
    ]);
    const newQuotation = quotationRes.rows[0];

    // 6. Insert quotation line items
    const insertItemQuery = `
      INSERT INTO quotation_items (
        quotation_id, product_id, quantity, unit_price, discount_pct, gst_pct, line_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const createdItems = [];
    for (const item of calculatedTotals.items) {
      const itemRes = await client.query(insertItemQuery, [
        newQuotation.id,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.discount_pct,
        item.gst_pct,
        item.line_amount
      ]);
      createdItems.push(itemRes.rows[0]);
    }

    // 7. Update enquiry status to QUOTED if currently NEW
    if (enquiry.status === 'NEW') {
      await client.query('UPDATE enquiries SET status = $1 WHERE id = $2', ['QUOTED', enquiry.id]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...newQuotation,
      items: createdItems
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`
      });
    }

    const currentRes = await db.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Check if quotation is already converted into sales order
    const orderRes = await db.query('SELECT id FROM sales_orders WHERE quotation_id = $1', [id]);
    if (orderRes.rows.length > 0 && status !== 'ACCEPTED') {
      return res.status(400).json({
        message: 'Cannot change status of a quotation that has already been converted into a Sales Order'
      });
    }

    const updateRes = await db.query(
      'UPDATE quotations SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQuotations,
  getQuotationById,
  calculatePreview,
  createQuotation,
  updateStatus
};
