import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

const DEFAULT_N8N_TICKETS_WEBHOOK_URL =
  'https://n8n.zahi-control-tower.local/webhook/tickets-notification';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUBSCRIPTION_ID_REGEX = /^\d{3,15}$/;

function toEnglishDigits(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
}

function validateSubscriptionIdValue(raw: unknown): {
  valid: boolean;
  value: string;
  error?: string;
} {
  const cleaned = toEnglishDigits(raw);
  if (!cleaned) {
    return {
      valid: false,
      value: '',
      error: 'يرجى إدخال رقم الاشتراك (Subscription ID).',
    };
  }
  if (!SUBSCRIPTION_ID_REGEX.test(cleaned)) {
    return {
      valid: false,
      value: cleaned,
      error: 'رقم الاشتراك يجب أن يتكون من أرقام إنجليزية صحيحة فقط (3 إلى 15 رقماً).',
    };
  }
  return { valid: true, value: cleaned };
}

function isAdminRole(role: unknown): boolean {
  const r = String(role || '').trim().toLowerCase();
  return r === 'admin' || r === 'superadmin';
}

function getDbClient() {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return getSupabaseAdmin();
    }
  } catch {
    // Fallback to standard client
  }
  return supabase;
}

function normalizePriority(raw: unknown): 'high' | 'medium' | 'low' {
  const val = String(raw || 'medium').trim().toLowerCase();
  if (val === 'high' || val === 'عالية' || val === 'مرتفعة' || val === 'عاجل') {
    return 'high';
  }
  if (val === 'low' || val === 'منخفضة' || val === 'منخفض') {
    return 'low';
  }
  return 'medium';
}

/**
 * Canonical storage status using SLA Title Case ('Open' | 'In Progress' | 'Resolved').
 */
function normalizeStorageStatus(raw: unknown): 'Open' | 'In Progress' | 'Resolved' {
  const val = String(raw || 'Open').trim().toLowerCase();
  if (val === 'resolved' || val === 'closed' || val === 'تم الحل' || val === 'مغلقة') {
    return 'Resolved';
  }
  if (
    val === 'in_progress' ||
    val === 'in-progress' ||
    val === 'in progress' ||
    val === 'قيد التنفيذ' ||
    val === 'قيد المعالجة'
  ) {
    return 'In Progress';
  }
  return 'Open';
}

function toLegacyLowerStatus(
  canonical: 'Open' | 'In Progress' | 'Resolved'
): 'open' | 'in_progress' | 'resolved' {
  if (canonical === 'Resolved') return 'resolved';
  if (canonical === 'In Progress') return 'in_progress';
  return 'open';
}

function toStatusCategory(raw: unknown): 'open' | 'in_progress' | 'resolved' {
  return toLegacyLowerStatus(normalizeStorageStatus(raw));
}

function isMissingSchemaColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = String(err.code || '').trim();
  const msg = String(err.message || '');
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column/i.test(msg)
  );
}

interface RawTicketRow extends Record<string, unknown> {
  id: string;
  department?: string | null;
  assigned_department?: string | null;
  resolved_by?: string | null;
  resolution_action?: string | null;
  resolution_notes?: string | null;
}

/**
 * Parses legacy packed notes (`[Action] - notes - (بواسطة: username)`) when
 * native SLA columns have not yet been added in Postgres.
 */
function parseLegacyPackedResolution(notes: string | null | undefined): {
  action: string | null;
  resolver: string | null;
} {
  if (!notes) return { action: null, resolver: null };
  const actionMatch = notes.match(/^\[([^\]]+)\]/);
  const resolverMatch = notes.match(/\(بواسطة:\s*([^)]+)\)\s*$/);
  return {
    action: actionMatch?.[1]?.trim() || null,
    resolver: resolverMatch?.[1]?.trim() || null,
  };
}

/**
 * Enriches ticket records with `department`, `assigned_department`,
 * `resolved_by_username` (joined from `app_users`), and fallback parsed fields.
 */
