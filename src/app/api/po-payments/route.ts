import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function isMissingTableOrColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = String(err.code || '').trim();
  const msg = String(err.message || '');
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    /relation .* does not exist/i.test(msg) ||
    /could not find the table/i.test(msg) ||
    /column .* does not exist/i.test(msg)
  );
}

function poNumberToTicketSubscriptionId(poNumber: string): string {
  const digitsOnly = String(poNumber || '').replace(/\D/g, '');
  if (digitsOnly.length >= 3 && digitsOnly.length <= 15) {
    return digitsOnly;
  }
  if (digitsOnly.length > 0) {
    return digitsOnly.padStart(4, '9');
  }
  return '9000';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const poNumber = (searchParams.get('po_number') || '').trim();
    const supplierId = (searchParams.get('supplier_id') || '').trim();

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('po_payments')
      .select(`
        *,
        suppliers (
          id,
          name_ar,
          name_en
        )
      `)
      .order('due_date', { ascending: true });

    if (poNumber) {
      query = query.eq('po_number', poNumber);
    }
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    let { data, error } = await query;

    // Fallback without join if foreign key relationship is not cached yet
    if (error && !isMissingTableOrColumn(error)) {
      let plainQuery = supabaseAdmin
        .from('po_payments')
        .select('*')
        .order('due_date', { ascending: true });
      if (poNumber) plainQuery = plainQuery.eq('po_number', poNumber);
      if (supplierId) plainQuery = plainQuery.eq('supplier_id', supplierId);
      const fallback = await plainQuery;
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (isMissingTableOrColumn(error)) {
        return NextResponse.json({ payments: [], schema_migration_pending: true });
      }
      return NextResponse.json(
        { error: `تعذر جلب جدول الدفعات: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ payments: data || [] });
  } catch (error: unknown) {
    console.error('[GET /api/po-payments] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر جلب جدول المدفوعات';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'create').trim();
    const supabaseAdmin = getSupabaseAdmin();

    // Action: check_reminders -> Automated Finance & Manager Reminder Workflow
    if (action === 'check_reminders') {
      const now = new Date();
      const targetDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const cutoffDateStr = targetDate.toISOString().split('T')[0];

      let { data: dueRows, error: dueErr } = await supabaseAdmin
        .from('po_payments')
        .select(`
          *,
          suppliers (
            id,
            name_ar,
            name_en
          )
        `)
        .eq('status', 'scheduled')
        .lte('due_date', cutoffDateStr)
        .eq('reminder_ticket_created', false)
        .order('due_date', { ascending: true });

      if (dueErr && !isMissingTableOrColumn(dueErr)) {
        const plainRes = await supabaseAdmin
          .from('po_payments')
          .select('*')
          .eq('status', 'scheduled')
          .lte('due_date', cutoffDateStr)
          .eq('reminder_ticket_created', false)
          .order('due_date', { ascending: true });
        dueRows = plainRes.data;
        dueErr = plainRes.error;
      }

      if (dueErr) {
        if (isMissingTableOrColumn(dueErr)) {
          return NextResponse.json({
            success: true,
            triggeredCount: 0,
            ticketsCreated: [],
            schema_migration_pending: true,
          });
        }
        return NextResponse.json(
          { error: `تعذر فحص الدفعات المستحقة: ${dueErr.message}` },
          { status: 500 }
        );
      }

      const suppliersRes = await supabaseAdmin
        .from('suppliers')
        .select('id, name_ar, name_en');
      const supplierMap = new Map<string, string>();
      for (const s of suppliersRes.data || []) {
        supplierMap.set(String(s.id), String(s.name_ar || s.name_en || 'المورد المعتمد'));
      }

      const ticketsCreated: Array<{
        payment_id: string;
        po_number: string;
        supplier_name: string;
        amount: number;
        due_date: string;
        description: string;
      }> = [];

      for (const payment of dueRows || []) {
        const supObj = Array.isArray(payment.suppliers)
          ? payment.suppliers[0]
          : payment.suppliers;
        const supplierName =
          supObj?.name_ar ||
          supObj?.name_en ||
          (payment.supplier_id ? supplierMap.get(String(payment.supplier_id)) : '') ||
          body?.supplier_name_map?.[payment.po_number] ||
          'المورد المعتمد';

        const poNum = String(payment.po_number || '').trim();
        const title = String(payment.title || 'دفعة مستحقة').trim();
        const amount = Number(payment.amount) || 0;
        const dueDate = String(payment.due_date || '').trim();

        const description =
          'تذكير سداد مستحق للمورد [' +
          supplierName +
          '] - دفعة (' +
          title +
          ') بقيمة ' +
          amount +
          ' ر.س لأمر الشراء #' +
          poNum +
          ' تستحق بتاريخ ' +
          dueDate;

        // 1. Insert high-priority ticket into public.tickets
        // Try exact payment.po_number first; if public.tickets enforces numeric subscription_id, fall back to digits
        const baseTicketPayload = {
          subscription_id: poNum,
          customer_name: supplierName,
          department: 'المالية والإدارة',
          assigned_department: 'المالية والإدارة',
          priority: 'high',
          issue_type: 'تذكير سداد مورد',
          description,
          status: 'Open',
          created_by: String(session?.user?.name || 'نظام تذكير المالية الآلي'),
          created_at: new Date().toISOString(),
        };

        let { error: ticketErr } = await supabaseAdmin
          .from('tickets')
          .insert(baseTicketPayload);

        if (ticketErr) {
          // Fallback 1: without department column if legacy schema, or numeric subscription_id if constraint requires digits
          const fallbackTicketPayload = {
            subscription_id: poNumberToTicketSubscriptionId(poNum),
            customer_name: supplierName,
            assigned_department: 'المالية والإدارة',
            priority: 'high',
            issue_type: 'تذكير سداد مورد',
            description,
            status: 'Open',
            created_by: String(session?.user?.name || 'نظام تذكير المالية الآلي'),
            created_at: new Date().toISOString(),
          };
          const retry = await supabaseAdmin.from('tickets').insert(fallbackTicketPayload);
          ticketErr = retry.error;
        }

        // 2. Immediately update po_payments.reminder_ticket_created = true so duplicate tickets are never created
        await supabaseAdmin
          .from('po_payments')
          .update({
            reminder_ticket_created: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id);

        ticketsCreated.push({
          payment_id: String(payment.id),
          po_number: poNum,
          supplier_name: supplierName,
          amount,
          due_date: dueDate,
          description,
        });
      }

      return NextResponse.json({
        success: true,
        triggeredCount: ticketsCreated.length,
        ticketsCreated,
      });
    }

    // Standard Create New Scheduled Payment
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بإضافة دفعة بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const po_number = String(body?.po_number || 'دفعة عامة').trim() || 'دفعة عامة';
    const supplier_id = body?.supplier_id ? String(body.supplier_id).trim() : null;
    const title = String(body?.title || '').trim();
    const amount = Number(body?.amount);
    const due_date = String(body?.due_date || '').trim();
    const status = body?.status === 'paid' ? 'paid' : 'scheduled';
    const notes = body?.notes ? String(body.notes).trim() : null;

    if (!title || !Number.isFinite(amount) || amount <= 0 || !due_date) {
      return NextResponse.json(
        { error: 'يرجى إدخال عنوان الدفعة، المبلغ، وتاريخ الاستحقاق بشكل صحيح' },
        { status: 400 }
      );
    }

    const insertPayload = {
      po_number,
      supplier_id: supplier_id || null,
      title,
      amount: Number(amount.toFixed(2)),
      due_date,
      status,
      paid_at: status === 'paid' ? (body?.paid_at || new Date().toISOString()) : null,
      receipt_url: body?.receipt_url || null,
      reminder_ticket_created: false,
      notes,
    };

    const { data, error } = await supabaseAdmin
      .from('po_payments')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      if (isMissingTableOrColumn(error)) {
        return NextResponse.json({
          success: true,
          schema_migration_pending: true,
          payment: {
            id: `local-pay-${Date.now()}`,
            ...insertPayload,
            created_at: new Date().toISOString(),
          },
        });
      }
      return NextResponse.json(
        { error: `تعذر حفظ الدفعة في قاعدة البيانات: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, payment: data });
  } catch (error: unknown) {
    console.error('[POST /api/po-payments] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر حفظ الدفعة';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بتعديل الدفعة بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'معرف الدفعة مطلوب للتحديث' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined && typeof body.title === 'string' && body.title.trim()) {
      updatePayload.title = body.title.trim();
    }
    if (body.amount !== undefined && Number.isFinite(Number(body.amount))) {
      updatePayload.amount = Number(Number(body.amount).toFixed(2));
    }
    if (body.due_date !== undefined && typeof body.due_date === 'string' && body.due_date.trim()) {
      updatePayload.due_date = body.due_date.trim();
    }
    if (body.status !== undefined && (body.status === 'scheduled' || body.status === 'paid')) {
      updatePayload.status = body.status;
      if (body.status === 'paid') {
        updatePayload.paid_at = body.paid_at || new Date().toISOString();
      } else {
        updatePayload.paid_at = null;
      }
    }
    if (body.receipt_url !== undefined) {
      updatePayload.receipt_url = body.receipt_url || null;
    }
    if (body.reminder_ticket_created !== undefined) {
      updatePayload.reminder_ticket_created = Boolean(body.reminder_ticket_created);
    }
    if (body.notes !== undefined) {
      updatePayload.notes = body.notes ? String(body.notes).trim() : null;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('po_payments')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingTableOrColumn(error)) {
        return NextResponse.json({
          success: true,
          schema_migration_pending: true,
          payment: { id, ...updatePayload },
        });
      }
      return NextResponse.json(
        { error: `تعذر تحديث الدفعة: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, payment: data || { id, ...updatePayload } });
  } catch (error: unknown) {
    console.error('[PATCH /api/po-payments] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر تحديث الدفعة';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بحذف الدفعة بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = (searchParams.get('id') || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'معرف الدفعة مطلوب للحذف' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from('po_payments').delete().eq('id', id);

    if (error && !isMissingTableOrColumn(error)) {
      return NextResponse.json(
        { error: `تعذر حذف الدفعة: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: unknown) {
    console.error('[DELETE /api/po-payments] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر حذف الدفعة';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
