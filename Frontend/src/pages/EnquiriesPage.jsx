import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function EnquiriesPage({ onGoToQuotation }) {
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // New Enquiry Form
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);

  // New Customer Form
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [enqData, custData, prodData] = await Promise.all([
        api.getEnquiries(),
        api.getCustomers(),
        api.getProducts()
      ]);
      setEnquiries(enqData);
      setCustomers(custData);
      setProducts(prodData);
      if (custData.length > 0 && !selectedCustomer) {
        setSelectedCustomer(custData[0].id);
      }
      if (prodData.length > 0 && items[0].product_id === '') {
        setItems([{ product_id: prodData[0].id, quantity: 1 }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItemRow = () => {
    const defaultProdId = products.length > 0 ? products[0].id : '';
    setItems([...items, { product_id: defaultProdId, quantity: 1 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const newCust = await api.createCustomer({
        company_name: companyName,
        contact_person: contactPerson,
        mobile,
        email,
        city
      });
      setCustomers([newCust, ...customers]);
      setSelectedCustomer(newCust.id);
      setShowCustomerModal(false);
      setSuccess(`Customer "${newCust.company_name}" created successfully`);
      setCompanyName('');
      setContactPerson('');
      setMobile('');
      setEmail('');
      setCity('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateEnquiry = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const payload = {
        customer_id: Number(selectedCustomer),
        required_date: requiredDate,
        notes,
        items: items.map(it => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity)
        }))
      };
      await api.createEnquiry(payload);
      setShowEnquiryModal(false);
      setSuccess('Enquiry created successfully');
      setNotes('');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Enquiries</h1>
          <p className="page-subtitle">Step 1: Capture inbound commercial product enquiries</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            id="btn-open-customer-modal"
            className="btn btn-secondary"
            onClick={() => setShowCustomerModal(true)}
          >
            + New Customer
          </button>
          <button
            id="btn-open-enquiry-modal"
            className="btn btn-primary"
            onClick={() => {
              if (products.length > 0 && items[0].product_id === '') {
                setItems([{ product_id: products[0].id, quantity: 1 }]);
              }
              setShowEnquiryModal(true);
            }}
          >
            + New Enquiry
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Enquiry #</th>
                <th>Customer</th>
                <th>City</th>
                <th>Required Date</th>
                <th>Items</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading enquiries...
                  </td>
                </tr>
              ) : enquiries.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No enquiries found. Click "+ New Enquiry" to create one.
                  </td>
                </tr>
              ) : (
                enquiries.map((enq) => (
                  <tr key={enq.id}>
                    <td>
                      <strong>{enq.enquiry_number}</strong>
                    </td>
                    <td>
                      <div>{enq.company_name}</div>
                      <small style={{ color: 'var(--text-muted)' }}>{enq.contact_person}</small>
                    </td>
                    <td>{enq.customer_city}</td>
                    <td>{enq.required_date ? new Date(enq.required_date).toLocaleDateString() : '-'}</td>
                    <td>{enq.total_items} items</td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {enq.notes || '-'}
                    </td>
                    <td>
                      <span className={`status-pill status-${enq.status.toLowerCase()}`}>
                        {enq.status}
                      </span>
                    </td>
                    <td>
                      {enq.status !== 'WON' && enq.status !== 'LOST' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onGoToQuotation(enq.id)}
                        >
                          Generate Quotation ➔
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE CUSTOMER */}
      {showCustomerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Customer</h3>
              <button className="btn-close" onClick={() => setShowCustomerModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Engineering Ltd"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contact Person *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 9876543210"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@company.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Pune"
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ENQUIRY */}
      {showEnquiryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Create Customer Enquiry</h3>
              <button className="btn-close" onClick={() => setShowEnquiryModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateEnquiry}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Select Customer *</label>
                  <select
                    className="form-control"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.city})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Required Delivery Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Instructions</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Urgent requirement for heavy plant assembly line"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Products & Quantities *</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItemRow}>
                    + Add Product Line
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <select
                      className="form-control"
                      style={{ flex: 3 }}
                      value={item.product_id}
                      onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                      required
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_name} ({p.product_code}) - Base ₹{p.base_price}/{p.unit}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      className="form-control"
                      style={{ flex: 1 }}
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      required
                    />

                    {items.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveItemRow(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEnquiryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
