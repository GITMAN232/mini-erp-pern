-- ====================================================================
-- MINI-ERP SEED DATA
-- ====================================================================

-- 1. SEED USERS
-- Admin: admin@erp.com / Admin@123
-- Sales: sales@erp.com / Sales@123
INSERT INTO users (email, password_hash, role, name) VALUES
('admin@erp.com', '$2a$10$98sBCGCv42t/kTSgwSpTu.9RHAqkKspMfCszI.r.NCiMitRWAonqO', 'ADMIN', 'System Administrator'),
('sales@erp.com', '$2a$10$snube/vjuk4a.fypWNgwZ.RgjThqQ.i0RcrZcg/0xlZ5korVdh14q', 'SALES', 'Senior Sales Executive')
ON CONFLICT (email) DO NOTHING;

-- 2. SEED CUSTOMERS
INSERT INTO customers (company_name, contact_person, mobile, email, city) VALUES
('Apex Heavy Engineering Ltd.', 'Rajesh Sharma', '+91 98234 56781', 'rsharma@apexengineering.com', 'Pune'),
('Precision Dynamics Pvt Ltd', 'Ananya Deshmukh', '+91 98451 23456', 'ananya@precisiondyn.com', 'Bengaluru'),
('Titan Machineries & Tools', 'Vikram Patel', '+91 97123 89012', 'vpatel@titanmachineries.com', 'Ahmedabad');

-- 3. SEED PRODUCTS (6 realistic industrial products)
INSERT INTO products (product_code, product_name, category, unit, base_price) VALUES
('IND-BRG-01', 'Deep Groove Ball Bearing 6205', 'Bearings', 'Pcs', 1250.00),
('HYD-PMP-02', 'Hydraulic High-Pressure Vane Pump', 'Hydraulics', 'Unit', 8500.00),
('STL-CPL-03', 'Flexible Jaw Steel Coupling 50mm', 'Couplings', 'Set', 2100.00),
('CNV-BLT-04', '3-Ply Industrial Conveyor Belt', 'Material Handling', 'Mtr', 1450.00),
('GEAR-MTR-05', 'Helical Industrial Gear Motor 2HP', 'Motors', 'Unit', 16200.00),
('PRS-VLV-06', 'Pneumatic Pressure Control Valve', 'Valves', 'Pcs', 4300.00);

-- 4. SEED INVENTORY (For each seeded product)
INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
SELECT id, 100, 0 FROM products WHERE product_code = 'IND-BRG-01'
UNION ALL
SELECT id, 50, 0 FROM products WHERE product_code = 'HYD-PMP-02'
UNION ALL
SELECT id, 80, 0 FROM products WHERE product_code = 'STL-CPL-03'
UNION ALL
SELECT id, 150, 0 FROM products WHERE product_code = 'CNV-BLT-04'
UNION ALL
SELECT id, 30, 0 FROM products WHERE product_code = 'GEAR-MTR-05'
UNION ALL
SELECT id, 60, 0 FROM products WHERE product_code = 'PRS-VLV-06';
