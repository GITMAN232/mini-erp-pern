const rawBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const BASE_URL = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('mini_erp_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMsg = (data && data.message) ? data.message : `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  getMe: () => apiRequest('/auth/me'),

  // Customers
  getCustomers: () => apiRequest('/customers'),
  createCustomer: (customer) => apiRequest('/customers', {
    method: 'POST',
    body: JSON.stringify(customer)
  }),

  // Products
  getProducts: () => apiRequest('/products'),
  createProduct: (product) => apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify(product)
  }),

  // Inventory
  getInventory: () => apiRequest('/inventory'),
  updateInventory: (productId, physicalQuantity) => apiRequest(`/inventory/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ physical_quantity: physicalQuantity })
  }),

  // Enquiries
  getEnquiries: () => apiRequest('/enquiries'),
  getEnquiryById: (id) => apiRequest(`/enquiries/${id}`),
  createEnquiry: (enquiry) => apiRequest('/enquiries', {
    method: 'POST',
    body: JSON.stringify(enquiry)
  }),

  // Quotations
  getQuotations: () => apiRequest('/quotations'),
  getQuotationById: (id) => apiRequest(`/quotations/${id}`),
  calculateQuotation: (items) => apiRequest('/quotations/calculate', {
    method: 'POST',
    body: JSON.stringify({ items })
  }),
  createQuotation: (quotation) => apiRequest('/quotations', {
    method: 'POST',
    body: JSON.stringify(quotation)
  }),
  updateQuotationStatus: (id, status) => apiRequest(`/quotations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  convertQuotation: (id) => apiRequest(`/quotations/${id}/convert`, {
    method: 'POST'
  }),

  // Sales Orders
  getSalesOrders: () => apiRequest('/sales-orders'),
  getSalesOrderById: (id) => apiRequest(`/sales-orders/${id}`),
  confirmSalesOrder: (id) => apiRequest(`/sales-orders/${id}/confirm`, {
    method: 'POST'
  }),
  dispatchSalesOrder: (id, dispatchData) => apiRequest(`/sales-orders/${id}/dispatch`, {
    method: 'POST',
    body: JSON.stringify(dispatchData)
  })
};
