export interface PackagingProduct {
  id: string;
  name: string;
}

export const PACKAGING_PRODUCTS: PackagingProduct[] = [
  { id: 'none', name: 'بدون' },
  { id: 'all', name: 'الكل' },
  { id: 'main_tray_divided', name: 'Main Tray - Divided | صحن مقسم' },
  { id: 'main_tray_undivided', name: 'Main Tray - Undivided | صحن غير مقسم' },
  { id: 'salad_tray', name: 'Salad Tray | صحن السلطة' },
  { id: 'dessert_tray', name: 'Dessert Tray | صحن الحلو' },
  { id: 'cutlery', name: 'Cutlery | أدوات الطعام' },
  { id: 'sleeves', name: 'Sleeves | أغطية الصحون' },
  { id: 'sauce_cup', name: 'Sauce Cup | علبة الصوص' },
  { id: 'plastic_mini_bag', name: 'Plastic mini Bag | أكياس بلاستيك صغيرة' },
  { id: 'clear_dessert_tray', name: 'Clear Dessert Tray | صحن الحلو شفاف' }
];

export const PACKAGING_MAPPING: Record<string, number[]> = {
  'main_tray_divided': [
    43015, 43160, 42999, 42994, 43004, 42988, 43018, 43003, 43002, 43012,
    43181, 43008, 43032, 43026, 43038, 43060, 43061, 43045, 43031, 43049,
    43051, 43047, 43176
  ],
  'main_tray_undivided': [
    43000, 42998, 42985, 42986, 43016, 42987, 42989, 43014, 43009, 42993,
    43001, 42991, 42992, 43010, 42990, 43017, 42995, 42997, 43005, 43006,
    43011, 43013, 42996, 43068, 43055, 43024, 43065, 43020, 43029, 43062,
    43054, 43040, 43041, 43043, 43056, 43057, 43064, 43037, 43021, 43042,
    43039, 43022, 43175, 43027, 43066, 43067, 43063, 43030, 43059, 43050,
    43053, 43046, 43048, 43052
  ],
  'salad_tray': [
    43070, 43168, 43074, 43075, 43069, 43072, 43073, 43172, 43076, 43071,
    43167, 43079, 43078, 43166, 43077, 43171
  ],
  'cutlery': [43000, 42998, 43015, 43160, 43068, 43055, 43024, 43040],
  'dessert_tray': [],
  'sleeves': [],
  'sauce_cup': [],
  'plastic_mini_bag': [],
  'clear_dessert_tray': []
};

export interface QuantityMealRow {
  id: string | number;
  product_id: number;
  product_name: string;
  mealCode: number;
  nameAr: string;
  nameEn?: string;
  quantity: number;
  category?: string;
}

export interface TechrarBoqRawRow {
  id?: number | string;
  product_id?: number | string;
  productId?: number | string;
  meal_code?: number | string;
  mealCode?: number | string;
  code?: number | string;
  product_name?: string | null;
  productName?: string | null;
  meal_name_ar?: string | null;
  nameAr?: string | null;
  name?: string | null;
  quantity?: number | string | null;
  total_quantity?: number | string | null;
  count?: number | string | null;
  qty?: number | string | null;
  meals_count?: number | string | null;
  status?: string | null;
  report_date?: string | null;
  date?: string | null;
  category?: string | null;
  category_ar?: string | null;
  name_en?: string | null;
  product_name_en?: string | null;
}

/**
 * Checks if a status field represents confirmed / مؤكد.
 * If status is missing/undefined, returns true by default (as query was pre-filtered).
 */
export function isConfirmedStatus(status?: string | null): boolean {
  if (status === undefined || status === null || status === '') {
    return true;
  }
  const normalized = String(status).trim().toLowerCase();
  return (
    normalized === 'confirmed' ||
    normalized === 'مؤكد' ||
    normalized === 'مكتمل' ||
    normalized === 'completed' ||
    normalized === 'approved'
  );
}

/**
 * Aggregates raw rows from Techrar API or `techrar_boq` by `product_id`:
 * - Filters strictly for confirmed status
 * - Groups rows by `product_id`
 * - Sums quantities (`quantity`, `total_quantity`, `count`, etc.)
 * - Returns unique sorted list of `QuantityMealRow`
 */
export function aggregateTechrarBoqRows(
  rawRows: TechrarBoqRawRow[],
  categoryMap?: Record<number, { categoryAr?: string; nameEn?: string }>
): QuantityMealRow[] {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return [];
  }

  const grouped = new Map<
    number,
    {
      product_id: number;
      product_name: string;
      nameEn?: string;
      category?: string;
      quantity: number;
    }
  >();

  for (const row of rawRows) {
    // Strictly filter out non-confirmed statuses if status is provided
    if (row.status && !isConfirmedStatus(row.status)) {
      continue;
    }

    const rawId =
      row.product_id ??
      row.productId ??
      row.meal_code ??
      row.mealCode ??
      row.code ??
      row.id;
    const productId = Number(rawId);
    if (!Number.isFinite(productId) || productId <= 0) continue;

    const rawQty =
      row.quantity ??
      row.total_quantity ??
      row.count ??
      row.qty ??
      row.meals_count ??
      0;
    const qty = Number(rawQty) || 0;

    const cleanName = (
      row.product_name ??
      row.productName ??
      row.meal_name_ar ??
      row.nameAr ??
      row.name ??
      ''
    ).toString().trim();

    const cleanNameEn = (
      row.name_en ??
      row.product_name_en ??
      ''
    ).toString().trim();

    const cleanCategory = (
      row.category ??
      row.category_ar ??
      ''
    ).toString().trim();

    const existing = grouped.get(productId);

    if (existing) {
      existing.quantity += qty;
      if (!existing.product_name && cleanName) {
        existing.product_name = cleanName;
      }
      if (!existing.nameEn && cleanNameEn) {
        existing.nameEn = cleanNameEn;
      }
      if (!existing.category && cleanCategory) {
        existing.category = cleanCategory;
      }
    } else {
      grouped.set(productId, {
        product_id: productId,
        product_name: cleanName || `وجبة #${productId}`,
        nameEn: cleanNameEn,
        category: cleanCategory,
        quantity: qty,
      });
    }
  }

  return Array.from(grouped.values())
    .map((item) => {
      const meta = categoryMap?.[item.product_id];
      return {
        id: `boq-${item.product_id}`,
        product_id: item.product_id,
        product_name: item.product_name,
        mealCode: item.product_id,
        nameAr: item.product_name,
        nameEn: meta?.nameEn || item.nameEn || '',
        quantity: item.quantity,
        category: meta?.categoryAr || item.category || 'عام',
      };
    })
    .sort((a, b) => a.product_id - b.product_id);
}
