-- Adds reorder point and supplier lead time to inventory items.
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS min_stock_level INTEGER,
  ADD COLUMN IF NOT EXISTS lead_time_days  INTEGER;

UPDATE inventory_items AS i
SET min_stock_level = v.min_stock_level,
    lead_time_days  = v.lead_time_days
FROM (VALUES
  ('P1', 11000, 14), ('P2', 11000, 14), ('P3', 5000, 3),  ('P4', 4000, 3),
  ('P5', 3000, 3),   ('P6', 32000, 20), ('P7', 32000, 20), ('P8', 20000, 20),
  ('P9', 1500, 2),   ('P10', 4000, 3),  ('P11', 11000, 14)
) AS v(item_code, min_stock_level, lead_time_days)
WHERE i.item_code = v.item_code;
