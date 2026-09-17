import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function QuotationsPage({ preselectedEnquiryId, onOrderCreated }) {
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState([]);
  const [calculatedPreview, setCalculatedPreview] = useState(null);

  useEffect(() => {
    loadQuotationsAndEnquiries();
  }, []);

  useEffect(() => {
    if (preselectedEnquiryId) {
      handleOpenCreateModal(preselectedEnquiryId);
    }
  }, [preselectedEnquiryId, enquiries]);

  const loadQuotationsAndEnquiries = async () => {
    try {
      setLoading(true);
      const [quotData, enqData] = await Promise.all([
        api.getQuotations(),
        api.getEnquiries()
      ]);
      setQuotations(quotData);
      setEnquiries(enqData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = async (enquiryIdToUse) => {
    const enqId = enquiryIdToUse || (enquiries.length > 0 ? enquiries[0].id : '');
    setSelectedEnquiryId(enqId);

    // Set default valid until date (14 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    setValidUntil(futureDate.toISOString().split('T')[0]);

    if (enqId) {
      await loadEnquiryItemsForQuotation(enqId);
    }
    setShowCreateModal(true);
  };

  const loadEnquiryItemsForQuotation = async (enquiryId) => {
    try {
      const enq = await api.getEnquiryById(enquiryId);
      const initialItems = enq.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: Number(item.base_price),
        discount_pct: 0,
        gst_pct: 18
      }));
      setItems(initialItems);
      triggerBackendCalculation(initialItems);
    } catch (err) {
      setError('Failed to load enquiry items: ' + err.message);
    }
  };

  const triggerBackendCalculation = async (currentItems) => {
    try {
      if (!currentItems || currentItems.length === 0) return;
      const preview = await api.calculateQuotation(currentItems);
      setCalculatedPreview(preview);
    } catch (err) {
      console.error('Calculation preview error:', err);
    }
  };

  const handleItemFieldChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = Number(value);
    setItems(updated);
    triggerBackendCalculation(updated);
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const payload = {
        enquiry_id: Number(selectedEnquiryId),
        valid_until: validUntil,
        items: items.map(it => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_pct: it.discount_pct,
          gst_pct: it.gst_pct
        }))
      };

      const created = await api.createQuotation(payload);
      setShowCreateModal(false);
      setSuccess(`Quotation ${created.quotation_number} created successfully in DRAFT status`);
      loadQuotationsAndEnquiries();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (quotationId, newStatus) => {
    try {
      setError('');
      setSuccess('');
      await api.updateQuotationStatus(quotationId, newStatus);
      setSuccess(`Quotation status updated to ${newStatus}`);
      loadQuotationsAndEnquiries();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConvertToOrder = async (quotationId) => {
    try {
      setError('');
      setSuccess('');
      const res = await api.convertQuotation(quotationId);
      setSuccess(`Quotation converted! Sales Order ${res.order.order_number} created in PENDING status`);
      loadQuotationsAndEnquiries();
      if (onOrderCreated) {
        setTimeout(() => onOrderCreated(res.order.id), 800);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Commercial Quotations</h1>
          <p className="page-subtitle">
            Step 2 & 3: Generate pricing, apply backend tax & discounts, obtain customer acceptance
          </p>
        </div>
        <button
          id="btn-new-quotation"
          className="btn btn-primary"
          onClick={() => handleOpenCreateModal()}
          disabled={enquiries.length === 0}
        >
          + Create Quotation from Enquiry
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Quotation #</th>
                <th>Enquiry Ref</th>
                <th>Customer</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>GST</th>
                <th>Grand Total</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th>Workflow Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No quotations generated yet. Click "+ Create Quotation from Enquiry" to begin.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id}>
                    <td><strong>{q.quotation_number}</strong></td>
                    <td>{q.enquiry_number}</td>
                    <td>{q.company_name}</td>
                    <td className="numeric-cell">₹{Number(q.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="numeric-cell" style={{ color: '#b45309' }}>
                      -₹{Number(q.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="numeric-cell" style={{ color: '#2563eb' }}>
                      +₹{Number(q.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="numeric-cell">
                      <strong style={{ color: '#15803d' }}>
                        ₹{Number(q.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '-'}</td>
                    <td>
                      <span className={`status-pill status-${q.status.toLowerCase()}`}>
                        {q.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Status lifecycle actions */}
                        {!q.sales_order_id && q.status === 'DRAFT' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStatusChange(q.id, 'SENT')}
                          >
                            Send
                          </button>
                        )}
                        {!q.sales_order_id && (q.status === 'DRAFT' || q.status === 'SENT') && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleStatusChange(q.id, 'ACCEPTED')}
                          >
                            Accept
                          </button>
                        )}
                        {!q.sales_order_id && (q.status === 'DRAFT' || q.status === 'SENT') && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleStatusChange(q.id, 'REJECTED')}
                          >
                            Reject
                          </button>
                        )}

                        {/* Convert to Sales Order - ONLY if status is ACCEPTED */}
                        {q.status === 'ACCEPTED' && !q.sales_order_id && (
                          <button
                            id={`btn-convert-${q.id}`}
                            className="btn btn-primary btn-sm"
                            onClick={() => handleConvertToOrder(q.id)}
                          >
                            Convert to Sales Order ➔
                          </button>
                        )}

                        {/* If already converted */}
                        {q.sales_order_id && (
                          <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                            ✓ Converted ({q.sales_order_number})
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE QUOTATION */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '880px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Quotation</h3>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateQuotation}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Reference Enquiry *</label>
                  <select
                    className="form-control"
                    value={selectedEnquiryId}
                    onChange={(e) => {
                      setSelectedEnquiryId(e.target.value);
                      loadEnquiryItemsForQuotation(e.target.value);
                    }}
                    required
                  >
                    {enquiries.map((enq) => (
                      <option key={enq.id} value={enq.id}>
                        {enq.enquiry_number} - {enq.company_name} ({enq.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quotation Validity Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#334155' }}>
                  Product Line Pricing & Tax Configuration
                </h4>
                <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '180px' }}>Product</th>
                        <th style={{ width: '95px' }}>Qty</th>
                        <th style={{ width: '135px' }}>Unit Price (₹)</th>
                        <th style={{ width: '95px' }}>Disc %</th>
                        <th style={{ width: '115px' }}>GST %</th>
                        <th style={{ width: '140px', textAlign: 'right' }}>Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const linePreview = calculatedPreview?.items?.[idx];
                        return (
                          <tr key={idx}>
                            <td>
                              <strong>{item.product_code}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {item.product_name}
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="table-input"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="table-input"
                                step="0.01"
                                min="0"
                                value={item.unit_price}
                                onChange={(e) => handleItemFieldChange(idx, 'unit_price', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="table-input"
                                min="0"
                                max="100"
                                value={item.discount_pct}
                                onChange={(e) => handleItemFieldChange(idx, 'discount_pct', e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="table-input"
                                value={item.gst_pct}
                                onChange={(e) => handleItemFieldChange(idx, 'gst_pct', e.target.value)}
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong className="numeric-cell" style={{ fontSize: '1rem', color: '#0f172a' }}>
                                ₹{linePreview ? Number(linePreview.line_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                              </strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown Summary (Backend Preview) */}
              {calculatedPreview && (
                <div className="quotation-summary-bar">
                  <div className="summary-item">
                    <span className="summary-label">Subtotal</span>
                    <span className="summary-value">
                      ₹{Number(calculatedPreview.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Discount</span>
                    <span className="summary-value discount-val">
                      -₹{Number(calculatedPreview.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">GST Tax</span>
                    <span className="summary-value gst-val">
                      +₹{Number(calculatedPreview.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="summary-item grand-total-item">
                    <span className="summary-label">Grand Total</span>
                    <span className="summary-value grand-total-val">
                      ₹{Number(calculatedPreview.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Quotation (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
