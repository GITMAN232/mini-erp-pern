const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server');
const db = require('../src/db');
const { calculateQuotationTotals, calculateLineItem } = require('../src/utils/calculations');

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;
let adminToken = '';
let salesToken = '';

test.before(async () => {
  // Start server on test port
  await new Promise(resolve => {
    server = app.listen(TEST_PORT, resolve);
  });

  // Authenticate Admin
  const adminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@erp.com', password: 'Admin@123' })
  });
  const adminData = await adminRes.json();
  adminToken = adminData.token;

  // Authenticate Sales
  const salesRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sales@erp.com', password: 'Sales@123' })
  });
  const salesData = await salesRes.json();
  salesToken = salesData.token;
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await db.pool.end();
});

// ====================================================================
// TEST 1: Quotation total is calculated correctly
// ====================================================================
test('Test 1: Backend strictly calculates quotation totals, discounts, and GST correctly', async () => {
  // Line 1: 10 units @ 1000, 10% discount, 18% GST
  // Base: 10,000; Discount: 1,000; Taxable: 9,000; GST: 1,620; Line: 10,620
  const line1 = calculateLineItem(10, 1000, 10, 18);
  assert.equal(line1.base_amount, 10000);
  assert.equal(line1.discount_amount, 1000);
  assert.equal(line1.taxable_amount, 9000);
  assert.equal(line1.gst_amount, 1620);
  assert.equal(line1.line_amount, 10620);

  // Line 2: 5 units @ 2000, 5% discount, 12% GST
  // Base: 10,000; Discount: 500; Taxable: 9,500; GST: 1,140; Line: 10,640
  const line2 = calculateLineItem(5, 2000, 5, 12);
  assert.equal(line2.base_amount, 10000);
  assert.equal(line2.discount_amount, 500);
  assert.equal(line2.taxable_amount, 9500);
  assert.equal(line2.gst_amount, 1140);
  assert.equal(line2.line_amount, 10640);

  // Totals
  const totals = calculateQuotationTotals([
    { quantity: 10, unit_price: 1000, discount_pct: 10, gst_pct: 18 },
    { quantity: 5, unit_price: 2000, discount_pct: 5, gst_pct: 12 }
  ]);
  assert.equal(totals.subtotal, 20000);
  assert.equal(totals.discount_amount, 1500);
  assert.equal(totals.gst_amount, 2760);
  assert.equal(totals.grand_total, 21260);

  // Also verify via API calculation preview endpoint
  const apiRes = await fetch(`${BASE_URL}/quotations/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      items: [
        { quantity: 10, unit_price: 1000, discount_pct: 10, gst_pct: 18 },
        { quantity: 5, unit_price: 2000, discount_pct: 5, gst_pct: 12 }
      ]
    })
  });
  assert.equal(apiRes.status, 200);
  const apiData = await apiRes.json();
  assert.equal(apiData.grand_total, 21260);
  assert.equal(apiData.items[0].line_amount, 10620);
});

// ====================================================================
// TEST 2: DRAFT or REJECTED quotation cannot create Sales Order
// ====================================================================
test('Test 2: DRAFT or REJECTED quotation cannot create Sales Order', async () => {
  // 1. Get a customer and a product
  const custRes = await fetch(`${BASE_URL}/customers`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const customers = await custRes.json();
  const customerId = customers[0].id;

  const prodRes = await fetch(`${BASE_URL}/products`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const products = await prodRes.json();
  const productId = products[0].id;

  // 2. Create Enquiry
  const enqRes = await fetch(`${BASE_URL}/enquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      customer_id: customerId,
      required_date: '2026-10-15',
      notes: 'Test Enquiry for validation rules',
      items: [{ product_id: productId, quantity: 2 }]
    })
  });
  assert.equal(enqRes.status, 201);
  const enquiry = await enqRes.json();

  // 3. Create Quotation (starts in DRAFT status)
  const quotRes = await fetch(`${BASE_URL}/quotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      enquiry_id: enquiry.id,
      valid_until: '2026-11-01',
      items: [{ product_id: productId, quantity: 2, unit_price: 1200, discount_pct: 5, gst_pct: 18 }]
    })
  });
  assert.equal(quotRes.status, 201);
  const quotation = await quotRes.json();
  assert.equal(quotation.status, 'DRAFT');

  // 4. Attempt to convert DRAFT quotation -> MUST FAIL WITH 400
  const draftConvertRes = await fetch(`${BASE_URL}/quotations/${quotation.id}/convert`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  assert.equal(draftConvertRes.status, 400);
  const draftConvertData = await draftConvertRes.json();
  assert.match(draftConvertData.message, /Only ACCEPTED quotations/i);

  // 5. Update status to REJECTED
  const rejectRes = await fetch(`${BASE_URL}/quotations/${quotation.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({ status: 'REJECTED' })
  });
  assert.equal(rejectRes.status, 200);

  // 6. Attempt to convert REJECTED quotation -> MUST FAIL WITH 400
  const rejectConvertRes = await fetch(`${BASE_URL}/quotations/${quotation.id}/convert`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  assert.equal(rejectConvertRes.status, 400);
  const rejectConvertData = await rejectConvertRes.json();
  assert.match(rejectConvertData.message, /Only ACCEPTED quotations/i);
});