async function enrichTickets(
  db: ReturnType<typeof getDbClient>,
  rows: RawTicketRow[]
): Promise<RawTicketRow[]> {
  if (!rows.length) return rows;

  const userIds = Array.from(
    new Set(
      rows
        .map((r) => (typeof r.resolved_by === 'string' ? r.resolved_by.trim() : ''))
        .filter((val) => UUID_REGEX.test(val))
    )
  );

  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: usersData } = await db
      .from('app_users')
      .select('id, username')
      .in('id', userIds);

    for (const u of usersData || []) {
      if (u?.id && u?.username) {
        userMap.set(String(u.id), String(u.username));
      }
    }
  }

  return rows.map((row) => {
    const dept =
      (typeof row.department === 'string' && row.department.trim()) ||
      (typeof row.assigned_department === 'string' && row.assigned_department.trim()) ||
      'إدارة';

    const rawResolvedBy =
      typeof row.resolved_by === 'string' ? row.resolved_by.trim() : '';

    const legacyParsed = parseLegacyPackedResolution(
      typeof row.resolution_notes === 'string' ? row.resolution_notes : null
    );

    const resolvedByUsername =
      (rawResolvedBy && userMap.get(rawResolvedBy)) ||
      (rawResolvedBy && !UUID_REGEX.test(rawResolvedBy) ? rawResolvedBy : null) ||
      legacyParsed.resolver ||
      null;

    const resolutionAction =
      (typeof row.resolution_action === 'string' && row.resolution_action.trim()) ||
      legacyParsed.action ||
      null;

    return {
      ...row,
      department: dept,
      assigned_department:
        (typeof row.assigned_department === 'string' && row.assigned_department.trim()) ||
        dept,
      resolved_by_username: resolvedByUsername,
      resolution_action: resolutionAction,
    };
  });
}

async function resolveUserIdentifier(
  db: ReturnType<typeof getDbClient>,
  rawIdentifier: string
): Promise<{ userId: string | null; username: string }> {
  const cleaned = rawIdentifier.trim();
  if (!cleaned) return { userId: null, username: '' };

  if (UUID_REGEX.test(cleaned)) {
    const { data } = await db
      .from('app_users')
      .select('id, username')
      .eq('id', cleaned)
      .maybeSingle();
    return {
      userId: data?.id ? String(data.id) : cleaned,
      username: data?.username ? String(data.username) : cleaned,
    };
  }

  const { data } = await db
    .from('app_users')
    .select('id, username')
    .ilike('username', cleaned)
    .maybeSingle();

  return {
    userId: data?.id ? String(data.id) : null,
    username: data?.username ? String(data.username) : cleaned,
  };
}

