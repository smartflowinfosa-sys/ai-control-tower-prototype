-- Migration: Fix ambiguous column reference 'target_date' in process_daily_inventory_deduction
-- Resolves PostgreSQL error 42702 by renaming parameter to p_target_date and qualifying all table references.

-- 1. Drop existing overloaded functions
DROP FUNCTION IF EXISTS public.process_daily_inventory_deduction(date);
DROP FUNCTION IF EXISTS public.process_daily_inventory_deduction(text);

-- 2. Create updated function with explicit p_target_date parameter
CREATE OR REPLACE FUNCTION public.process_daily_inventory_deduction(p_target_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bags_count integer := 0;
  v_rec record;
  v_consumed integer;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  -- 1. Calculate bags count from techrar_packaging_report for the target date
  SELECT COALESCE(COUNT(*), 0)::integer
  INTO v_bags_count
  FROM public.techrar_packaging_report tpr
  WHERE tpr.report_date = p_target_date;

  -- 2. Clean up any existing consumption history records for this specific target date (idempotency safety)
  DELETE FROM public.inventory_consumption_history ich
  WHERE ich.target_date = p_target_date;

  -- 3. Loop through all inventory items and compute consumption
  FOR v_rec IN 
    SELECT 
      inv.item_code, 
      inv.current_stock
    FROM public.inventory_items inv
    ORDER BY inv.item_code
  LOOP
    -- Calculate consumption for this item on p_target_date
    IF v_rec.item_code = 'P8' THEN
      -- P8 represents packaging bags from packaging report
      v_consumed := v_bags_count;
    ELSE
      -- Meal packaging consumption based on BOM and BOQ for p_target_date
      SELECT COALESCE(SUM(boq.quantity * bom.quantity_used), 0)::integer
      INTO v_consumed
      FROM public.techrar_boq boq
      JOIN public.bom_packaging bom 
        ON boq.product_id::text = bom.meal_code
      WHERE boq.report_date = p_target_date
        AND bom.inventory_item_code = v_rec.item_code;
    END IF;

    -- Compute balances
    v_balance_before := v_rec.current_stock;
    v_balance_after  := v_balance_before - v_consumed;

    -- Record in inventory_consumption_history
    INSERT INTO public.inventory_consumption_history (
      item_code,
      target_date,
      balance_before,
      quantity_consumed,
      balance_after
    ) VALUES (
      v_rec.item_code,
      p_target_date,
      v_balance_before,
      v_consumed,
      v_balance_after
    );

    -- Update inventory_items: deduct current stock and update consumed_quantity
    UPDATE public.inventory_items inv
    SET 
      current_stock = v_balance_after,
      consumed_quantity = v_consumed
    WHERE inv.item_code = v_rec.item_code;

  END LOOP;

  -- 4. Return summary JSON
  RETURN jsonb_build_object(
    'success', true,
    'date', p_target_date,
    'bags_deducted', v_bags_count
  );
END;
$$;

-- 3. Backward-compatible wrapper allowing callers to pass target_date as text without collision
CREATE OR REPLACE FUNCTION public.process_daily_inventory_deduction(target_date text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.process_daily_inventory_deduction(p_target_date := target_date::date);
END;
$$;
