import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import EnquiriesPage from './pages/EnquiriesPage';
import QuotationsPage from './pages/QuotationsPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import InventoryPage from './pages/InventoryPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('enquiries');
  const [preselectedEnquiryId, setPreselectedEnquiryId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('mini_erp_user');
    const token = localStorage.getItem('mini_erp_token');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('mini_erp_user');
        localStorage.removeItem('mini_erp_token');
      }
    }
    setInitializing(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setActiveTab('enquiries');
  };

  const handleLogout = () => {
    localStorage.removeItem('mini_erp_token');
    localStorage.removeItem('mini_erp_user');
    setUser(null);
  };

  const handleGoToQuotationFromEnquiry = (enquiryId) => {
    setPreselectedEnquiryId(enquiryId);
    setActiveTab('quotations');
  };

  const handleOrderCreatedFromQuotation = (orderId) => {
    setSelectedOrderId(orderId);
    setActiveTab('orders');
  };

  if (initializing) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        Loading portal...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setPreselectedEnquiryId(null);
          setSelectedOrderId(null);
          setActiveTab(tab);
        }}
        user={user}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        {activeTab === 'enquiries' && (
          <EnquiriesPage onGoToQuotation={handleGoToQuotationFromEnquiry} />
        )}
        {activeTab === 'quotations' && (
          <QuotationsPage
            preselectedEnquiryId={preselectedEnquiryId}
            onOrderCreated={handleOrderCreatedFromQuotation}
          />
        )}
        {activeTab === 'orders' && (
          <SalesOrdersPage
            user={user}
            selectedOrderId={selectedOrderId}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryPage user={user} />
        )}
      </main>
    </div>
  );
}
