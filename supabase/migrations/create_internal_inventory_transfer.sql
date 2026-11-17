-- Migration: Internal Inventory Transfer (main_stock -> production_stock + internal_transfers_log)
-- Safe & idempotent: adds main_stock and production_stock columns to inventory_items,
-- backfills main_stock from current_stock, creates internal_transfers_log, and defines
-- an atomic RPC process_internal_inventory_transfer.

-- 1. Add main_stock and production_stock columns to public.inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS main_stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_stock INTEGER NOT NULL DEFAULT 0;

-- Backfill main_stock with existing current_stock for rows not yet split
UPDATE public.inventory_items
SET main_stock = GREATEST(0, COALESCE(current_stock, 0))
WHERE main_stock = 0
  AND production_stock = 0
  AND COALESCE(current_stock, 0) > 0;

-- 2. Create public.internal_transfers_log table
CREATE TABLE IF NOT EXISTS public.internal_transfers_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL REFERENCES public.inventory_items(item_code) ON DELETE CASCADE,
  quantity_cartons INTEGER NOT NULL CHECK (quantity_cartons > 0),
  units_per_carton INTEGER NOT NULL DEFAULT 1 CHECK (units_per_carton > 0),
  quantity_units INTEGER NOT NULL CHECK (quantity_units > 0),
  destination TEXT NOT NULL DEFAULT 'production_stock',
  main_stock_before INTEGER NOT NULL,
  main_stock_after INTEGER NOT NULL,
  production_stock_before INTEGER NOT NULL,
  production_stock_after INTEGER NOT NULL,
  transferred_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_transfers_log_item_code
  ON public.internal_transfers_log (item_code);

CREATE INDEX IF NOT EXISTS idx_internal_transfers_log_created_at_desc
  ON public.internal_transfers_log (created_at DESC);

-- 3. Atomic RPC for internal stock transfers (deducts main_stock, adds production_stock, logs transfer)
CREATE OR REPLACE FUNCTION public.process_internal_inventory_transfer(
  p_item_code TEXT,
  p_quantity_cartons INTEGER,
  p_units_per_carton INTEGER,
  p_destination TEXT,
  p_transferred_by TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(p_item_code));
  v_units INTEGER := p_quantity_cartons * GREATEST(1, COALESCE(p_units_per_carton, 1));
  v_main_before INTEGER;
  v_prod_before INTEGER;
  v_main_after INTEGER;
  v_prod_after INTEGER;
  v_log_id UUID;
BEGIN
  IF p_quantity_cartons IS NULL OR p_quantity_cartons <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity in cartons must be greater than zero.';
  END IF;

  IF p_destination IS DISTINCT FROM 'production_stock' THEN
    RAISE EXCEPTION 'Unsupported transfer destination: %', p_destination;
  END IF;

  SELECT COALESCE(main_stock, 0), COALESCE(production_stock, 0)
  INTO v_main_before, v_prod_before
  FROM public.inventory_items
  WHERE UPPER(item_code) = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % not found.', v_code;
  END IF;

  IF v_main_before < v_units THEN
    RAISE EXCEPTION 'Insufficient main_stock for %: available %, requested %.', v_code, v_main_before, v_units;
  END IF;

  v_main_after := v_main_before - v_units;
  v_prod_after := v_prod_before + v_units;

  UPDATE public.inventory_items
  SET main_stock = v_main_after,
      production_stock = v_prod_after
  WHERE UPPER(item_code) = v_code;

  INSERT INTO public.internal_transfers_log (
    item_code,
    quantity_cartons,
    units_per_carton,
    quantity_units,
    destination,
    main_stock_before,
    main_stock_after,
    production_stock_before,
    production_stock_after,
    transferred_by,
    notes
  )
  VALUES (
    v_code,
    p_quantity_cartons,
    GREATEST(1, COALESCE(p_units_per_carton, 1)),
    v_units,
    p_destination,
    v_main_before,
    v_main_after,
    v_prod_before,
    v_prod_after,
    COALESCE(NULLIF(TRIM(p_transferred_by), ''), 'warehouse_manager'),
    NULLIF(TRIM(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'log_id', v_log_id,
    'item_code', v_code,
    'quantity_cartons', p_quantity_cartons,
    'units_per_carton', GREATEST(1, COALESCE(p_units_per_carton, 1)),
    'quantity_units', v_units,
    'destination', p_destination,
    'main_stock_before', v_main_before,
    'main_stock_after', v_main_after,
    'production_stock_before', v_prod_before,
    'production_stock_after', v_prod_after
  );
END;
$$;
