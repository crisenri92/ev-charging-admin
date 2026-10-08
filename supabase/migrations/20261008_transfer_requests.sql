-- Tabla de solicitudes de transferencia bancaria
CREATE TABLE IF NOT EXISTS transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL CHECK (amount > 0 AND amount <= 10000),
  currency varchar(3) NOT NULL DEFAULT 'USD',
  reference_number varchar(200),
  receipt_url text,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by_admin boolean DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transfer_requests_user_id ON transfer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_created_at ON transfer_requests(created_at DESC);

-- RLS
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

-- Usuario puede ver solo sus propias solicitudes
CREATE POLICY "Users can view own transfer requests"
  ON transfer_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Usuario puede crear sus propias solicitudes
CREATE POLICY "Users can create transfer requests"
  ON transfer_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Service role puede hacer todo (para el admin panel)
CREATE POLICY "Service role full access"
  ON transfer_requests FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transfer_requests_updated_at
  BEFORE UPDATE ON transfer_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
