/**
 * Quotation & Financial Calculation Utility
 * Strictly calculated and validated on the backend.
 */

function roundToTwo(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates financial amounts for an individual quotation line item
 */
function calculateLineItem(quantity, unitPrice, discountPct = 0, gstPct = 0) {
  const qty = Number(quantity);
  const price = Number(unitPrice);
  const discPct = Number(discountPct) || 0;
  const taxPct = Number(gstPct) || 0;

  if (qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (price < 0) {
    throw new Error('Unit price cannot be negative');
  }
  if (discPct < 0 || discPct > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }
  if (taxPct < 0 || taxPct > 100) {
    throw new Error('GST percentage must be between 0 and 100');
  }

  const baseAmount = roundToTwo(qty * price);
  const discountAmount = roundToTwo(baseAmount * (discPct / 100));
  const taxableAmount = roundToTwo(baseAmount - discountAmount);
  const gstAmount = roundToTwo(taxableAmount * (taxPct / 100));
  const lineAmount = roundToTwo(taxableAmount + gstAmount);

  return {
    quantity: qty,
    unit_price: price,
    discount_pct: discPct,
    gst_pct: taxPct,
    base_amount: baseAmount,
    discount_amount: discountAmount,
    taxable_amount: taxableAmount,
    gst_amount: gstAmount,
    line_amount: lineAmount
  };
}

/**
 * Calculates entire quotation totals from an array of item specifications
 */
function calculateQuotationTotals(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Quotation must contain at least one item');
  }

  let subtotal = 0;
  let totalDiscount = 0;
  let totalGst = 0;
  let grandTotal = 0;

  const calculatedItems = items.map(item => {
    const calc = calculateLineItem(
      item.quantity,
      item.unit_price,
      item.discount_pct,
      item.gst_pct
    );
    subtotal = roundToTwo(subtotal + calc.base_amount);
    totalDiscount = roundToTwo(totalDiscount + calc.discount_amount);
    totalGst = roundToTwo(totalGst + calc.gst_amount);
    grandTotal = roundToTwo(grandTotal + calc.line_amount);

    return {
      ...item,
      ...calc
    };
  });

  return {
    items: calculatedItems,
    subtotal,
    discount_amount: totalDiscount,
    gst_amount: totalGst,
    grand_total: grandTotal
  };
}

module.exports = {
  roundToTwo,
  calculateLineItem,
  calculateQuotationTotals
};
