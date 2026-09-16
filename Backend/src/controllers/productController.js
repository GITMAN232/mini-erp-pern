const db = require('../db');

async function getProducts(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id, product_code, product_name, category, unit, base_price, created_at FROM products ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  const client = await db.getClient();
  try {
    const { product_code, product_name, category, unit, base_price, initial_stock = 0 } = req.body;

    if (!product_code || !product_name || !category || !unit || base_price === undefined) {
      return res.status(400).json({ message: 'Missing required product fields' });
    }

    if (Number(base_price) < 0) {
      return res.status(400).json({ message: 'Base price cannot be negative' });
    }

    if (Number(initial_stock) < 0) {
      return res.status(400).json({ message: 'Initial stock cannot be negative' });
    }

    await client.query('BEGIN');

    const insertProductQuery = `
      INSERT INTO products (product_code, product_name, category, unit, base_price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const productRes = await client.query(insertProductQuery, [
      product_code.trim(),
      product_name.trim(),
      category.trim(),
      unit.trim(),
      base_price
    ]);
    const newProduct = productRes.rows[0];

    const insertInventoryQuery = `
      INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
      VALUES ($1, $2, 0)
      RETURNING *
    `;
    await client.query(insertInventoryQuery, [newProduct.id, initial_stock]);

    await client.query('COMMIT');
    res.status(201).json(newProduct);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  getProducts,
  createProduct
};
