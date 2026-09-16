const db = require('../db');

async function getCustomers(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id, company_name, contact_person, mobile, email, city, created_at FROM customers ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const { company_name, contact_person, mobile, email, city } = req.body;

    if (!company_name || !contact_person || !mobile || !email || !city) {
      return res.status(400).json({ message: 'All customer fields are required' });
    }

    const query = `
      INSERT INTO customers (company_name, contact_person, mobile, email, city)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(query, [
      company_name.trim(),
      contact_person.trim(),
      mobile.trim(),
      email.trim().toLowerCase(),
      city.trim()
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCustomers,
  createCustomer
};
