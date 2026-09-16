const db = require('../db');
const { generateDocumentNumber } = require('../utils/documentNumber');

async function getEnquiries(req, res, next) {
  try {
    const query = `
      SELECT 
        e.id,
        e.enquiry_number,
        e.enquiry_date,
        e.required_date,
        e.notes,
        e.status,
        e.created_at,
        c.id as customer_id,
        c.company_name,
        c.contact_person,
        c.email as customer_email,
        c.mobile as customer_mobile,
        c.city as customer_city,
        u.name as created_by_name,
        COUNT(ei.id)::int as total_items
      FROM enquiries e
      JOIN customers c ON c.id = e.customer_id
      LEFT JOIN users u ON u.id = e.created_by
      LEFT JOIN enquiry_items ei ON ei.enquiry_id = e.id
      GROUP BY e.id, c.id, u.name
      ORDER BY e.id DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getEnquiryById(req, res, next) {
  try {
    const { id } = req.params;

    const enquiryQuery = `
      SELECT 
        e.id,
        e.enquiry_number,
        e.enquiry_date,
        e.required_date,
        e.notes,
        e.status,
        e.created_at,
        c.id as customer_id,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        u.name as created_by_name
      FROM enquiries e
      JOIN customers c ON c.id = e.customer_id
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.id = $1
    `;
    const enquiryRes = await db.query(enquiryQuery, [id]);
    if (enquiryRes.rows.length === 0) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const itemsQuery = `
      SELECT 
        ei.id,
        ei.product_id,
        ei.quantity,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price
      FROM enquiry_items ei
      JOIN products p ON p.id = ei.product_id
      WHERE ei.enquiry_id = $1
      ORDER BY ei.id ASC
    `;
    const itemsRes = await db.query(itemsQuery, [id]);

    res.json({
      ...enquiryRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    next(err);
  }
}

async function createEnquiry(req, res, next) {
  const client = await db.getClient();
  try {
    const { customer_id, required_date, notes, items } = req.body;

    if (!customer_id || !required_date) {
      return res.status(400).json({ message: 'Customer and required date are mandatory' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Enquiry must contain at least one product item' });
    }

    for (const item of items) {
      if (!item.product_id || Number(item.quantity) <= 0) {
        return res.status(400).json({ message: 'Each item must have a valid product and quantity greater than zero' });
      }
    }

    await client.query('BEGIN');

    // Verify customer exists
    const customerRes = await client.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (customerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Verify all products exist
    for (const item of items) {
      const prodRes = await client.query('SELECT id FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product ID ${item.product_id} not found` });
      }
    }

    const enquiryNumber = await generateDocumentNumber(client, 'enquiries', 'ENQ');

    const insertEnquiryQuery = `
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, notes, status, created_by)
      VALUES ($1, $2, $3, $4, 'NEW', $5)
      RETURNING *
    `;
    const enquiryRes = await client.query(insertEnquiryQuery, [
      enquiryNumber,
      customer_id,
      required_date,
      notes || '',
      req.user.id
    ]);
    const newEnquiry = enquiryRes.rows[0];

    const insertItemQuery = `
      INSERT INTO enquiry_items (enquiry_id, product_id, quantity)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const createdItems = [];
    for (const item of items) {
      const itemRes = await client.query(insertItemQuery, [
        newEnquiry.id,
        item.product_id,
        Number(item.quantity)
      ]);
      createdItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...newEnquiry,
      items: createdItems
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  getEnquiries,
  getEnquiryById,
  createEnquiry
};
