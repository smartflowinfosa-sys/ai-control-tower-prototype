-- Migration: Create daily_deduction_logs table & Implement Atomic Idempotency Lock
-- Prevents double deductions by enforcing database-level lock flag and transaction-level serialization.

-- 1. Create the daily_deduction_logs table
CREATE TABLE IF NOT EXISTS public.daily_deduction_logs (
    target_date DATE PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_by_system BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_deduction_logs_status ON public.daily_deduction_logs (status);
CREATE INDEX IF NOT EXISTS idx_daily_deduction_logs_executed_at ON public.daily_deduction_logs (executed_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_deduction_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access
DROP POLICY IF EXISTS "Allow read access to daily_deduction_logs" ON public.daily_deduction_logs;
CREATE POLICY "Allow read access to daily_deduction_logs"
  ON public.daily_deduction_logs
  FOR SELECT
  USING (true);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to daily_deduction_logs" ON public.daily_deduction_logs;
CREATE POLICY "Allow service_role full access to daily_deduction_logs"
  ON public.daily_deduction_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.daily_deduction_logs TO postgres, service_role;
GRANT SELECT ON public.daily_deduction_logs TO anon, authenticated;

-- 2. Backfill existing deduction dates from legacy inventory_deduction_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'inventory_deduction_logs'
  ) THEN
    INSERT INTO public.daily_deduction_logs (target_date, status, executed_at, executed_by_system)
    SELECT 
      target_date, 
      'success', 
      COALESCE(deducted_at, NOW()), 
      true
    FROM public.inventory_deduction_logs
    ON CONFLICT (target_date) DO NOTHING;
  END IF;
END $$;

-- 3. Drop existing overloaded functions
DROP FUNCTION IF EXISTS public.process_daily_inventory_deduction(date);
DROP FUNCTION IF EXISTS public.process_daily_inventory_deduction(text);

-- 4. Create updated process_daily_inventory_deduction with Idempotency Lock
CREATE OR REPLACE FUNCTION public.process_daily_inventory_deduction(p_target_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_date date := COALESCE(p_target_date, CURRENT_DATE);
  v_already_deducted boolean := false;
  v_bags_count integer := 0;
  v_cutlery_count integer := 0;
  v_rec record;
  v_consumed integer;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  -- A. Advisory Transaction Lock: Serialize concurrent executions for the same target date
  PERFORM pg_advisory_xact_lock(hashtext('daily_deduction_' || v_target_date::text));

  -- B. Self-healing check: Ensure daily_deduction_logs exists
  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.daily_deduction_logs (
      target_date DATE PRIMARY KEY,
      status VARCHAR(20) NOT NULL DEFAULT ''success'',
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      executed_by_system BOOLEAN NOT NULL DEFAULT true
    );
  ';

  -- C. THE LOCK LOGIC (At the VERY START):
  -- Check if a record exists in daily_deduction_logs for target_date with status = 'success'
  EXECUTE '
    SELECT EXISTS (
      SELECT 1 FROM public.daily_deduction_logs 
      WHERE target_date = $1 AND status = ''success''
    );
  ' INTO v_already_deducted USING v_target_date;

  -- IF it exists -> ABORT immediately and return exact message
  IF v_already_deducted THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_deducted', true,
      'date', v_target_date,
      'target_date', v_target_date,
      'message', 'Deduction already completed for this date'
    );
  END IF;

  -- D. Calculate bags count (P8) and cutlery count (P7) from techrar_packaging_report
  -- P8 Rule: 1 bag per customer order
  -- P7 Rule: If package_name contains ''غداء'' (like ''غداء العمل'') -> 1; ELSE -> 2
  SELECT 
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(
      SUM(
        CASE 
          WHEN tpr.package_name ILIKE '%غداء%' THEN 1 
          ELSE 2 
        END
      ), 
      0
    )::integer
  INTO 
    v_bags_count,
    v_cutlery_count
  FROM public.techrar_packaging_report tpr
  WHERE tpr.report_date = v_target_date;

  -- E. Clean up any existing consumption history records for this specific target date
  DELETE FROM public.inventory_consumption_history ich
  WHERE ich.target_date = v_target_date;

  -- F. Loop through all inventory items and compute consumption (BOM + P7/P8)
  FOR v_rec IN 
    SELECT 
      inv.item_code, 
      inv.current_stock
    FROM public.inventory_items inv
    ORDER BY inv.item_code
  LOOP
    IF v_rec.item_code = 'P8' THEN
      -- P8: Packaging Bags (1 per order in packaging report)
      v_consumed := v_bags_count;
    ELSIF v_rec.item_code = 'P7' THEN
      -- P7: Cutlery Sets (1 for lunch packages, 2 for all others)
      v_consumed := v_cutlery_count;
    ELSE
      -- Meal packaging consumption based on BOM and BOQ for v_target_date
      SELECT COALESCE(SUM(boq.quantity * bom.quantity_used), 0)::integer
      INTO v_consumed
      FROM public.techrar_boq boq
      JOIN public.bom_packaging bom 
        ON boq.product_id::text = bom.meal_code
      WHERE boq.report_date = v_target_date
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
      v_target_date,
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

  -- G. At the VERY END of the successful transaction:
  -- INSERT/UPDATE record in daily_deduction_logs marking it as 'success'
  EXECUTE '
    INSERT INTO public.daily_deduction_logs (
      target_date,
      status,
      executed_at,
      executed_by_system
    ) VALUES (
      $1,
      ''success'',
      NOW(),
      true
    )
    ON CONFLICT (target_date) DO UPDATE
    SET 
      status = ''success'',
      executed_at = NOW(),
      executed_by_system = true;
  ' USING v_target_date;

  -- Also keep legacy inventory_deduction_logs in sync for backward compatibility
  BEGIN
    INSERT INTO public.inventory_deduction_logs (target_date, deducted_at)
    VALUES (v_target_date, NOW())
    ON CONFLICT (target_date) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if table does not exist
  END;

  -- H. Return JSON summary
  RETURN jsonb_build_object(
    'success', true,
    'already_deducted', false,
    'date', v_target_date,
    'target_date', v_target_date,
    'bags_deducted', v_bags_count,
    'cutlery_deducted', v_cutlery_count,
    'message', 'Deduction completed successfully'
  );
END;
$$;

-- 5. Text overload for callers passing target_date as string (Supabase RPC / n8n webhook)
CREATE OR REPLACE FUNCTION public.process_daily_inventory_deduction(target_date text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.process_daily_inventory_deduction(p_target_date := target_date::date);
END;
$$;