// ====================================================================
// TEST 3: Same quotation cannot create duplicate Sales Orders
// ====================================================================
test('Test 3: Same quotation cannot create duplicate Sales Orders', async () => {
  const custRes = await fetch(`${BASE_URL}/customers`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const customers = await custRes.json();
  const customerId = customers[0].id;

  const prodRes = await fetch(`${BASE_URL}/products`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const products = await prodRes.json();
  const productId = products[0].id;

  // Create Enquiry
  const enqRes = await fetch(`${BASE_URL}/enquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      customer_id: customerId,
      required_date: '2026-10-20',
      notes: 'Test duplicate conversion',
      items: [{ product_id: productId, quantity: 5 }]
    })
  });
  const enquiry = await enqRes.json();

  // Create Quotation
  const quotRes = await fetch(`${BASE_URL}/quotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      enquiry_id: enquiry.id,
      valid_until: '2026-11-15',
      items: [{ product_id: productId, quantity: 5, unit_price: 1500, discount_pct: 0, gst_pct: 18 }]
    })
  });
  const quotation = await quotRes.json();

  // Mark Quotation as ACCEPTED
  await fetch(`${BASE_URL}/quotations/${quotation.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({ status: 'ACCEPTED' })
  });

  // First conversion -> MUST SUCCEED (201)
  const firstConvertRes = await fetch(`${BASE_URL}/quotations/${quotation.id}/convert`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  assert.equal(firstConvertRes.status, 201);
  const firstOrderData = await firstConvertRes.json();
  assert.ok(firstOrderData.order.id);

  // Second conversion of the same quotation -> MUST FAIL WITH 409
  const secondConvertRes = await fetch(`${BASE_URL}/quotations/${quotation.id}/convert`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  assert.equal(secondConvertRes.status, 409);
  const secondOrderData = await secondConvertRes.json();
  assert.match(secondOrderData.message, /already exists/i);
});

// ====================================================================
// TEST 4: Cannot reserve more than available inventory
// ====================================================================
test('Test 4: Cannot reserve more than available inventory', async () => {
  const custRes = await fetch(`${BASE_URL}/customers`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const customers = await custRes.json();
  const customerId = customers[0].id;

  // Find a product and check its current available stock
  const invRes = await fetch(`${BASE_URL}/inventory`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const inventoryList = await invRes.json();
  const itemStock = inventoryList[0];
  const excessQuantity = itemStock.physical_quantity + 5000; // Intentionally exceeds available stock

  // Create Enquiry requesting excess quantity
  const enqRes = await fetch(`${BASE_URL}/enquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      customer_id: customerId,
      required_date: '2026-11-01',
      notes: 'Test excess quantity',
      items: [{ product_id: itemStock.product_id, quantity: excessQuantity }]
    })
  });
  const enquiry = await enqRes.json();

  // Create Quotation
  const quotRes = await fetch(`${BASE_URL}/quotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      enquiry_id: enquiry.id,
      valid_until: '2026-11-30',
      items: [{ product_id: itemStock.product_id, quantity: excessQuantity, unit_price: 1000, discount_pct: 0, gst_pct: 18 }]
    })
  });
  const quotation = await quotRes.json();

  // Accept Quotation
  await fetch(`${BASE_URL}/quotations/${quotation.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({ status: 'ACCEPTED' })
  });

  // Convert to Sales Order
  const orderRes = await fetch(`${BASE_URL}/quotations/${quotation.id}/convert`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const orderData = await orderRes.json();
  const orderId = orderData.order.id;

  // Record reserved quantity before attempt
  const beforeInvRes = await fetch(`${BASE_URL}/inventory`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const beforeList = await beforeInvRes.json();
  const beforeStock = beforeList.find(i => i.product_id === itemStock.product_id);

  // ADMIN attempts to confirm order (triggering inventory reservation) -> MUST FAIL (400)
  const confirmRes = await fetch(`${BASE_URL}/sales-orders/${orderId}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.equal(confirmRes.status, 400);
  const confirmData = await confirmRes.json();
  assert.match(confirmData.message, /Insufficient inventory/i);

  // Verify inventory reserved quantity was NOT changed (transaction rolled back)
  const afterInvRes = await fetch(`${BASE_URL}/inventory`, {
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  const afterList = await afterInvRes.json();
  const afterStock = afterList.find(i => i.product_id === itemStock.product_id);

  assert.equal(afterStock.reserved_quantity, beforeStock.reserved_quantity);
});

// ====================================================================
// TEST 5: Unauthorized user cannot perform a restricted operation
// ====================================================================
test('Test 5: Unauthorized user (SALES role) cannot perform restricted operations', async () => {
  // Sales user attempts to create product -> MUST BE FORBIDDEN (403)
  const createProdRes = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({
      product_code: 'UNAUTH-01',
      product_name: 'Unauthorized Item',
      category: 'Test',
      unit: 'Pcs',
      base_price: 100
    })
  });
  assert.equal(createProdRes.status, 403);
  const createProdData = await createProdRes.json();
  assert.match(createProdData.message, /Access denied/i);

  // Sales user attempts to update physical inventory -> MUST BE FORBIDDEN (403)
  const updateInvRes = await fetch(`${BASE_URL}/inventory/1`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({ physical_quantity: 999 })
  });
  assert.equal(updateInvRes.status, 403);

  // Sales user attempts to confirm a Sales Order -> MUST BE FORBIDDEN (403)
  const confirmRes = await fetch(`${BASE_URL}/sales-orders/1/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${salesToken}` }
  });
  assert.equal(confirmRes.status, 403);

  // Sales user attempts to dispatch a Sales Order -> MUST BE FORBIDDEN (403)
  const dispatchRes = await fetch(`${BASE_URL}/sales-orders/1/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesToken}`
    },
    body: JSON.stringify({ vehicle_number: 'KA-01-AB-1234', driver_name: 'Ramesh' })
  });
  assert.equal(dispatchRes.status, 403);
});
