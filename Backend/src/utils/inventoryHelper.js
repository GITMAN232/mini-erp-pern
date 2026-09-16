/**
 * Unified Inventory Calculation Helper
 * Available stock = physical_quantity - reserved_quantity [- damaged_quantity]
 */
function calculateAvailableQuantity(physicalQuantity, reservedQuantity, damagedQuantity = 0) {
  const physical = Number(physicalQuantity) || 0;
  const reserved = Number(reservedQuantity) || 0;
  const damaged = Number(damagedQuantity) || 0;
  return physical - reserved - damaged;
}

module.exports = {
  calculateAvailableQuantity
};
