import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function InventoryPage({ user }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Update physical stock modal
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newPhysicalQty, setNewPhysicalQty] = useState('');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await api.getInventory();
      setInventory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUpdate = (item) => {
    setSelectedItem(item);
    setNewPhysicalQty(item.physical_quantity);
    setShowModal(true);
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      await api.updateInventory(selectedItem.product_id, Number(newPhysicalQty));
      setSuccess(`Physical stock for ${selectedItem.product_name} updated successfully`);
      setShowModal(false);
      loadInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouse Inventory Status</h1>
          <p className="page-subtitle">
            Formula: Available Stock = Physical Quantity - Reserved Quantity
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
                <th>Product Code</th>
                <th>Product Description</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Base Price</th>
                <th>Physical Stock</th>
                <th>Reserved Stock</th>
                <th>Available Stock</th>
                {isAdmin && <th>Admin Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? '9' : '8'} style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading warehouse stock...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? '9' : '8'} style={{ textAlign: 'center', padding: '2rem' }}>
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.product_code}</strong></td>
                    <td>{item.product_name}</td>
                    <td>{item.category}</td>
                    <td>{item.unit}</td>
                    <td>₹{Number(item.base_price).toFixed(2)}</td>
                    <td><strong>{item.physical_quantity}</strong></td>
                    <td style={{ color: '#b45309' }}>
                      <strong>{item.reserved_quantity}</strong>
                    </td>
                    <td>
                      <strong style={{ color: item.available_quantity > 0 ? '#15803d' : '#dc2626' }}>
                        {item.available_quantity}
                      </strong>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenUpdate(item)}
                        >
                          Adjust Physical Stock
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: UPDATE PHYSICAL STOCK */}
      {showModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Adjust Physical Stock</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleUpdateStock}>
              <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                <div><strong>Product:</strong> {selectedItem.product_name} ({selectedItem.product_code})</div>
                <div><strong>Currently Reserved:</strong> {selectedItem.reserved_quantity} {selectedItem.unit}</div>
                <small style={{ color: 'var(--text-muted)' }}>
                  Note: Physical stock cannot be set lower than currently reserved stock.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">New Physical Quantity ({selectedItem.unit}) *</label>
                <input
                  type="number"
                  className="form-control"
                  min={selectedItem.reserved_quantity}
                  value={newPhysicalQty}
                  onChange={(e) => setNewPhysicalQty(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Inventory Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
