import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function SalesOrdersPage({ user, selectedOrderId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected Order Detail Modal
  const [activeOrder, setActiveOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Dispatch Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSalesOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      handleViewDetails(selectedOrderId);
    }
  }, [selectedOrderId]);

  const loadSalesOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getSalesOrders();
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (orderId) => {
    try {
      setError('');
      const detail = await api.getSalesOrderById(orderId);
      setActiveOrder(detail);
      setShowDetailModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConfirmOrder = async (orderId) => {
    try {
      setError('');
      setSuccess('');
      setActionLoading(true);
      const res = await api.confirmSalesOrder(orderId);
      setSuccess(`Order ${res.order.order_number} confirmed! Inventory reserved in transaction.`);
      // Refresh modal and list
      await handleViewDetails(orderId);
      await loadSalesOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispatchModal = () => {
    setVehicleNumber('');
    setDriverName('');
    setShowDispatchModal(true);
  };

  const handleDispatchOrder = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      setActionLoading(true);
      const res = await api.dispatchSalesOrder(activeOrder.id, {
        vehicle_number: vehicleNumber,
        driver_name: driverName
      });
      setShowDispatchModal(false);
      setSuccess(`Order dispatched under Dispatch #${res.dispatch.dispatch_number}! Inventory updated.`);
      await handleViewDetails(activeOrder.id);
      await loadSalesOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders & Fulfillment</h1>
          <p className="page-subtitle">
            Step 4, 5 & 6: Order confirmation, transactional inventory reservation, and dispatch
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Quotation Ref</th>
                <th>Customer</th>
                <th>Order Date</th>
                <th>Total Amount</th>
                <th>Items</th>
                <th>Status</th>
                <th>Dispatch Details</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading sales orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No sales orders created yet. Convert an ACCEPTED quotation to create an order.
                  </td>
                </tr>
              ) : (
                orders.map((so) => (
                  <tr key={so.id}>
                    <td><strong>{so.order_number}</strong></td>
                    <td>{so.quotation_number}</td>
                    <td>{so.company_name}</td>
                    <td>{new Date(so.order_date).toLocaleDateString()}</td>
                    <td>
                      <strong>
                        ₹{Number(so.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td>{so.item_count} items</td>
                    <td>
                      <span className={`status-pill status-${so.status.toLowerCase()}`}>
                        {so.status}
                      </span>
                    </td>
                    <td>
                      {so.dispatch_number ? (
                        <div style={{ fontSize: '0.75rem' }}>
                          <strong>{so.dispatch_number}</strong>
                          <div>Veh: {so.vehicle_number}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not dispatched</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewDetails(so.id)}
                      >
                        View & Actions ➔
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ORDER DETAILS & INVENTORY RESERVATION */}
      {showDetailModal && activeOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Sales Order: {activeOrder.order_number}</h3>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  Ref Quotation: {activeOrder.quotation_number} | Customer: {activeOrder.company_name} ({activeOrder.city})
                </span>
              </div>
              <button className="btn-close" onClick={() => setShowDetailModal(false)}>×</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Current Order Status: </span>
                <span className={`status-pill status-${activeOrder.status.toLowerCase()}`}>
                  {activeOrder.status}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Amount: </span>
                <strong style={{ fontSize: '1.1rem', color: '#15803d' }}>
                  ₹{Number(activeOrder.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            {/* ORDER ITEMS & LIVE INVENTORY AVAILABILITY */}
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#334155' }}>
              Order Items & Inventory Stock Availability
            </h4>

            <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '1.25rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered Qty</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                    <th>Physical Stock</th>
                    <th>Reserved Stock</th>
                    <th>Available Stock</th>
                    <th>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrder.items?.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.product_code}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.product_name}</div>
                      </td>
                      <td><strong>{item.quantity} {item.unit}</strong></td>
                      <td>₹{Number(item.unit_price).toFixed(2)}</td>
                      <td>₹{Number(item.line_amount).toFixed(2)}</td>
                      <td>{item.physical_quantity}</td>
                      <td>{item.reserved_quantity}</td>
                      <td>
                        <strong>{item.available_quantity}</strong>
                      </td>
                      <td>
                        {item.has_sufficient_stock ? (
                          <span className="stock-ok">✓ Available</span>
                        ) : (
                          <span className="stock-short">✕ Short Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* DISPATCH DETAILS IF DISPATCHED */}
            {activeOrder.status === 'DISPATCHED' && activeOrder.dispatch_number && (
              <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                <h5 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>✓ Dispatched Document</h5>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Dispatch #:</strong> {activeOrder.dispatch_number} &nbsp;|&nbsp;
                  <strong>Vehicle #:</strong> {activeOrder.vehicle_number} &nbsp;|&nbsp;
                  <strong>Driver:</strong> {activeOrder.driver_name} &nbsp;|&nbsp;
                  <strong>Date:</strong> {new Date(activeOrder.dispatch_date).toLocaleString()}
                </div>
              </div>
            )}

            {/* WORKFLOW ACTIONS */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border)'
            }}>
              <div>
                {!isAdmin && (
                  <span style={{ fontSize: '0.8rem', color: '#b45309' }}>
                    🔒 Admin role required to Confirm (Reserve Stock) and Dispatch orders.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>

                {/* ADMIN ONLY: CONFIRM ORDER */}
                {isAdmin && activeOrder.status === 'PENDING' && (
                  <button
                    id="btn-confirm-order"
                    type="button"
                    className="btn btn-primary"
                    disabled={actionLoading}
                    onClick={() => handleConfirmOrder(activeOrder.id)}
                  >
                    {actionLoading ? 'Reserving...' : '🔒 Confirm Order (Reserve Stock)'}
                  </button>
                )}

                {/* ADMIN ONLY: DISPATCH ORDER */}
                {isAdmin && activeOrder.status === 'CONFIRMED' && (
                  <button
                    id="btn-open-dispatch"
                    type="button"
                    className="btn btn-success"
                    disabled={actionLoading}
                    onClick={handleOpenDispatchModal}
                  >
                    🚚 Dispatch Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISPATCH CONFIRMATION */}
      {showDispatchModal && activeOrder && (
        <div className="modal-overlay" style={{ zIndex: 110 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">🚚 Dispatch Sales Order: {activeOrder.order_number}</h3>
              <button className="btn-close" onClick={() => setShowDispatchModal(false)}>×</button>
            </div>

            <form onSubmit={handleDispatchOrder}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Dispatch will atomically decrease physical inventory and release reserved inventory in a PostgreSQL transaction.
              </p>

              <div className="form-group">
                <label className="form-label">Vehicle Registration Number *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. MH-12-AB-4567"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Driver Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ramesh Jadhav"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDispatchModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Confirm Dispatch & Release Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
