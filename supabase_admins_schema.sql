-- Create table to store Portal Administrators
CREATE TABLE IF NOT EXISTS portal_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    added_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS) Configuration
ALTER TABLE portal_admins ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated admins to manage this table
-- Note: As we use the service role key on the backend, RLS policies do not affect backend queries.
-- However, for good security practices, we enable RLS and add policies.
CREATE POLICY "Admins can view admins" ON portal_admins
    FOR SELECT TO authenticated USING (true);

-- Insert the default admin email as the first administrator
INSERT INTO portal_admins (email, added_by)
VALUES ('barbosma1@gmail.com', 'Sistema')
ON CONFLICT (email) DO NOTHING;
