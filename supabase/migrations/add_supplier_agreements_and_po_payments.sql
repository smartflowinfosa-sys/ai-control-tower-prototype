-- 1. Per-PO Agreement Notes, Payment Method & Partial Delivery Quantity Tracking columns on public.purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_type TEXT,
  ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- 2. Purchase Order & Supplier Scheduled Payments table (public.po_payments)
CREATE TABLE IF NOT EXISTS public.po_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL DEFAULT 'دفعة عامة',
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paid')),
  paid_at TIMESTAMPTZ,
  receipt_url TEXT,
  reminder_ticket_created BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_payments_po_number ON public.po_payments(po_number);
CREATE INDEX IF NOT EXISTS idx_po_payments_supplier_id ON public.po_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_payments_due_status ON public.po_payments(status, due_date);

-- 3. Create public storage bucket 'procurement-docs' for compressed payment receipts & invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('procurement-docs', 'procurement-docs', true)
ON CONFLICT (id) DO NOTHING;
