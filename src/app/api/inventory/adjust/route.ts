import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { compareItemCodes, STANDARD_ITEM_CODES } from '@/constants/inventoryCodes';

dayjs.extend(utc);
dayjs.extend(timezone);

const SAUDI_TZ = 'Asia/Riyadh';

const CUTOFF_ERROR_MESSAGE =
  'عفواً، لا يمكن إرجاع مكونات هذه الوجبة للمخزون. لقد تم تحضيرها وتغليفها بالفعل (تجاوزت الساعة 9 مساءً من يوم التحضير).';

const CUTOFF_UI_WARNING_MESSAGE =
  '⚠️ تم تحضير الوجبة مسبقاً (تجاوزت الساعة 9 مساءً من يوم التحضير). لا يمكن إرجاع المواد للمخزون.';

export interface AdjustmentRequestItem {
  item_code: string;
  adjustment_type: 'add' | 'deduct' | 'redirect' | string;
  quantity: number;
  reason: string;
  notes?: string;
  reference_id?: string | number | null;
  target_date?: string | null;
  employee_name?: string;
  isAdminOverride?: boolean;
  allowRedirect?: boolean;
  isRedirect?: boolean;
  forceRedirect?: boolean;
}

interface ValidatedAdjustmentItem {
  item_code: string;
  requested_adjustment_type: 'add' | 'deduct' | 'redirect';
  final_adjustment_type: 'add' | 'deduct' | 'redirect';
  quantity: number;
  reason: string;
  notes: string;
  reference_id: string | null;
  target_date: string | null;
  employee_name: string;
  isAdminOverride: boolean;
  wasRedirectedDueToCutoff: boolean;
}

function normalizeDigits(str: string): string {
  return str
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();
}

function normalizeAdjustmentType(raw: unknown): 'add' | 'deduct' | 'redirect' | null {
  if (typeof raw !== 'string') return null;
  const val = raw.trim().toLowerCase();
  if (val === 'add' || val === 'إضافة' || val === 'إضافة رصيد') {
    return 'add';
  }
  if (val === 'deduct' || val === 'خصم' || val === 'خصم رصيد') {
    return 'deduct';
  }
  if (val === 'redirect' || val === 'تحويل' || val === 'إعادة توجيه' || val === 'توجيه') {
    return 'redirect';
  }
  return null;
}

function isDeconstructionReason(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes('تفكيك') ||
    lower.includes('إلغاء اشتراك') ||
    lower.includes('الغاء اشتراك') ||
    lower.includes('إلغاء وجبة') ||
    lower.includes('الغاء وجبة') ||
    lower.includes('تجميد') ||
    lower.includes('deconstruct') ||
    lower.includes('cancel')
  );
}

/**
 * Evaluates the Kitchen Cut-off Rule in Saudi Time (AST / Asia/Riyadh):
 * - Prep Day is exactly 2 days before `target_date` (delivery date).
 * - Absolute deadline is 9:00 PM (21:00:00) AST on the Prep Day.
 */
export function evaluateMealCutoff(targetDateRaw: string, nowOverrideAST?: dayjs.Dayjs) {
  const cleanDate = normalizeDigits(targetDateRaw).split('T')[0];
  const isDateFormatValid = /^\d{4}-\d{2}-\d{2}$/.test(cleanDate);

  if (!isDateFormatValid) {
    return { valid: false as const, cleanDate };
  }

  const deliveryDayAST = dayjs.tz(cleanDate, SAUDI_TZ).startOf('day');
  if (!deliveryDayAST.isValid()) {
    return { valid: false as const, cleanDate };
  }

  // Kitchen prepares meals 2 days before delivery date
  const prepDayAST = deliveryDayAST.subtract(2, 'day');
  // Cut-off is 9:00 PM (21:00:00.000) AST on the Prep Day
  const cutoffDeadlineAST = prepDayAST.hour(21).minute(0).second(0).millisecond(0);
  const currentAST = nowOverrideAST || dayjs().tz(SAUDI_TZ);

  const isCutoffExceeded = currentAST.isAfter(cutoffDeadlineAST);

  return {
    valid: true as const,
    cleanDate,
    deliveryDayAST,
    prepDayAST,
    cutoffDeadlineAST,
    currentAST,
    isCutoffExceeded,
  };
}

