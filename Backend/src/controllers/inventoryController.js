const db = require('../db');
const { calculateAvailableQuantity } = require('../utils/inventoryHelper');

async function getInventory(req, res, next) {
  try {
    const query = `
      SELECT 
        i.id,
        i.product_id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        i.physical_quantity,
        i.reserved_quantity,
        i.updated_at
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      ORDER BY p.id ASC
    `;
    const result = await db.query(query);

    const inventoryWithAvailable = result.rows.map(row => ({
      ...row,
      available_quantity: calculateAvailableQuantity(row.physical_quantity, row.reserved_quantity)
    }));

    res.json(inventoryWithAvailable);
  } catch (err) {
    next(err);
  }
}

async function updateInventory(req, res, next) {
  const client = await db.getClient();
  try {
    const { productId } = req.params;
    const { physical_quantity } = req.body;

    if (physical_quantity === undefined || Number(physical_quantity) < 0) {
      return res.status(400).json({ message: 'Physical quantity must be a non-negative number' });
    }

    const newPhysical = Number(physical_quantity);

    await client.query('BEGIN');

    const checkQuery = `
      SELECT * FROM inventory 
      WHERE product_id = $1 
      FOR UPDATE
    `;
    const currentRes = await client.query(checkQuery, [productId]);
    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Inventory record not found for this product' });
    }

    const currentInventory = currentRes.rows[0];

    // Business check: physical quantity cannot be set lower than currently reserved quantity
    if (newPhysical < currentInventory.reserved_quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Cannot set physical quantity (${newPhysical}) lower than reserved quantity (${currentInventory.reserved_quantity})`
      });
    }

    const updateQuery = `
      UPDATE inventory
      SET physical_quantity = $1, updated_at = NOW()
      WHERE product_id = $2
      RETURNING *
    `;
    const updatedRes = await client.query(updateQuery, [newPhysical, productId]);
    const updated = updatedRes.rows[0];

    await client.query('COMMIT');

    res.json({
      ...updated,
      available_quantity: calculateAvailableQuantity(updated.physical_quantity, updated.reserved_quantity)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  getInventory,
  updateInventory
};
