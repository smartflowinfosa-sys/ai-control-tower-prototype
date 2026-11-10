import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

const DEFAULT_N8N_TICKETS_WEBHOOK_URL =
  'https://n8n.zahi-control-tower.local/webhook/tickets-notification';

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

function normalizeStatus(raw: unknown): 'open' | 'in_progress' | 'resolved' {
  const val = String(raw || 'open').trim().toLowerCase();
  if (val === 'resolved' || val === 'closed' || val === 'تم الحل' || val === 'مغلقة') {
    return 'resolved';
  }
  if (val === 'in_progress' || val === 'in-progress' || val === 'قيد التنفيذ' || val === 'قيد المعالجة') {
    return 'in_progress';
  }
  return 'open';
}

/**
 * GET /api/tickets
 * Fetches all tickets ordered by newest first.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = (searchParams.get('status') || '').trim().toLowerCase();
    const priorityFilter = (searchParams.get('priority') || '').trim().toLowerCase();
    const departmentFilter = (searchParams.get('assigned_department') || '').trim();

    const db = getDbClient();
    let query = db
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (priorityFilter && priorityFilter !== 'all') {
      query = query.eq('priority', priorityFilter);
    }
    if (departmentFilter && departmentFilter !== 'all') {
      query = query.eq('assigned_department', departmentFilter);
    }

    const { data, error } = await query;

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

    return NextResponse.json(
      {
        success: true,
        count: (data || []).length,
        tickets: data || [],
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
 * Creates a new ticket in `tickets` and triggers the n8n Webhook asynchronously.
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

    const subscription_id = String(body.subscription_id || '').trim() || null;
    const customer_name = String(body.customer_name || '').trim() || null;
    const issue_type = String(body.issue_type || '').trim();
    const priority = normalizePriority(body.priority);
    const description = String(body.description || '').trim();
    const assigned_department = String(body.assigned_department || 'إدارة').trim();
    const created_by = String(body.created_by || sessionUserName).trim() || 'موظف العمليات';

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
    const insertPayload = {
      subscription_id,
      customer_name,
      issue_type,
      priority,
      status: 'open',
      description,
      assigned_department,
      created_by,
    };

    const { data: insertedTicket, error: insertError } = await db
      .from('tickets')
      .insert(insertPayload)
      .select('*')
      .single();

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
        ticket: insertedTicket,
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
        ticket: insertedTicket,
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
 * Updates ticket status (e.g., 'in_progress' or 'resolved') and saves `resolution_notes`.
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

    const nextStatus = normalizeStatus(body.status || 'resolved');
    const resolution_notes =
      body.resolution_notes !== undefined
        ? String(body.resolution_notes || '').trim() || null
        : undefined;

    const updateFields: Record<string, unknown> = {
      status: nextStatus,
    };

    if (resolution_notes !== undefined) {
      updateFields.resolution_notes = resolution_notes;
    }

    if (body.priority !== undefined) {
      updateFields.priority = normalizePriority(body.priority);
    }

    if (body.assigned_department !== undefined) {
      updateFields.assigned_department = String(body.assigned_department).trim();
    }

    if (nextStatus === 'resolved') {
      updateFields.resolved_at = new Date().toISOString();
    } else if (body.resolved_at === null) {
      updateFields.resolved_at = null;
    }

    const db = getDbClient();
    let query = db.from('tickets').update(updateFields);
    if (id) {
      query = query.eq('id', id);
    } else if (ticketNumber !== null) {
      query = query.eq('ticket_number', ticketNumber);
    }

    const { data: updatedTicket, error: updateError } = await query
      .select('*')
      .single();

    if (updateError || !updatedTicket) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database Update Failed',
          message: updateError?.message || 'تعذر تحديث حالة التذكرة.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          nextStatus === 'resolved'
            ? 'تم إغلاق التذكرة وحفظ ملاحظات الحل بنجاح.'
            : 'تم تحديث حالة التذكرة بنجاح.',
        ticket: updatedTicket,
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

