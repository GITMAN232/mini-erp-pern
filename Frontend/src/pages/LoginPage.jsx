import React, { useState } from 'react';
import { api } from '../services/api';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await api.login(email, password);
      localStorage.setItem('mini_erp_token', data.token);
      localStorage.setItem('mini_erp_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setEmail('admin@erp.com');
    setPassword('Admin@123');
    setError('');
  };

  const handleFillSales = () => {
    setEmail('sales@erp.com');
    setPassword('Sales@123');
    setError('');
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-header">
          <h1>🏭 Mini-ERP</h1>
          <p>Full-Stack Technical Technical Case Study</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="e.g. admin@erp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div className="demo-credentials">
          <div className="demo-title">Quick Demo Logins</div>
          <div className="demo-buttons">
            <button
              id="btn-fill-admin"
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={handleFillAdmin}
            >
              👑 Fill Admin
            </button>
            <button
              id="btn-fill-sales"
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={handleFillSales}
            >
              💼 Fill Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
