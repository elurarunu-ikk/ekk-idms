-- Admin user seed (password: changeme123)
INSERT INTO users (full_name, email, role, password_hash)
VALUES (
    'EKK Admin',
    'admin@ekk.in',
    'admin',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'
)
ON CONFLICT (email) DO NOTHING;
