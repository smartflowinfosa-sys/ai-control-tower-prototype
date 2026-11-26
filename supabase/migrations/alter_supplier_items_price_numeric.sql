-- Migration: Ensure decimal supply prices (halalas, e.g. 0.10, 0.085) are stored accurately
-- up to 4 decimal places in public.supplier_items and public.inventory_items.

ALTER TABLE public.supplier_items
  ALTER COLUMN price TYPE NUMERIC(12, 4) USING price::NUMERIC(12, 4);

ALTER TABLE public.inventory_items
  ALTER COLUMN cost_per_unit TYPE NUMERIC(12, 4) USING cost_per_unit::NUMERIC(12, 4);
