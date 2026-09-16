import React from 'react';

export default function Navbar({ activeTab, setActiveTab, user, onLogout }) {
  return (
    <>
      <header className="navbar">
        <div className="nav-brand">
          <span>🏭 Mini-ERP</span>
          <span className="brand-badge">PERN</span>
        </div>

        <nav className="nav-links">
          <button
            id="tab-enquiries"
            className={`nav-tab ${activeTab === 'enquiries' ? 'active' : ''}`}
            onClick={() => setActiveTab('enquiries')}
          >
            Enquiries
          </button>
          <button
            id="tab-quotations"
            className={`nav-tab ${activeTab === 'quotations' ? 'active' : ''}`}
            onClick={() => setActiveTab('quotations')}
          >
            Quotations
          </button>
          <button
            id="tab-orders"
            className={`nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Sales Orders
          </button>
          <button
            id="tab-inventory"
            className={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
        </nav>

        <div className="nav-user">
          <span
            className={`role-badge ${user?.role === 'ADMIN' ? 'role-admin' : 'role-sales'}`}
          >
            {user?.role}
          </span>
          <span style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>{user?.name}</span>
          <button id="btn-logout" className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Workflow Navigation / Breadcrumb Visualizer */}
      <div className="workflow-strip">
        <span style={{ fontWeight: 600, color: '#334155' }}>Workflow:</span>
        <span className={`step-item ${activeTab === 'enquiries' ? 'active' : ''}`}>
          1. Customer Enquiry
        </span>
        <span className="step-sep">➔</span>
        <span className={`step-item ${activeTab === 'quotations' ? 'active' : ''}`}>
          2. Quotation
        </span>
        <span className="step-sep">➔</span>
        <span className={`step-item ${activeTab === 'quotations' ? 'active' : ''}`}>
          3. Accepted Quotation
        </span>
        <span className="step-sep">➔</span>
        <span className={`step-item ${activeTab === 'orders' ? 'active' : ''}`}>
          4. Sales Order
        </span>
        <span className="step-sep">➔</span>
        <span className={`step-item ${activeTab === 'orders' ? 'active' : ''}`}>
          5. Inventory Reservation (Admin)
        </span>
        <span className="step-sep">➔</span>
        <span className={`step-item ${activeTab === 'orders' ? 'active' : ''}`}>
          6. Dispatch (Admin)
        </span>
      </div>
    </>
  );
}
