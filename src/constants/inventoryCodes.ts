/**
 * Standardized inventory item codes ("The Golden Key").
 * These codes link kitchen consumption (BOM) -> replenishment -> goods receipt.
 */
export interface StandardItemCode {
  code: string;
  nameAr: string;
  nameEn: string;
}

export const STANDARD_ITEM_CODES: StandardItemCode[] = [
  { code: 'P1', nameAr: 'صحن مقسم 32', nameEn: 'Main Tray - Divided 32' },
  { code: 'P2', nameAr: 'صحن غير مقسم 28', nameEn: 'Main Tray - Undivided 28' },
  { code: 'P3', nameAr: 'علب الصوص', nameEn: 'Sauce Cup' },
  { code: 'P4', nameAr: 'صحن السلطة', nameEn: 'Salad Tray' },
  { code: 'P5', nameAr: 'كرافت ابيض', nameEn: 'White Kraft' },
  { code: 'P6', nameAr: 'سليف مطبوع', nameEn: 'Printed Sleeve' },
  { code: 'P7', nameAr: 'أدوات المائدة مطبوع', nameEn: 'Printed Cutlery' },
  { code: 'P8', nameAr: 'كيس زاهي مطبوع', nameEn: 'Zahi Printed Bag' },
  { code: 'P9', nameAr: 'أكياس بلاستيك صغيرة', nameEn: 'Plastic Mini Bag' },
  { code: 'P10', nameAr: 'صحن الحلا الشفاف', nameEn: 'Clear Dessert Tray' },
  { code: 'P11', nameAr: 'صحن غير مقسم 24', nameEn: 'Main Tray - Undivided 24' },
];

/**
 * Carton sizes (units per carton) based on real packaging specifications.
 * Note: For P6 (Sleeves), the user orders them per piece, so the value MUST be 1.
 */
export const CARTON_SIZES: Record<string, number> = {
  P1: 150,
  P2: 150,
  P11: 150,
  P3: 2000,
  P4: 480,
  P5: 1000,
  P6: 1,    // Ordered per piece, so 1 unit = 1 order quantity
  P7: 500,
  P8: 400,
  P9: 220,
  P10: 2000,
};

/**
 * Real inventory stock quantities provided by user from real inventory ledger.
 */
export const REAL_INVENTORY_STOCK: Record<string, number> = {
  P1: 33300,
  P2: 12450,
  P3: 2000,
  P4: 3000,
  P5: 0,
  P6: 7000,
  P7: 20000,
  P8: 10400,
  P9: 8000,
  P10: 2000,
  P11: 6000,
};

/**
 * Real minimum stock levels (reorder points) in units, provided by the user.
 * Mirrors the `min_stock_level` (INTEGER) column of `inventory_items`.
 */
export const MIN_STOCK_LEVELS: Record<string, number> = {
  P1: 11000,
  P2: 11000,
  P3: 5000,
  P4: 4000,
  P5: 3000,
  P6: 32000,
  P7: 32000,
  P8: 20000,
  P9: 1500,
  P10: 4000,
  P11: 11000,
};

/**
 * Real supplier lead times in days, provided by the user.
 * Mirrors the `lead_time_days` (INTEGER) column of `inventory_items`.
 */
export const LEAD_TIME_DAYS: Record<string, number> = {
  P1: 14,
  P2: 14,
  P3: 3,
  P4: 3,
  P5: 3,
  P6: 20,
  P7: 20,
  P8: 20,
  P9: 2,
  P10: 3,
  P11: 14,
};

/** Returns the `{ min_stock_level, lead_time_days }` pair for an item code (undefined when unknown). */
export const getStockPolicy = (code: string) => {
  const key = (code || '').trim().toUpperCase();
  return { min_stock_level: MIN_STOCK_LEVELS[key], lead_time_days: LEAD_TIME_DAYS[key] };
};

/**
 * Mock days passed since last restock (between 3 to 10 days ago)
 * for tracking Consumption Velocity in the Smart Auto PO table.
 */
export const MOCK_RESTOCK_DAYS_AGO: Record<string, number> = {
  P1: 5,   // 5 days ago (e.g., 1,850 units consumed since 5 days)
  P2: 4,   // 4 days ago
  P3: 7,   // 7 days ago
  P4: 3,   // 3 days ago
  P5: 8,   // 8 days ago
  P6: 10,  // 10 days ago
  P7: 6,   // 6 days ago
  P8: 4,   // 4 days ago
  P9: 9,   // 9 days ago
  P10: 5,  // 5 days ago
  P11: 3,  // 3 days ago
};

/**
 * Generates an ISO date string for a given number of days ago.
 */
export const getMockRestockDate = (code: string): string => {
  const key = (code || '').trim().toUpperCase();
  const days = MOCK_RESTOCK_DAYS_AGO[key] ?? 5;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
};

/**
 * Calculate days passed since last restock date.
 * Uses Math.max(1, ...) so restocked today returns 1 day instead of 0.
 */