/**
 * GET /api/tickets
 * Fetches all tickets ordered by newest first, enriched with `app_users.username`.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = (searchParams.get('status') || '').trim();
    const priorityFilter = (searchParams.get('priority') || '').trim().toLowerCase();
    const departmentFilter = (
      searchParams.get('department') ||
      searchParams.get('assigned_department') ||
      ''
    ).trim();

    const db = getDbClient();
    const { data, error } = await db
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database Error',
          message: error.message,
        },
        { status: 500 }
      );
    }

    const enriched = await enrichTickets(db, (data || []) as RawTicketRow[]);

    const filtered = enriched.filter((row) => {
      if (statusFilter && statusFilter.toLowerCase() !== 'all') {
        if (toStatusCategory(row.status) !== toStatusCategory(statusFilter)) {
          return false;
        }
      }
      if (priorityFilter && priorityFilter !== 'all') {
        if (normalizePriority(row.priority) !== normalizePriority(priorityFilter)) {
          return false;
        }
      }
      if (departmentFilter && departmentFilter.toLowerCase() !== 'all') {
        const rowDept = String(row.department || row.assigned_department || '').trim();
        if (rowDept !== departmentFilter) {
          return false;
        }
      }
      return true;
    });

    return NextResponse.json(
      {
        success: true,
        count: filtered.length,
        tickets: filtered,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets
 * Creates a new ticket in `tickets` with SLA start timestamp and `status: 'Open'`,
 * and triggers the n8n Webhook asynchronously.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUserName =
      session?.user?.name ||
      session?.user?.email ||
      'موظف العمليات';

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON',
          message: 'صيغة البيانات المرسلة غير صالحة.',
        },
        { status: 400 }
      );
    }

    const subValidation = validateSubscriptionIdValue(body.subscription_id);
    if (!subValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: subValidation.error,
        },
        { status: 400 }
      );
    }

    const subscription_id = subValidation.value;
    const customer_name = String(body.customer_name || '').trim() || null;
    const issue_type = String(body.issue_type || '').trim();
    const priority = normalizePriority(body.priority);
    const description = String(body.description || '').trim();
    const department =
      String(body.department || body.assigned_department || 'إدارة').trim() || 'إدارة';
    const created_by = String(body.created_by || sessionUserName).trim() || 'موظف العمليات';
    const created_at =
      typeof body.created_at === 'string' && !Number.isNaN(Date.parse(body.created_at))
        ? new Date(body.created_at).toISOString()
        : new Date().toISOString();

    if (!issue_type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'يرجى تحديد نوع التذكرة (تعويض، شكوى، استفسار، تأخير).',
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'يرجى إدخال وصف وتفاصيل المشكلة.',
        },
        { status: 400 }
      );
    }

    const db = getDbClient();

    // Primary SLA insert payload (requires `department` column from migration)
    const slaInsertPayload = {
      subscription_id,
      customer_name,
      department,
      assigned_department: department,
      issue_type,
      priority,
      status: 'Open',
      description,
      created_by,
      created_at,
    };

    let { data: insertedTicket, error: insertError } = await db
      .from('tickets')
      .insert(slaInsertPayload)
      .select('*')
      .single();

    let schemaMigrationPending = false;

    // Graceful compatibility fallback if legacy table doesn't have `department` column yet
    if (insertError && isMissingSchemaColumnError(insertError)) {
      schemaMigrationPending = true;
      const legacyInsertPayload = {
        subscription_id,
        customer_name,
        assigned_department: department,
        issue_type,
        priority,
        status: 'Open',
        description,
        created_by,
        created_at,
      };
      const fallbackRes = await db
        .from('tickets')
        .insert(legacyInsertPayload)
        .select('*')
        .single();
      insertedTicket = fallbackRes.data;
      insertError = fallbackRes.error;
    }

    if (insertError || !insertedTicket) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database Insert Failed',
          message: insertError?.message || 'تعذر حفظ التذكرة في قاعدة البيانات.',
        },
        { status: 500 }
      );
    }

    const [enrichedTicket] = await enrichTickets(db, [insertedTicket as RawTicketRow]);

    // Asynchronous n8n Webhook Trigger for WhatsApp / Email Automation
    const webhookUrl =
      (process.env.N8N_TICKETS_WEBHOOK_URL || '').trim() ||
      DEFAULT_N8N_TICKETS_WEBHOOK_URL;

    void fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'Zahi-Control-Tower-Tickets',
      },
      body: JSON.stringify({
        event: 'ticket.created',
        timestamp: new Date().toISOString(),
        ticket: enrichedTicket,
      }),
    }).catch((webhookErr: unknown) => {
      console.warn(
        '[Tickets Webhook] Non-blocking webhook notification warning:',
        webhookErr instanceof Error ? webhookErr.message : webhookErr
      );
    });

    return NextResponse.json(
      {
        success: true,
        message: 'تم إنشاء التذكرة بنجاح وإرسال إشعار الأتمتة.',
        ticket: enrichedTicket,
        ...(schemaMigrationPending ? { schema_migration_pending: true } : {}),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tickets
 * Updates ticket status (e.g., 'In Progress' or 'Resolved'), captures SLA closure timestamp,
 * `resolved_by` UUID (`app_users.id`), `resolution_action`, and `resolution_notes`.
 */
