const db = require('../db');
const { generateDocumentNumber } = require('../utils/documentNumber');
const { calculateAvailableQuantity } = require('../utils/inventoryHelper');

/**
 * List all Sales Orders
 */
async function getSalesOrders(req, res, next) {
  try {
    const query = `
      SELECT 
        so.id,
        so.order_number,
        so.order_date,
        so.total_amount,
        so.status,
        so.created_at,
        c.id as customer_id,
        c.company_name,
        c.contact_person,
        q.id as quotation_id,
        q.quotation_number,
        u.name as created_by_name,
        d.id as dispatch_id,
        d.dispatch_number,
        d.dispatch_date,
        d.vehicle_number,
        d.driver_name,
        COUNT(soi.id)::int as item_count
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      JOIN quotations q ON q.id = so.quotation_id
      LEFT JOIN users u ON u.id = so.created_by
      LEFT JOIN dispatches d ON d.sales_order_id = so.id
      LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
      GROUP BY so.id, c.id, q.id, u.name, d.id
      ORDER BY so.id DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

/**
 * Get Sales Order detail with items and live inventory availability
 */
async function getSalesOrderById(req, res, next) {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        so.id,
        so.order_number,
        so.order_date,
        so.total_amount,
        so.status,
        so.created_at,
        c.id as customer_id,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        q.id as quotation_id,
        q.quotation_number,
        u.name as created_by_name,
        d.id as dispatch_id,
        d.dispatch_number,
        d.dispatch_date,
        d.vehicle_number,
        d.driver_name
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      JOIN quotations q ON q.id = so.quotation_id
      LEFT JOIN users u ON u.id = so.created_by
      LEFT JOIN dispatches d ON d.sales_order_id = so.id
      WHERE so.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Sales Order not found' });
    }

    const itemsQuery = `
      SELECT 
        soi.id,
        soi.product_id,
        soi.quantity,
        soi.unit_price,
        soi.line_amount,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        i.physical_quantity,
        i.reserved_quantity
      FROM sales_order_items soi
      JOIN products p ON p.id = soi.product_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE soi.sales_order_id = $1
      ORDER BY soi.id ASC
    `;
    const itemsRes = await db.query(itemsQuery, [id]);

    const itemsWithAvailability = itemsRes.rows.map(item => {
      const avail = calculateAvailableQuantity(item.physical_quantity, item.reserved_quantity);
      return {
        ...item,
        available_quantity: avail,
        has_sufficient_stock: avail >= item.quantity
      };
    });

    res.json({
      ...result.rows[0],
      items: itemsWithAvailability
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Convert an ACCEPTED quotation into a Sales Order
 * Accessible by SALES and ADMIN
 */
async function convertQuotationToSalesOrder(req, res, next) {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Lock the quotation row for conversion check
    const quotationRes = await client.query(
      'SELECT * FROM quotations WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (quotationRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Quotation not found' });
    }

    const quotation = quotationRes.rows[0];

    // Rule 1, 2, 3: Only ACCEPTED quotations can create Sales Orders
    if (quotation.status !== 'ACCEPTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Only ACCEPTED quotations can be converted into Sales Orders. Current status is ${quotation.status}`
      });
    }

    // Rule 4 & 5: One quotation can generate only one Sales Order
    const existingOrderRes = await client.query(
      'SELECT id, order_number FROM sales_orders WHERE quotation_id = $1',
      [id]
    );
    if (existingOrderRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: `A Sales Order (${existingOrderRes.rows[0].order_number}) already exists for this quotation`
      });
    }

    // 2. Fetch quotation items
    const quotationItemsRes = await client.query(
      'SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id ASC',
      [id]
    );
    if (quotationItemsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Quotation contains no items' });
    }

    // 3. Generate Sales Order number
    const orderNumber = await generateDocumentNumber(client, 'sales_orders', 'SO');

    // 4. Create Sales Order header
    const insertOrderQuery = `
      INSERT INTO sales_orders (
        order_number, customer_id, quotation_id, order_date, total_amount, status, created_by
      )
      VALUES ($1, $2, $3, CURRENT_DATE, $4, 'PENDING', $5)
      RETURNING *
    `;
    const orderRes = await client.query(insertOrderQuery, [
      orderNumber,
      quotation.customer_id,
      quotation.id,
      quotation.grand_total,
      req.user.id
    ]);
    const newOrder = orderRes.rows[0];

    // 5. Copy quotation items into sales_order_items
    const insertOrderItemQuery = `
      INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_amount)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const createdItems = [];
    for (const item of quotationItemsRes.rows) {
      const itemRes = await client.query(insertOrderItemQuery, [
        newOrder.id,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.line_amount
      ]);
      createdItems.push(itemRes.rows[0]);
    }

    // 6. Update enquiry status to WON
    await client.query(
      'UPDATE enquiries SET status = $1 WHERE id = $2',
      ['WON', quotation.enquiry_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Quotation successfully converted to Sales Order',
      order: {
        ...newOrder,
        items: createdItems
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/**
 * Confirm Sales Order & Reserve Inventory
 * STRICTLY ADMIN ONLY
 * Transaction with row-level locking (SELECT ... FOR UPDATE)
 */
async function confirmSalesOrder(req, res, next) {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Lock Sales Order row
    const orderRes = await client.query(
      'SELECT * FROM sales_orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Sales Order not found' });
    }

    const order = orderRes.rows[0];

    if (order.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Only PENDING orders can be confirmed. Current status is ${order.status}`
      });
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      `SELECT soi.*, p.product_code, p.product_name 
       FROM sales_order_items soi
       JOIN products p ON p.id = soi.product_id
       WHERE soi.sales_order_id = $1
       ORDER BY soi.id ASC`,
      [id]
    );
    const items = itemsRes.rows;

    if (items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Sales Order has no items' });
    }

    // 3. Lock each relevant inventory row using SELECT ... FOR UPDATE in consistent order to prevent deadlocks
    const sortedProductIds = [...new Set(items.map(it => it.product_id))].sort((a, b) => a - b);
    const inventoryMap = new Map();

    for (const prodId of sortedProductIds) {
      const invRes = await client.query(
        'SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE',
        [prodId]
      );
      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Inventory record not found for product ID ${prodId}` });
      }
      inventoryMap.set(prodId, invRes.rows[0]);
    }

    // 4. Verify stock sufficiency across all items
    for (const item of items) {
      const inv = inventoryMap.get(item.product_id);
      const available = calculateAvailableQuantity(inv.physical_quantity, inv.reserved_quantity);

      if (available < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Insufficient inventory for ${item.product_name} (${item.product_code}): required ${item.quantity}, available ${available}`
        });
      }
    }

    // 5. If all items have sufficient stock, reserve inventory
    for (const item of items) {
      await client.query(
        `UPDATE inventory 
         SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() 
         WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // 6. Update order status to CONFIRMED
    const updatedOrderRes = await client.query(
      "UPDATE sales_orders SET status = 'CONFIRMED' WHERE id = $1 RETURNING *",
      [id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Sales order confirmed and inventory reserved successfully',
      order: updatedOrderRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/**
 * Dispatch Confirmed Sales Order
 * STRICTLY ADMIN ONLY
 * Transaction updating physical & reserved quantities, creating dispatch record
 */
async function dispatchSalesOrder(req, res, next) {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { vehicle_number, driver_name } = req.body;

    if (!vehicle_number || !driver_name) {
      return res.status(400).json({ message: 'Vehicle number and driver name are required for dispatch' });
    }

    await client.query('BEGIN');

    // 1. Lock Sales Order row
    const orderRes = await client.query(
      'SELECT * FROM sales_orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Sales Order not found' });
    }

    const order = orderRes.rows[0];

    // Prevent dispatch of non-confirmed order
    if (order.status !== 'CONFIRMED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Only CONFIRMED orders can be dispatched. Current status is ${order.status}`
      });
    }

    // Prevent duplicate dispatch
    const existingDispatchRes = await client.query(
      'SELECT id, dispatch_number FROM dispatches WHERE sales_order_id = $1',
      [id]
    );
    if (existingDispatchRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: `Sales order has already been dispatched under number ${existingDispatchRes.rows[0].dispatch_number}`
      });
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      'SELECT * FROM sales_order_items WHERE sales_order_id = $1 ORDER BY id ASC',
      [id]
    );
    const items = itemsRes.rows;

    // 3. Lock inventory rows in sorted order
    const sortedProductIds = [...new Set(items.map(it => it.product_id))].sort((a, b) => a - b);
    for (const prodId of sortedProductIds) {
      await client.query(
        'SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE',
        [prodId]
      );
    }

    // 4. Update inventory: physical_quantity decreases, reserved_quantity decreases
    for (const item of items) {
      await client.query(
        `UPDATE inventory 
         SET physical_quantity = physical_quantity - $1,
             reserved_quantity = reserved_quantity - $1,
             updated_at = NOW() 
         WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // 5. Generate dispatch number
    const dispatchNumber = await generateDocumentNumber(client, 'dispatches', 'DSP');

    // 6. Insert dispatch record
    const insertDispatchQuery = `
      INSERT INTO dispatches (dispatch_number, sales_order_id, vehicle_number, driver_name, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const dispatchRes = await client.query(insertDispatchQuery, [
      dispatchNumber,
      order.id,
      vehicle_number.trim(),
      driver_name.trim(),
      req.user.id
    ]);
    const dispatchRecord = dispatchRes.rows[0];

    // 7. Mark order as DISPATCHED
    const updatedOrderRes = await client.query(
      "UPDATE sales_orders SET status = 'DISPATCHED' WHERE id = $1 RETURNING *",
      [id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Sales Order dispatched successfully',
      dispatch: dispatchRecord,
      order: updatedOrderRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  getSalesOrders,
  getSalesOrderById,
  convertQuotationToSalesOrder,
  confirmSalesOrder,
  dispatchSalesOrder
};