/**
 * Derives meal slots and P7 cutlery count from Zahi package name.
 */
function parsePackageStructure(packageName: string) {
  const pkg = (packageName || '').trim();
  const hasBreakfast = pkg.includes('فطور');

  let mainMealsCount = 1;
  if (pkg.includes('3 وجبات')) {
    mainMealsCount = 3;
  } else if (pkg.includes('وجبتين')) {
    mainMealsCount = 2;
  } else {
    mainMealsCount = 1;
  }

  const hasSnack = pkg.includes('سناك') || !pkg;

  // P7 (Cutlery) logic: 1 for 'غداء العمل', otherwise 2 (or 3 for 3-meal packages)
  const p7Quantity = pkg.includes('غداء العمل') || pkg.includes('منيو العمل') ? 1 : 2;
  // P8 (Zahi Printed Bag): always 1 per subscription delivery
  const p8Quantity = 1;

  return {
    hasBreakfast,
    mainMealsCount,
    hasSnack,
    p7Quantity,
    p8Quantity,
  };
}

/**
 * GET /api/inventory/adjust?subscription_id=...&target_date=...
 * Fetches subscription meal & package data and computes the BOM deconstruction preview
 * alongside the 9:00 PM AST Prep Day cut-off check.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawSubId = normalizeDigits(searchParams.get('subscription_id') || '');
    const rawTargetDate = normalizeDigits(searchParams.get('target_date') || '');
    const packageOverride = (searchParams.get('package_name') || '').trim();
    const customMealCodesParam = (searchParams.get('meal_codes') || '').trim();

    if (!rawSubId) {
      return NextResponse.json(
        { success: false, error: 'Missing subscription_id', message: 'يرجى إدخال رقم الاشتراك' },
        { status: 400 }
      );
    }

    if (!rawTargetDate) {
      return NextResponse.json(
        { success: false, error: 'Missing target_date', message: 'يرجى تحديد تاريخ الإلغاء' },
        { status: 400 }
      );
    }

    const cutoffEval = evaluateMealCutoff(rawTargetDate);
    if (!cutoffEval.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid target_date',
          message: 'صيغة تاريخ الإلغاء غير صالحة. يرجى اختيار تاريخ صحيح.',
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Look up subscription in techrar_packaging_report (first on target_date, then latest record for subscription_number)
    const [exactDateRes, latestSubRes, menuRes, bomRes, invRes] = await Promise.all([
      supabaseAdmin
        .from('techrar_packaging_report')
        .select('*')
        .eq('subscription_number', rawSubId)
        .eq('report_date', cutoffEval.cleanDate)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('techrar_packaging_report')
        .select('*')
        .eq('subscription_number', rawSubId)
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('menu_items')
        .select('meal_code, meal_name_ar, meal_name_en, category_ar, category')
        .order('meal_code', { ascending: true }),
      supabaseAdmin
        .from('bom_packaging')
        .select('meal_code, inventory_item_code, quantity_used'),
      supabaseAdmin
        .from('inventory_items')
        .select('item_code, item_name_ar, current_stock'),
    ]);

    const matchedRow = exactDateRes.data || latestSubRes.data || null;
    const foundInDb = Boolean(matchedRow);
    const resolvedPackageName =
      packageOverride ||
      (matchedRow?.package_name && matchedRow.package_name !== '-'
        ? matchedRow.package_name
        : 'نزول وزن - وجبتين + 1 سناك');

    const customerName = matchedRow?.customer_name || `مشترك #${rawSubId}`;
    const district = matchedRow?.district || '-';
    const deliveryWindow = matchedRow?.delivery_window || '05:00 AM - 02:00 PM';
    const itemsCount = Number(matchedRow?.items_count) || 3;

    // 2. Build BOM map by meal_code
    const bomList = bomRes.data || [];
    const bomByMeal = new Map<string, Array<{ inventory_item_code: string; quantity_used: number }>>();
    for (const row of bomList) {
      const mCode = String(row.meal_code || '').trim();
      const iCode = String(row.inventory_item_code || '').trim().toUpperCase();
      const qty = Number(row.quantity_used) || 1;
      if (!mCode || !iCode) continue;
      if (!bomByMeal.has(mCode)) bomByMeal.set(mCode, []);
      bomByMeal.get(mCode)!.push({ inventory_item_code: iCode, quantity_used: qty });
    }

    const menuList = (menuRes.data || [])
      .filter((m) => bomByMeal.has(String(m.meal_code)))
      .map((m) => ({
        meal_code: String(m.meal_code),
        meal_name_ar: m.meal_name_ar || `وجبة ${m.meal_code}`,
        category_ar: m.category_ar || m.category || 'الوجبات الرئيسية',
        bom: bomByMeal.get(String(m.meal_code)) || [],
      }));

    const breakfastMeals = menuList.filter((m) => (m.category_ar || '').includes('الفطور'));
    const mainMeals = menuList.filter((m) => (m.category_ar || '').includes('الرئيسية'));
    const snackMeals = menuList.filter(
      (m) => (m.category_ar || '').includes('السلطات') || (m.category_ar || '').includes('الحلو')
    );

    const pkgStruct = parsePackageStructure(resolvedPackageName);
    const customMealCodes = customMealCodesParam
      ? customMealCodesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const mealSlots: Array<{
      slot_index: number;
      slot_label: string;
      category_filter: string;
      selected_meal_code: string;
      selected_meal_name_ar: string;
    }> = [];

    let slotIdx = 0;
    if (pkgStruct.hasBreakfast) {
      const defaultMeal = breakfastMeals[0] || menuList[0];
      const chosenCode = customMealCodes[slotIdx] || defaultMeal?.meal_code || '43004';
      const chosenMeal = menuList.find((m) => m.meal_code === chosenCode) || defaultMeal;
      mealSlots.push({
        slot_index: slotIdx,
        slot_label: 'وجبة الفطور',
        category_filter: 'الفطور',
        selected_meal_code: chosenMeal?.meal_code || '43004',
        selected_meal_name_ar: chosenMeal?.meal_name_ar || 'فول مع الطحينة',
      });
      slotIdx++;
    }

    for (let m = 0; m < pkgStruct.mainMealsCount; m++) {
      const defaultMeal = mainMeals[m % Math.max(1, mainMeals.length)] || menuList[0];
      const chosenCode = customMealCodes[slotIdx] || defaultMeal?.meal_code || '43022';
      const chosenMeal = menuList.find((item) => item.meal_code === chosenCode) || defaultMeal;
      mealSlots.push({
        slot_index: slotIdx,
        slot_label: pkgStruct.mainMealsCount > 1 ? `وجبة رئيسية (${m + 1})` : 'وجبة رئيسية',
        category_filter: 'الوجبات الرئيسية',
        selected_meal_code: chosenMeal?.meal_code || '43022',
        selected_meal_name_ar: chosenMeal?.meal_name_ar || 'كباب لحم مع ارز الزعفران',
      });
      slotIdx++;
    }

    if (pkgStruct.hasSnack) {
      const defaultSnack = snackMeals[0] || menuList[0];
      const chosenCode = customMealCodes[slotIdx] || defaultSnack?.meal_code || '43075';
      const chosenMeal = menuList.find((item) => item.meal_code === chosenCode) || defaultSnack;
      mealSlots.push({
        slot_index: slotIdx,
        slot_label: 'سناك (سلطة / حلا)',
        category_filter: 'سناك',
        selected_meal_code: chosenMeal?.meal_code || '43075',
        selected_meal_name_ar: chosenMeal?.meal_name_ar || 'سلطة يونانية',
      });
      slotIdx++;
    }

    // 3. Aggregate BOM quantities: P8 + P7 + meal BOM items
    const itemQuantities = new Map<string, { quantity: number; sources: Set<string> }>();

    const addComponent = (code: string, qty: number, sourceLabel: string) => {
      const upper = code.toUpperCase();
      const existing = itemQuantities.get(upper) || { quantity: 0, sources: new Set<string>() };
      existing.quantity += qty;
      existing.sources.add(sourceLabel);
      itemQuantities.set(upper, existing);
    };

    // Package-level P8 (Bag) and P7 (Cutlery)
    addComponent('P8', pkgStruct.p8Quantity, 'كيس التوصيل الأساسي (1 لكل اشتراك)');
    addComponent('P7', pkgStruct.p7Quantity, 'أدوات المائدة حسب الباقة');

    // Meal-level BOM items
    for (const slot of mealSlots) {
      const mealBom = bomByMeal.get(slot.selected_meal_code) || [];
      if (mealBom.length > 0) {
        for (const b of mealBom) {
          addComponent(
            b.inventory_item_code,
            b.quantity_used,
            `${slot.slot_label}: ${slot.selected_meal_name_ar}`
          );
        }
      } else {
        // Fallback standard BOM if meal has no explicit BOM rows
        addComponent('P1', 1, slot.slot_label);
        addComponent('P6', 1, slot.slot_label);
      }
    }

    // Map inventory names & current stock
    const invMap = new Map<string, { name_ar: string; current_stock: number }>();
    for (const std of STANDARD_ITEM_CODES) {
      invMap.set(std.code.toUpperCase(), { name_ar: std.nameAr, current_stock: 0 });
    }
    for (const item of invRes.data || []) {
      const c = String(item.item_code || '').trim().toUpperCase();
      if (c) {
        invMap.set(c, {
          name_ar: item.item_name_ar || invMap.get(c)?.name_ar || c,
          current_stock: Number(item.current_stock ?? 0),
        });
      }
    }

    const deconstructedItems = Array.from(itemQuantities.entries())
      .map(([code, info]) => {
        const meta = invMap.get(code);
        return {
          item_code: code,
          item_name_ar: meta?.name_ar || code,
          quantity: info.quantity,
          source: Array.from(info.sources).join(' + '),
          current_stock: meta?.current_stock ?? 0,
        };
      })
      .sort((a, b) => compareItemCodes(a.item_code, b.item_code));

    return NextResponse.json({
      success: true,
      subscription: {
        found_in_db: foundInDb,
        subscription_number: rawSubId,
        customer_name: customerName,
        package_name: resolvedPackageName,
        items_count: itemsCount,
        district,
        delivery_window: deliveryWindow,
        report_date: cutoffEval.cleanDate,
        matched_report_date: matchedRow?.report_date || null,
        status: matchedRow?.status || 'confirmed',
      },
      cutoff: {
        target_date: cutoffEval.cleanDate,
        prep_day: cutoffEval.prepDayAST.format('YYYY-MM-DD'),
        cutoff_deadline_ast: cutoffEval.cutoffDeadlineAST.format('YYYY-MM-DD HH:mm:ss'),
        current_time_ast: cutoffEval.currentAST.format('YYYY-MM-DD HH:mm:ss'),
        is_cutoff_exceeded: cutoffEval.isCutoffExceeded,
        warning_message: cutoffEval.isCutoffExceeded ? CUTOFF_UI_WARNING_MESSAGE : null,
      },
      meal_slots: mealSlots,
      menu_items: menuList,
      deconstructed_items: deconstructedItems,
    });
  } catch (error: unknown) {
    console.error('[GET /api/inventory/adjust] Error fetching meal data:', error);
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب بيانات الوجبة';
    return NextResponse.json(
      { success: false, error: message, message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid Payload', message: 'بيانات الطلب غير صالحة' },
        { status: 400 }
      );
    }

    // Resolve top-level flags and items array (supports direct array, { adjustments: [...] }, { items: [...] }, or single object)
    let rawItems: AdjustmentRequestItem[] = [];
    let topLevelAdminOverride = false;
    let topLevelAllowRedirect = false;
    let topLevelEmployeeName = '';
    let topLevelReferenceId: string | null = null;
    let topLevelTargetDate: string | null = null;

    if (Array.isArray(body)) {
      rawItems = body;
    } else {
      const record = body as Record<string, unknown>;
      topLevelAdminOverride = Boolean(record.isAdminOverride);
      topLevelAllowRedirect = Boolean(
        record.allowRedirect || record.isRedirect || record.forceRedirect || record.proceedAsRedirect
      );
      topLevelEmployeeName = typeof record.employee_name === 'string' ? record.employee_name.trim() : '';
      topLevelReferenceId =
        typeof record.reference_id === 'string' && record.reference_id.trim()
          ? record.reference_id.trim()
          : typeof record.reference_id === 'number'
          ? String(record.reference_id)
          : null;
      topLevelTargetDate =
        typeof record.target_date === 'string' && record.target_date.trim()
          ? record.target_date.trim()
          : null;

      if (Array.isArray(record.adjustments)) {
        rawItems = record.adjustments as AdjustmentRequestItem[];
      } else if (Array.isArray(record.items)) {
        rawItems = record.items as AdjustmentRequestItem[];
      } else if (Array.isArray(record.data)) {
        rawItems = record.data as AdjustmentRequestItem[];
      } else {
        rawItems = [record as unknown as AdjustmentRequestItem];
      }
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Empty Adjustments',
          message: 'يجب إرسال عنصر واحد على الأقل للتسوية المخزنية.',
        },
        { status: 400 }
      );
    }

    // Resolve authenticated employee name securely from active NextAuth session
    let sessionEmployeeName = '';
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        const u = session.user as {
          name_ar?: string;
          name_en?: string;
          name?: string | null;
          username?: string;
          email?: string;
        };
        sessionEmployeeName = (
          u.name_ar ||
          u.name_en ||
          u.name ||
          u.username ||
          u.email ||
          ''
        ).trim();
      }
    } catch (err) {
      console.warn('[POST /api/inventory/adjust] getServerSession warning:', err);
    }

    // Determine the authoritative employee name:
    // 1. Prefer authenticated session user (secure automated extraction)
    // 2. Fallback to explicitly provided employee name from payload (mandatory UI dropdown)
    const effectiveEmployeeName = (
      sessionEmployeeName ||
      topLevelEmployeeName ||
      (typeof rawItems[0]?.employee_name === 'string' ? rawItems[0].employee_name.trim() : '')
    ).trim();

    if (!effectiveEmployeeName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing Employee',
          message: 'اسم الموظف المسؤول عن العملية إلزامي للرقابة والتدقيق المخزني. يرجى اختيار اسم الموظف.',
        },
        { status: 400 }
      );
    }

    const defaultEmployeeName = effectiveEmployeeName;

    // Phase 1: Validate all items & enforce Smart Block / Cut-off Time rule atomically before writing to DB
    const validatedItems: ValidatedAdjustmentItem[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      if (!raw || typeof raw !== 'object') {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid Item',
            message: `بيانات العنصر رقم (${i + 1}) غير صالحة.`,
          },
          { status: 400 }
        );
      }

      const item_code = typeof raw.item_code === 'string' ? raw.item_code.trim().toUpperCase() : '';
      if (!item_code) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing item_code',
            message: 'يرجى تحديد رمز الصنف (item_code)',
          },
          { status: 400 }
        );
      }

      const normalizedType = normalizeAdjustmentType(raw.adjustment_type);
      if (!normalizedType) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid adjustment_type',
            message: 'نوع التسوية غير صالح (يجب أن يكون add أو deduct أو redirect)',
          },
          { status: 400 }
        );
      }

      const numQuantity = Number(raw.quantity);
      if (!Number.isFinite(numQuantity) || numQuantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid quantity',
            message: `الكمية للصنف (${item_code}) يجب أن تكون رقماً موجباً أكبر من صفر`,
          },
          { status: 400 }
        );
      }

      const reason = typeof raw.reason === 'string' ? raw.reason.trim() : '';
      if (!reason) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing reason',
            message: `يرجى تحديد سبب التسوية للصنف (${item_code})`,
          },
          { status: 400 }
        );
      }

      const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';
      const reference_id =
        typeof raw.reference_id === 'string' && raw.reference_id.trim()
          ? raw.reference_id.trim()
          : typeof raw.reference_id === 'number'
          ? String(raw.reference_id)
          : topLevelReferenceId;

      const target_date =
        typeof raw.target_date === 'string' && raw.target_date.trim()
          ? raw.target_date.trim()
          : topLevelTargetDate;

      const employee_name =
        typeof raw.employee_name === 'string' && raw.employee_name.trim()
          ? raw.employee_name.trim()
          : defaultEmployeeName;

      const isAdminOverride = Boolean(raw.isAdminOverride ?? topLevelAdminOverride);
      const allowRedirect = Boolean(
        raw.allowRedirect ?? raw.isRedirect ?? raw.forceRedirect ?? topLevelAllowRedirect
      );

      let finalAdjustmentType: 'add' | 'deduct' | 'redirect' = normalizedType;
      let wasRedirectedDueToCutoff = false;

      // Check if this 'add' adjustment is linked to a meal cancellation / Subscription Deconstruction
      const isLinkedToDeconstruction =
        Boolean(target_date) || Boolean(reference_id) || isDeconstructionReason(reason);

      if (normalizedType === 'add' && isLinkedToDeconstruction) {
        if (!target_date) {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing target_date',
              message: 'تاريخ توصيل الوجبة (target_date) مطلوب لعمليات تفكيك الاشتراك وإرجاع المكونات للمخزون.',
            },
            { status: 400 }
          );
        }

        const cutoffEval = evaluateMealCutoff(target_date);
        if (!cutoffEval.valid) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid target_date',
              message: `صيغة تاريخ توصيل الوجبة (${target_date}) غير صالحة. يرجى استخدام الصيغة YYYY-MM-DD.`,
            },
            { status: 400 }
          );
        }

        if (cutoffEval.isCutoffExceeded) {
          if (isAdminOverride) {
            // Admin Override: bypass Cut-off time block and process inventory return ('add')
            finalAdjustmentType = 'add';
          } else if (allowRedirect) {
            // Redirect Action: user proceeds without Admin Override -> change 'add' to 'redirect'
            finalAdjustmentType = 'redirect';
            wasRedirectedDueToCutoff = true;
          } else {
            // Smart Block: Cut-off Exceeded
            return NextResponse.json(
              {
                success: false,
                error: 'Cut-off Exceeded',
                message: CUTOFF_ERROR_MESSAGE,
                cutoffDetails: {
                  item_code,
                  reference_id,
                  target_date: cutoffEval.cleanDate,
                  prep_day: cutoffEval.prepDayAST.format('YYYY-MM-DD'),
                  cutoff_deadline_ast: cutoffEval.cutoffDeadlineAST.format('YYYY-MM-DD HH:mm:ss'),
                  current_time_ast: cutoffEval.currentAST.format('YYYY-MM-DD HH:mm:ss'),
                },
              },
              { status: 400 }
            );
          }
        }
      }

      validatedItems.push({
        item_code,
        requested_adjustment_type: normalizedType,
        final_adjustment_type: finalAdjustmentType,
        quantity: Math.floor(numQuantity),
        reason,
        notes,
        reference_id,
        target_date: target_date ? normalizeDigits(target_date).split('T')[0] : null,
        employee_name,
        isAdminOverride,
        wasRedirectedDueToCutoff,
      });
    }

    // Phase 2: Execute RPC calls in Supabase
    const supabaseAdmin = getSupabaseAdmin();
    const results: Array<{
      item_code: string;
      adjustment_type: 'add' | 'deduct' | 'redirect';
      requested_adjustment_type: 'add' | 'deduct' | 'redirect';
      quantity: number;
      reason: string;
      notes: string;
      reference_id: string | null;
      target_date: string | null;
      employee_name: string;
      isAdminOverride: boolean;
      wasRedirectedDueToCutoff: boolean;
      rpcData: unknown;
    }> = [];

    for (const item of validatedItems) {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('process_manual_adjustment', {
        p_item_code: item.item_code,
        p_adj_type: item.final_adjustment_type,
        p_quantity: item.quantity,
        p_reason: item.reason,
        p_notes: item.notes,
        p_reference_id: item.reference_id,
        p_employee_name: item.employee_name,
      });

      if (rpcError) {
        console.warn(`[POST /api/inventory/adjust] RPC error for item ${item.item_code}:`, rpcError);

        let fallbackSucceeded = false;
        try {
          // Resilient Fallback: Direct database stock update + explicit audit log insertion
          const { data: invRow } = await supabaseAdmin
            .from('inventory_items')
            .select('current_stock')
            .eq('item_code', item.item_code)
            .single();

          if (invRow) {
            const curStock = Number(invRow.current_stock ?? 0);
            const delta =
              item.final_adjustment_type === 'add'
                ? item.quantity
                : item.final_adjustment_type === 'deduct'
                ? -item.quantity
                : 0;
            const nextStock = Math.max(0, curStock + delta);

            if (delta !== 0) {
              await supabaseAdmin
                .from('inventory_items')
                .update({ current_stock: nextStock })
                .eq('item_code', item.item_code);
            }

            await supabaseAdmin
              .from('manual_adjustments_log')
              .insert({
                item_code: item.item_code,
                adjustment_type: item.final_adjustment_type,
                quantity: item.quantity,
                reason: item.reason,
                notes: item.notes,
                reference_id: item.reference_id,
                employee_name: item.employee_name,
              });

            fallbackSucceeded = true;
          }
        } catch (fbErr) {
          console.error(`[POST /api/inventory/adjust] Direct DB fallback failed for ${item.item_code}:`, fbErr);
        }

        if (!fallbackSucceeded) {
          return NextResponse.json(
            {
              success: false,
              error: rpcError.message || 'حدث خطأ أثناء تنفيذ التسوية المخزنية في قاعدة البيانات',
              message: rpcError.message || 'حدث خطأ أثناء تنفيذ التسوية المخزنية في قاعدة البيانات',
              failed_item_code: item.item_code,
            },
            { status: 400 }
          );
        }
      }

      results.push({
        item_code: item.item_code,
        adjustment_type: item.final_adjustment_type,
        requested_adjustment_type: item.requested_adjustment_type,
        quantity: item.quantity,
        reason: item.reason,
        notes: item.notes,
        reference_id: item.reference_id,
        target_date: item.target_date,
        employee_name: item.employee_name,
        isAdminOverride: item.isAdminOverride,
        wasRedirectedDueToCutoff: item.wasRedirectedDueToCutoff,
        rpcData,
      });
    }

    // Fetch updated stock balances for all affected items
    const uniqueItemCodes = Array.from(new Set(validatedItems.map((i) => i.item_code)));
    const { data: updatedItems } = await supabaseAdmin
      .from('inventory_items')
      .select('item_code, item_name_ar, current_stock')
      .in('item_code', uniqueItemCodes);

    const firstResult = results[0];
    const firstUpdatedItem =
      updatedItems?.find((u) => u.item_code.toUpperCase() === firstResult.item_code) || null;

    const allRedirected = results.every((r) => r.adjustment_type === 'redirect');
    const summaryMessage =
      results.length === 1
        ? firstResult.adjustment_type === 'redirect'
          ? `تم تسجيل توجيه الوجبة للصنف (${firstResult.item_code}) في السجل دون إرجاع للمخزون الفعلي`
          : `تمت تسوية رصيد الصنف (${firstResult.item_code}) بنجاح`
        : allRedirected
        ? `تم تسجيل توجيه (${results.length}) أصناف للتوالف في سجل العمليات دون إرجاع للمخزون الفعلي`
        : `تم إرجاع وتفكيك (${results.length}) أصناف إلى المخزون الفعلي بنجاح`;

    return NextResponse.json({
      success: true,
      message: summaryMessage,
      results,
      updatedItems: updatedItems || [],
      data: {
        ...firstResult,
        updatedItem: firstUpdatedItem,
        results,
        updatedItems: updatedItems || [],
      },
    });
  } catch (error: unknown) {
    console.error('[POST /api/inventory/adjust] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع في الخادم';
    return NextResponse.json(
      { success: false, error: message, message },
      { status: 500 }
    );
  }
}