export async function PATCH(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON',
          message: 'صيغة البيانات المرسلة غير صالحة.',
        },
        { status: 400 }
      );
    }

    const id = String(body.id || '').trim();
    const ticketNumber = body.ticket_number ? Number(body.ticket_number) : null;

    if (!id && !ticketNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'معرف التذكرة (id أو ticket_number) مطلوب لتحديث الحالة.',
        },
        { status: 400 }
      );
    }

    const db = getDbClient();
    const hasStatusChange = body.status !== undefined;
    const nextStatus = hasStatusChange ? normalizeStorageStatus(body.status) : undefined;
    const resolutionAction =
      typeof body.resolution_action === 'string' ? body.resolution_action.trim() : '';
    const rawResolvedBy =
      typeof body.resolved_by === 'string' ? body.resolved_by.trim() : '';
    const rawNotes =
      body.resolution_notes !== undefined
        ? String(body.resolution_notes || '').trim()
        : undefined;

    const { userId: resolvedByUuid, username: resolvedByUsername } =
      await resolveUserIdentifier(db, rawResolvedBy);

    const slaUpdateFields: Record<string, unknown> = {};

    if (nextStatus !== undefined) {
      slaUpdateFields.status = nextStatus;
    }

    if (body.subscription_id !== undefined) {
      const subValidation = validateSubscriptionIdValue(body.subscription_id);
      if (!subValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation Error',
            message: subValidation.error,
          },
          { status: 400 }
        );
      }
      slaUpdateFields.subscription_id = subValidation.value;
    }

    if (body.customer_name !== undefined) {
      slaUpdateFields.customer_name = String(body.customer_name || '').trim() || null;
    }

    if (body.issue_type !== undefined) {
      const trimmedIssue = String(body.issue_type || '').trim();
      if (!trimmedIssue) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation Error',
            message: 'يرجى تحديد نوع التذكرة.',
          },
          { status: 400 }
        );
      }
      slaUpdateFields.issue_type = trimmedIssue;
    }

    if (body.description !== undefined) {
      const trimmedDesc = String(body.description || '').trim();
      if (!trimmedDesc) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation Error',
            message: 'يرجى إدخال وصف وتفاصيل التذكرة.',
          },
          { status: 400 }
        );
      }
      slaUpdateFields.description = trimmedDesc;
    }

    if (rawNotes !== undefined) {
      slaUpdateFields.resolution_notes = rawNotes || null;
    }

    if (resolutionAction) {
      slaUpdateFields.resolution_action = resolutionAction;
    } else if (hasStatusChange && nextStatus !== 'Resolved' && body.resolution_action === null) {
      slaUpdateFields.resolution_action = null;
    }

    if (resolvedByUuid) {
      slaUpdateFields.resolved_by = resolvedByUuid;
    }

    if (body.priority !== undefined) {
      slaUpdateFields.priority = normalizePriority(body.priority);
    }

    const incomingDept = body.department ?? body.assigned_department;
    if (incomingDept !== undefined) {
      const deptVal = String(incomingDept).trim();
      slaUpdateFields.department = deptVal;
      slaUpdateFields.assigned_department = deptVal;
    }

    if (nextStatus === 'Resolved') {
      const resolvedTimestamp = new Date().toISOString();
      slaUpdateFields.resolved_at =
        typeof body.resolved_at === 'string' && !Number.isNaN(Date.parse(body.resolved_at))
          ? new Date(body.resolved_at).toISOString()
          : resolvedTimestamp;
    } else if (
      hasStatusChange &&
      (body.resolved_at === null || nextStatus === 'Open' || nextStatus === 'In Progress')
    ) {
      slaUpdateFields.resolved_at = null;
    }

    const executeUpdate = async (fields: Record<string, unknown>) => {
      let query = db.from('tickets').update(fields);
      if (id) {
        query = query.eq('id', id);
      } else if (ticketNumber) {
        query = query.eq('ticket_number', ticketNumber);
      }
      return query.select('*').single();
    };

    let { data: updatedTicket, error: updateError } = await executeUpdate(slaUpdateFields);
    let schemaMigrationPending = false;

    // Graceful compatibility fallback if `resolved_by` / `resolution_action` / `department`
    // have not yet been added in Postgres.
    if (updateError && isMissingSchemaColumnError(updateError)) {
      schemaMigrationPending = true;

      let legacyNotes: string | null | undefined = rawNotes;
      if (rawNotes !== undefined || resolutionAction || resolvedByUsername) {
        const parts: string[] = [];
        const baseNotes = rawNotes || '';
        if (resolutionAction && !baseNotes.includes(resolutionAction)) {
          parts.push(`[${resolutionAction}]`);
        }
        if (baseNotes) {
          parts.push(baseNotes);
        }
        if (resolvedByUsername && !baseNotes.includes(resolvedByUsername)) {
          parts.push(`(بواسطة: ${resolvedByUsername})`);
        }
        legacyNotes = parts.join(' - ').trim() || null;
      }

      const legacyUpdateFields: Record<string, unknown> = {};
      if (slaUpdateFields.status !== undefined) {
        legacyUpdateFields.status = slaUpdateFields.status;
      }
      if (legacyNotes !== undefined) {
        legacyUpdateFields.resolution_notes = legacyNotes;
      }
      if (slaUpdateFields.subscription_id !== undefined) {
        legacyUpdateFields.subscription_id = slaUpdateFields.subscription_id;
      }
      if (slaUpdateFields.customer_name !== undefined) {
        legacyUpdateFields.customer_name = slaUpdateFields.customer_name;
      }
      if (slaUpdateFields.issue_type !== undefined) {
        legacyUpdateFields.issue_type = slaUpdateFields.issue_type;
      }
      if (slaUpdateFields.description !== undefined) {
        legacyUpdateFields.description = slaUpdateFields.description;
      }
      if (slaUpdateFields.priority !== undefined) {
        legacyUpdateFields.priority = slaUpdateFields.priority;
      }
      if (slaUpdateFields.assigned_department !== undefined) {
        legacyUpdateFields.assigned_department = slaUpdateFields.assigned_department;
      }
      if (slaUpdateFields.resolved_at !== undefined) {
        legacyUpdateFields.resolved_at = slaUpdateFields.resolved_at;
      }

      const fallbackRes = await executeUpdate(legacyUpdateFields);
      updatedTicket = fallbackRes.data;
      updateError = fallbackRes.error;
    }

    if (updateError || !updatedTicket) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database Update Failed',
          message: updateError?.message || 'تعذر تحديث بيانات التذكرة.',
        },
        { status: 500 }
      );
    }

    const [enrichedTicket] = await enrichTickets(db, [updatedTicket as RawTicketRow]);

    return NextResponse.json(
      {
        success: true,
        message:
          nextStatus === 'Resolved'
            ? 'تم إغلاق التذكرة وحفظ بيانات الـ SLA بنجاح.'
            : hasStatusChange
              ? 'تم تحديث حالة التذكرة بنجاح.'
              : 'تم تعديل بيانات التذكرة بنجاح.',
        ticket: enrichedTicket,
        ...(schemaMigrationPending ? { schema_migration_pending: true } : {}),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tickets
 * Deletes a ticket from `tickets`. Requires ADMIN or SUPERADMIN session role.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'يرجى تسجيل الدخول أولاً.',
        },
        { status: 401 }
      );
    }

    const userRole = (session.user as { role?: string } | undefined)?.role;
    if (!isAdminRole(userRole)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'صلاحية الأدمن مطلوبة لحذف التذاكر (Admin / SuperAdmin).',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    let id = (searchParams.get('id') || '').trim();

    if (!id) {
      const body = await request.json().catch(() => null);
      if (body && typeof body.id === 'string') {
        id = body.id.trim();
      }
    }

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'معرف التذكرة (id) مطلوب للحذف.',
        },
        { status: 400 }
      );
    }

    const db = getDbClient();
    const { data: deleted, error: deleteError } = await db
      .from('tickets')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database Delete Failed',
          message: deleteError.message,
        },
        { status: 500 }
      );
    }

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: 'التذكرة غير موجودة أو تم حذفها مسبقاً.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'تم حذف التذكرة بنجاح.',
        deletedId: deleted.id,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message,
      },
      { status: 500 }
    );
  }
}