export const getDaysSinceRestock = (dateString?: string | null): number => {
  if (!dateString) return 1;
  const diff = new Date().getTime() - new Date(dateString).getTime();
  if (isNaN(diff)) return 1;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

/**
 * Natural (alphanumeric) comparator for 'P' codes so that P10 and P11 sort strictly AFTER P9
 * (standard lexicographical sorting would wrongly place P10/P11 right after P1).
 * Extracts the integer component (e.g. 'P1' -> 1, 'P10' -> 10, 'P11' -> 11) and compares numerically.
 */
export const compareItemCodes = (a: string | null | undefined, b: string | null | undefined): number => {
  const strA = (a || '').trim();
  const strB = (b || '').trim();

  // Extract the numeric portion from alphanumeric codes like P1, P2... P10, P11
  const numA = parseInt(strA.replace(/\D/g, ''), 10);
  const numB = parseInt(strB.replace(/\D/g, ''), 10);

  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }

  // Fallback to localized natural alphanumeric sort if no digits found or digits are equal
  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Universal alphanumeric sorting helper for any array of items containing an item_code / itemId / code
 */
export const sortItemsByCode = <T>(
  items: T[],
  getCode: (item: T) => string | undefined = (item: any) => item?.item_code ?? item?.itemId ?? item?.code
): T[] => {
  return [...items].sort((a, b) => compareItemCodes(getCode(a), getCode(b)));
};

/** Default units per carton fallback when an item code is not explicitly defined */
export const UNITS_PER_CARTON = 500;

/**
 * Initial unreplenished consumption counters (units consumed by the kitchen
 * since the last goods receipt for each item code).
 */
export const INITIAL_UNREPLENISHED_CONSUMPTION: Record<string, number> = {
  P1: 1850,
  P2: 3200,
  P3: 2100,
  P4: 740,
  P5: 960,
  P6: 5200,
  P7: 2800,
  P8: 1300,
  P9: 640,
  P10: 410,
  P11: 1200,
};

export const getStandardCodeInfo = (code: string): StandardItemCode | undefined =>
  STANDARD_ITEM_CODES.find((c) => c.code === code.trim().toUpperCase());

/**
 * The 4 approved suppliers with exact real-world lead times:
 * - "أمجاد كميت" (Lead time: 48 hours)
 * - "عالم الوسام" (Lead time: 24 hours)
 * - "مزايا" (Lead time: 24 hours)
 * - "الصندوق المناسب" (Lead time: 24 hours)
 */
export interface ApprovedSupplier {
  id: string;
  name: string;
  nameAr: string;
  leadTimeHours: number;
  leadTimeDisplay: string;
}

export const APPROVED_SUPPLIERS: ApprovedSupplier[] = [
  {
    id: 'sup-kumait',
    name: 'أمجاد كميت',
    nameAr: 'أمجاد كميت',
    leadTimeHours: 48,
    leadTimeDisplay: '48 ساعة (48 hours)',
  },
  {
    id: 'sup-alwissam',
    name: 'عالم الوسام',
    nameAr: 'عالم الوسام',
    leadTimeHours: 24,
    leadTimeDisplay: '24 ساعة (24 hours)',
  },
  {
    id: 'sup-mazaya',
    name: 'مزايا',
    nameAr: 'مزايا',
    leadTimeHours: 24,
    leadTimeDisplay: '24 ساعة (24 hours)',
  },
  {
    id: 'sup-almonaseb',
    name: 'الصندوق المناسب',
    nameAr: 'الصندوق المناسب',
    leadTimeHours: 24,
    leadTimeDisplay: '24 ساعة (24 hours)',
  },
];

/**
 * Approved supplier mapping per item code (P1..P11).
 * If an item has multiple approved suppliers, all are returned for the dropdown.
 */
export const ITEM_APPROVED_SUPPLIERS: Record<string, string[]> = {
  P1: ['الصندوق المناسب', 'مزايا', 'عالم الوسام'],
  P2: ['الصندوق المناسب', 'مزايا', 'عالم الوسام'],
  P3: ['عالم الوسام', 'مزايا'],
  P4: ['مزايا', 'عالم الوسام'],
  P5: ['الصندوق المناسب', 'أمجاد كميت'],
  P6: ['أمجاد كميت', 'الصندوق المناسب'],
  P7: ['مزايا', 'عالم الوسام'],
  P8: ['أمجاد كميت', 'الصندوق المناسب'],
  P9: ['عالم الوسام', 'أمجاد كميت', 'مزايا'],
  P10: ['مزايا', 'عالم الوسام'],
  P11: ['الصندوق المناسب', 'مزايا', 'عالم الوسام'],
};

/**
 * Returns the approved suppliers list for a given item code.
 * Falls back to all approved suppliers if the code has no explicit mapping.
 */
export const getApprovedSuppliersForItem = (itemCode: string): ApprovedSupplier[] => {
  const code = (itemCode || '').trim().toUpperCase();
  const allowedNames = ITEM_APPROVED_SUPPLIERS[code] || APPROVED_SUPPLIERS.map(s => s.name);
  return APPROVED_SUPPLIERS.filter(s =>
    allowedNames.includes(s.name) || (s.name === 'أمجاد كميت' && allowedNames.includes('أمجد كميت'))
  );
};

