"use client";

import { useState, useEffect, useMemo, useCallback, type CSSProperties, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  Ticket,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Check,
  Loader2,
  Building2,
  User,
  MessageSquare,
  RotateCcw,
  Pencil,
  Trash2,
  AlertTriangle,
  FileDown,
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';
import { fetchAppUsers, type AppUserSummary } from '@/lib/supabaseService';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('en');

const SAUDI_TZ = 'Asia/Riyadh';
const SUBSCRIPTION_ID_REGEX = /^\d{3,15}$/;

const englishNumericFontStyle: CSSProperties = {
  fontFamily: 'var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
  fontVariantNumeric: 'lining-nums tabular-nums',
};

const englishNumericStyle: CSSProperties = {
  ...englishNumericFontStyle,
  direction: 'ltr',
};

const escapeHtml = (raw: unknown): string => {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const toEnglishDigitsStr = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
};

const validateSubscriptionId = (raw: string): string | null => {
  const cleaned = toEnglishDigitsStr(raw);
  if (!cleaned) {
    return 'يرجى إدخال رقم الاشتراك (Subscription ID).';
  }
  if (!SUBSCRIPTION_ID_REGEX.test(cleaned)) {
    return 'رقم الاشتراك غير صالح — يجب إدخال أرقام إنجليزية صحيحة فقط (3 إلى 15 رقماً).';
  }
  return null;
};

export interface TicketRecord {
  id: string;
  ticket_number: number;
  subscription_id: string | null;
  customer_name: string | null;
  issue_type: string;
  priority: 'high' | 'medium' | 'low' | string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'open' | 'in_progress' | 'resolved' | string;
  description: string;
  department?: string | null;
  assigned_department: string | null;
  resolution_action?: string | null;
  resolution_notes: string | null;
  resolved_by?: string | null;
  resolved_by_username?: string | null;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
}

const normalizeTicketStatus = (raw: unknown): 'open' | 'in_progress' | 'resolved' => {
  const s = String(raw || 'open').trim().toLowerCase();
  if (s === 'resolved' || s === 'closed' || s === 'تم الحل' || s === 'مغلقة') {
    return 'resolved';
  }
  if (s === 'in_progress' || s === 'in-progress' || s === 'in progress' || s === 'قيد التنفيذ') {
    return 'in_progress';
  }
  return 'open';
};

const formatSlaDuration = (
  createdAt: string | null | undefined,
  resolvedAt: string | null | undefined
): string | null => {
  if (!createdAt || !resolvedAt) return null;
  const start = dayjs(createdAt);
  const end = dayjs(resolvedAt);
  if (!start.isValid() || !end.isValid()) return null;

  const diffSeconds = Math.max(0, end.diff(start, 'second'));
  if (diffSeconds < 60) {
    return `${diffSeconds} ثانية`;
  }

  const totalMinutes = Math.floor(diffSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} دقيقة`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes > 0
      ? `${totalHours} ساعة و ${remMinutes} دقيقة`
      : `${totalHours} ساعة`;
  }

  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours > 0
    ? `${days} يوم و ${remHours} ساعة`
    : `${days} يوم`;
};

const ISSUE_TYPE_OPTIONS = ['تعويض', 'شكوى', 'استفسار', 'تأخير'] as const;
const DEPARTMENT_OPTIONS = ['مطبخ', 'توصيل', 'إدارة'] as const;
const TICKET_RESOLUTION_OPTIONS = [
  'إتلاف الوجبة - هدر تشغيلي',
  'إرجاع المنتجات للمخزون - لم يتم التغليف',
] as const;

export default function TicketsClient() {
  const { lang } = useLanguage();
  const { data: session } = useSession();

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamically fetch users from Supabase `app_users` (`id` UUID & `username` column)
  const [appUsers, setAppUsers] = useState<AppUserSummary[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  const sessionUserObj = session?.user as
    | { id?: string; role?: string; username?: string; name?: string | null; email?: string | null }
    | undefined;

  const isAdmin = useMemo(() => {
    const r = String(sessionUserObj?.role || '').trim().toLowerCase();
    return r === 'admin' || r === 'superadmin';
  }, [sessionUserObj?.role]);

  const sessionUsername = useMemo(() => {
    return (
      sessionUserObj?.username ||
      sessionUserObj?.name ||
      sessionUserObj?.email ||
      ''
    ).trim();
  }, [sessionUserObj]);

  const matchedSessionAppUser = useMemo(() => {
    if (!appUsers.length) return undefined;
    if (sessionUserObj?.id) {
      const byId = appUsers.find((u) => u.id === sessionUserObj.id);
      if (byId) return byId;
    }
    if (sessionUsername) {
      const lower = sessionUsername.toLowerCase();
      return appUsers.find((u) => u.username.toLowerCase() === lower);
    }
    return undefined;
  }, [appUsers, sessionUserObj, sessionUsername]);

  const userRoster = useMemo(() => {
    const usernames = appUsers.map((u) => (u.username || '').trim()).filter(Boolean);
    if (sessionUsername && !usernames.includes(sessionUsername)) {
      return [sessionUsername, ...usernames];
    }
    return usernames;
  }, [appUsers, sessionUsername]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Create / Edit Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingTicket, setEditingTicket] = useState<TicketRecord | null>(null);
  const [newSubId, setNewSubId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newIssueType, setNewIssueType] = useState<string>('تعويض');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newDepartment, setNewDepartment] = useState<string>('مطبخ');
  const [newAssignedUser, setNewAssignedUser] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Delete Ticket Confirmation Modal State
  const [deleteTargetTicket, setDeleteTargetTicket] = useState<TicketRecord | null>(null);
  const [isDeletingTicket, setIsDeletingTicket] = useState<boolean>(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  // Resolve / Update Ticket Modal State
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'resolved' | 'in_progress' | 'open'>('resolved');
  const [resolutionAction, setResolutionAction] = useState<string>(TICKET_RESOLUTION_OPTIONS[0]);
  const [resolvedByUserId, setResolvedByUserId] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState<boolean>(false);
  const [resolveModalError, setResolveModalError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      setIsLoadingUsers(true);
      try {
        const users = await fetchAppUsers();
        if (isMounted) setAppUsers(users);
      } catch (err) {
        console.error('Failed to load app users in TicketsClient:', err);
      } finally {
        if (isMounted) setIsLoadingUsers(false);
      }
    };
    void loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'تعذر جلب التذاكر');
      }

      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (err: unknown) {
      console.error('Error fetching tickets:', err);
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل التذاكر');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTickets();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTickets]);

  // Top Summary Counts (computed across all tickets)
  const summaryCounts = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;

    for (const t of tickets) {
      const st = normalizeTicketStatus(t.status);
      if (st === 'resolved') {
        resolved++;
      } else if (st === 'in_progress') {
        inProgress++;
      } else {
        open++;
      }
    }

    return { open, inProgress, resolved, total: tickets.length };
  }, [tickets]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    const q = toEnglishDigitsStr(searchQuery).toLowerCase();

    return tickets.filter((t) => {
      const st = normalizeTicketStatus(t.status);
      const pr = String(t.priority || 'medium').toLowerCase();
      const dept = String(t.department || t.assigned_department || '');
      const creatorName = String(t.created_by || '').trim();
      const closerName = String(t.resolved_by_username || '').trim();

      if (statusFilter !== 'ALL' && st !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && pr !== priorityFilter) {
        return false;
      }
      if (departmentFilter !== 'ALL' && dept !== departmentFilter) {
        return false;
      }
      if (employeeFilter !== 'ALL') {
        const empTarget = employeeFilter.trim().toLowerCase();
        if (
          creatorName.toLowerCase() !== empTarget &&
          closerName.toLowerCase() !== empTarget
        ) {
          return false;
        }
      }
      if (q) {
        const numMatch = String(t.ticket_number || '').includes(q);
        const subMatch = String(t.subscription_id || '').toLowerCase().includes(q);
        const custMatch = String(t.customer_name || '').toLowerCase().includes(q);
        const descMatch = String(t.description || '').toLowerCase().includes(q);
        const issueMatch = String(t.issue_type || '').toLowerCase().includes(q);
        const deptMatch = dept.toLowerCase().includes(q);
        const empMatch =
          creatorName.toLowerCase().includes(q) || closerName.toLowerCase().includes(q);
        if (
          !numMatch &&
          !subMatch &&
          !custMatch &&
          !descMatch &&
          !issueMatch &&
          !deptMatch &&
          !empMatch
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, departmentFilter, employeeFilter, searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingTicket(null);
    setNewSubId('');
    setNewCustomerName('');
    setNewIssueType('تعويض');
    setNewPriority('medium');
    setNewDepartment('مطبخ');
    setNewAssignedUser(sessionUsername || userRoster[0] || '');
    setNewDescription('');
    setCreateModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (ticket: TicketRecord) => {
    setEditingTicket(ticket);
    setNewSubId(toEnglishDigitsStr(ticket.subscription_id || ''));
    setNewCustomerName(ticket.customer_name || '');
    setNewIssueType(ticket.issue_type || 'تعويض');
    const p = String(ticket.priority || 'medium').toLowerCase();
    setNewPriority(p === 'high' || p === 'low' ? p : 'medium');
    setNewDepartment(ticket.department || ticket.assigned_department || 'إدارة');
    setNewAssignedUser(ticket.created_by || sessionUsername || userRoster[0] || '');
    setNewDescription(ticket.description || '');
    setCreateModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateTicketSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);

    const subErr = validateSubscriptionId(newSubId);
    if (subErr) {
      setCreateModalError(subErr);
      return;
    }

    if (!newDescription.trim()) {
      setCreateModalError('يرجى إدخال وصف وتفاصيل التذكرة.');
      return;
    }

    try {
      setIsSubmittingCreate(true);
      const cleanSubId = toEnglishDigitsStr(newSubId);

      if (editingTicket) {
        const res = await fetch('/api/tickets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTicket.id,
            ticket_number: editingTicket.ticket_number,
            subscription_id: cleanSubId,
            customer_name: newCustomerName.trim(),
            issue_type: newIssueType,
            priority: newPriority,
            department: newDepartment,
            assigned_department: newDepartment,
            description: newDescription.trim(),
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || data?.error || 'فشل تعديل التذكرة');
        }

        if (data.ticket) {
          const updated = data.ticket as TicketRecord;
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        } else {
          await fetchTickets();
        }

        const editedNum = editingTicket.ticket_number;
        setIsCreateModalOpen(false);
        setEditingTicket(null);
        showToast(`تم تعديل بيانات التذكرة #${toEnglishDigitsStr(editedNum)} بنجاح ✨`);
      } else {
        const createdBy =
          (newAssignedUser || sessionUsername || session?.user?.name || session?.user?.email || 'موظف العمليات').trim();

        const res = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription_id: cleanSubId,
            customer_name: newCustomerName.trim(),
            issue_type: newIssueType,
            priority: newPriority,
            department: newDepartment,
            assigned_department: newDepartment,
            status: 'Open',
            description: newDescription.trim(),
            created_by: createdBy,
            created_at: new Date().toISOString(),
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || data?.error || 'فشل إنشاء التذكرة');
        }

        if (data.ticket) {
          setTickets((prev) => [data.ticket as TicketRecord, ...prev]);
        } else {
          await fetchTickets();
        }

        setIsCreateModalOpen(false);
        showToast(
          `تم إنشاء التذكرة #${toEnglishDigitsStr(data.ticket?.ticket_number || '')} بنجاح وتوجيهها إلى قسم (${newDepartment}) ✨`
        );
      }
    } catch (err: unknown) {
      console.error('Error saving ticket:', err);
      setCreateModalError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ التذكرة');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenDeleteModal = (ticket: TicketRecord) => {
    if (!isAdmin) {
      showToast('صلاحية الأدمن (Admin / SuperAdmin) مطلوبة لحذف التذاكر.');
      return;
    }
    setDeleteModalError(null);
    setDeleteTargetTicket(ticket);
  };

  const handleConfirmDeleteTicket = async () => {
    if (!deleteTargetTicket) return;
    setDeleteModalError(null);

    try {
      setIsDeletingTicket(true);
      const res = await fetch(`/api/tickets?id=${encodeURIComponent(deleteTargetTicket.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'تعذر حذف التذكرة');
      }

      const deletedNum = deleteTargetTicket.ticket_number;
      setTickets((prev) => prev.filter((t) => t.id !== deleteTargetTicket.id));
      if (selectedTicket?.id === deleteTargetTicket.id) {
        setSelectedTicket(null);
      }
      setDeleteTargetTicket(null);
      showToast(`تم حذف التذكرة #${toEnglishDigitsStr(deletedNum)} نهائياً.`);
    } catch (err: unknown) {
      console.error('Error deleting ticket:', err);
      setDeleteModalError(err instanceof Error ? err.message : 'حدث خطأ أثناء حذف التذكرة');
    } finally {
      setIsDeletingTicket(false);
    }
  };

  const handleOpenResolveModal = (ticket: TicketRecord) => {
    setSelectedTicket(ticket);
    const currentSt = normalizeTicketStatus(ticket.status);
    setResolveStatus(currentSt === 'in_progress' ? 'in_progress' : 'resolved');
    const existingNotes = ticket.resolution_notes || '';
    const existingAction = ticket.resolution_action || '';
    const matchedOpt =
      TICKET_RESOLUTION_OPTIONS.find((opt) => existingAction === opt) ||
      TICKET_RESOLUTION_OPTIONS.find((opt) => existingNotes.includes(opt));
    setResolutionAction(matchedOpt || TICKET_RESOLUTION_OPTIONS[0]);
    setResolvedByUserId(
      ticket.resolved_by || matchedSessionAppUser?.id || appUsers[0]?.id || ''
    );
    setResolutionNotes(existingNotes);
    setResolveModalError(null);
  };

  const handleResolveTicketSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setResolveModalError(null);

    const activeUserId = (
      resolvedByUserId ||
      matchedSessionAppUser?.id ||
      appUsers[0]?.id ||
      ''
    ).trim();

    if (!activeUserId) {
      setResolveModalError('يرجى تحديد الموظف المسؤول عن معالجة وإغلاق التذكرة.');
      return;
    }

    if (resolveStatus === 'resolved' && !resolutionAction) {
      setResolveModalError('يرجى اختيار الإجراء المتخذ قبل إغلاق التذكرة.');
      return;
    }

    const nextStorageStatus =
      resolveStatus === 'resolved'
        ? 'Resolved'
        : resolveStatus === 'in_progress'
          ? 'In Progress'
          : 'Open';

    try {
      setIsSubmittingResolve(true);
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTicket.id,
          ticket_number: selectedTicket.ticket_number,
          status: nextStorageStatus,
          resolution_action: resolveStatus === 'resolved' ? resolutionAction : undefined,
          resolved_by: activeUserId,
          resolved_at: resolveStatus === 'resolved' ? new Date().toISOString() : null,
          resolution_notes: resolutionNotes.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'تعذر تحديث التذكرة');
      }

      if (data.ticket) {
        const updated = data.ticket as TicketRecord;
        setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        await fetchTickets();
      }

      const num = selectedTicket.ticket_number;
      setSelectedTicket(null);
      showToast(
        resolveStatus === 'resolved'
          ? `تم إغلاق التذكرة #${toEnglishDigitsStr(num)} وحساب وقت الـ SLA بنجاح ✨`
          : `تم تحديث حالة التذكرة #${toEnglishDigitsStr(num)} بنجاح ✨`
      );
    } catch (err: unknown) {
      console.error('Error resolving ticket:', err);
      setResolveModalError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث التذكرة');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const formatCompactDateTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const m = dayjs(iso).tz(SAUDI_TZ).locale('en');
    return m.isValid() ? m.format('DD MMM, hh:mm A') : iso;
  };

  const handleExportTicketsPdf = () => {
    if (filteredTickets.length === 0) {
      showToast('لا توجد تذاكر مطابقة للتصدير حالياً');
      return;
    }

    try {
      setIsExportingPdf(true);

      const getStatusLabel = (raw: unknown) => {
        const s = normalizeTicketStatus(raw);
        if (s === 'resolved') return { text: 'تم الحل (Resolved)', cls: 'status-resolved' };
        if (s === 'in_progress') return { text: 'قيد التنفيذ (In Progress)', cls: 'status-progress' };
        return { text: 'مفتوحة (Open)', cls: 'status-open' };
      };

      const getPriorityLabel = (raw: unknown) => {
        const p = String(raw || 'medium').toLowerCase();
        if (p === 'high') return { text: 'عالية (High)', cls: 'priority-high' };
        if (p === 'low') return { text: 'منخفضة (Low)', cls: 'priority-low' };
        return { text: 'متوسطة (Medium)', cls: 'priority-medium' };
      };

      const activeFiltersSummary: string[] = [];
      if (statusFilter !== 'ALL') {
        activeFiltersSummary.push(`الحالة: ${getStatusLabel(statusFilter).text}`);
      }
      if (priorityFilter !== 'ALL') {
        activeFiltersSummary.push(`الأولوية: ${getPriorityLabel(priorityFilter).text}`);
      }
      if (departmentFilter !== 'ALL') {
        activeFiltersSummary.push(`القسم: ${departmentFilter}`);
      }
      if (employeeFilter !== 'ALL') {
        activeFiltersSummary.push(`الموظف: ${employeeFilter}`);
      }
      if (searchQuery.trim()) {
        activeFiltersSummary.push(`بحث: "${searchQuery.trim()}"`);
      }

      const filterText =
        activeFiltersSummary.length > 0
          ? activeFiltersSummary.join('  |  ')
          : 'الكل (بدون تصفية)';

      const generatedAt = formatCompactDateTime(new Date().toISOString());

      const rowsHtml = filteredTickets
        .map((t) => {
          const stInfo = getStatusLabel(t.status);
          const prInfo = getPriorityLabel(t.priority);
          const deptName = t.department || t.assigned_department || 'إدارة';
          const customerDisplay = t.customer_name || 'عميل غير محدد';
          const subBadge = t.subscription_id
            ? `<div class="sub-id" dir="ltr">#${escapeHtml(toEnglishDigitsStr(t.subscription_id))}</div>`
            : '';

          return `
            <tr>
              <td class="num-cell" dir="ltr">#${escapeHtml(Number(t.ticket_number || 0).toLocaleString('en-US'))}</td>
              <td>
                <div class="cust-name">${escapeHtml(customerDisplay)}</div>
                ${subBadge}
              </td>
              <td style="text-align:center;font-weight:700;">${escapeHtml(deptName)}</td>
              <td style="text-align:center;"><span class="badge ${prInfo.cls}">${escapeHtml(prInfo.text)}</span></td>
              <td style="text-align:center;"><span class="badge ${stInfo.cls}">${escapeHtml(stInfo.text)}</span></td>
              <td class="num-cell" dir="ltr">${escapeHtml(formatCompactDateTime(t.created_at))}</td>
            </tr>
          `;
        })
        .join('');

      const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير التذاكر والعمليات - Zahi Control Tower</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 16px;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 14px;
      gap: 16px;
    }
    .report-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .filter-meta {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .stats-box {
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      white-space: nowrap;
    }
    .stats-box .count {
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      vertical-align: middle;
    }
    th {
      background-color: #1e293b !important;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 12px;
      text-align: center;
      white-space: nowrap;
    }
    th:nth-child(2), td:nth-child(2) {
      text-align: right;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .cust-name {
      font-weight: 800;
      color: #0f172a;
    }
    .sub-id {
      font-family: 'Segoe UI', Tahoma, monospace;
      font-size: 11px;
      font-weight: 700;
      color: #047857;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
      margin-top: 2px;
    }
    .num-cell {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-variant-numeric: lining-nums tabular-nums;
      direction: ltr !important;
      unicode-bidi: isolate;
      text-align: center;
      font-weight: 700;
      white-space: nowrap;
      color: #1e293b;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .priority-high { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .priority-medium { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
    .priority-low { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
    .status-open { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .status-progress { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
    .status-resolved { background: #d1fae5; color: #047857; border: 1px solid #6ee7b7; }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <h1 class="report-title">تقرير التذاكر والعمليات — برج مراقبة زاهي</h1>
      <div class="filter-meta">معايير التصفية النشطة: ${escapeHtml(filterText)}</div>
    </div>
    <div class="stats-box">
      <div class="count">عدد التذاكر: <span dir="ltr">${toEnglishDigitsStr(filteredTickets.length)}</span></div>
      <div>تاريخ التصدير: <span dir="ltr">${escapeHtml(generatedAt)}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>رقم التذكرة</th>
        <th>العميل</th>
        <th>القسم المختص</th>
        <th>الأولوية</th>
        <th>الحالة</th>
        <th>التاريخ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <script>
    window.onload = function() {
      var triggerPrint = function() {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 250);
      };
      if (document.fonts && document.fonts.ready) {
        Promise.race([
          document.fonts.ready,
          new Promise(function(resolve) { setTimeout(resolve, 1200); })
        ]).then(triggerPrint);
      } else {
        triggerPrint();
      }
    };
  </script>
</body>
</html>`;

      const printWin = window.open('', '_blank', 'width=1100,height=850');
      if (!printWin) {
        let iframe = document.getElementById('tickets-pdf-print-iframe') as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'tickets-pdf-print-iframe';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
        }
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlDoc);
          doc.close();
        }
      } else {
        printWin.document.open();
        printWin.document.write(htmlDoc);
        printWin.document.close();
      }

      showToast(
        `تم تجهيز تقرير PDF لـ (${toEnglishDigitsStr(filteredTickets.length)}) تذكرة بنجاح`
      );
    } catch (err) {
      console.error('Failed to export tickets PDF:', err);
      showToast('تعذر إنشاء تقرير PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const renderPriorityBadge = (priority: string) => {
    const p = String(priority || 'medium').toLowerCase();
    if (p === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-rose-500/20 border border-rose-400/50 text-rose-200 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span>عالية (High)</span>
        </span>
      );
    }
    if (p === 'low') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-sky-500/20 border border-sky-400/50 text-sky-200">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>منخفضة (Low)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-500/20 border border-amber-400/50 text-amber-200">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span>متوسطة (Medium)</span>
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    const s = normalizeTicketStatus(status);
    if (s === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-500/20 border border-emerald-400/50 text-emerald-200">
          <span>🟢</span>
          <span>تم الحل (Resolved)</span>
        </span>
      );
    }
    if (s === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-500/20 border border-amber-400/50 text-amber-200">
          <span>🟡</span>
          <span>قيد التنفيذ (In Progress)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-rose-500/20 border border-rose-400/50 text-rose-200">
        <span>🔴</span>
        <span>مفتوحة (Open)</span>
      </span>
    );
  };

  return (
    <div
      className="page-shell w-full mx-auto space-y-6 font-sans text-white tabular-nums"
      style={{
        fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
        fontVariantNumeric: 'lining-nums tabular-nums',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black/85 border border-emerald-400/40 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 shadow-2xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Page Header */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 shadow-inner shrink-0">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>التذاكر والعمليات 🎫</span>
            </h1>
            <p className="text-xs sm:text-sm text-white/70 font-medium mt-0.5">
              {lang === 'en'
                ? 'Centralized operational ticketing system for customer compensations, complaints, inquiries & kitchen/delivery coordination'
                : 'منظومة إدارة التذاكر التشغيلية وطلبات التعويض والشكاوى والتنسيق المباشر بين المطبخ والتوصيل والإدارة'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => void fetchTickets()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث التذاكر</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 backdrop-blur-md text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>إنشاء تذكرة جديدة</span>
          </button>
        </div>
      </div>

      {/* 3 Top Summary Cards: 🔴 تذاكر مفتوحة | 🟡 قيد التنفيذ | 🟢 تذاكر مغلقة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Open Tickets */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'ALL' : 'open')}
          className={`glass-card rounded-2xl p-5 border text-right transition-all cursor-pointer flex items-center justify-between ${
            statusFilter === 'open'
              ? 'border-rose-400 bg-rose-500/15 ring-2 ring-rose-400/30'
              : 'border-rose-400/30 hover:border-rose-400/60'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-extrabold text-rose-200 flex items-center gap-1.5">
              <span>🔴 تذاكر مفتوحة</span>
              <span className="text-[11px] text-white/60 font-normal">(Open)</span>
            </div>
            <div className="text-3xl font-mono font-black text-white" style={englishNumericStyle} dir="ltr">
              {summaryCounts.open.toLocaleString('en-US')}
            </div>
            <p className="text-[11px] text-white/60">بانتظار المعالجة والتدخل</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-300">
            <AlertCircle className="w-6 h-6" />
          </div>
        </button>

        {/* Card 2: In Progress Tickets */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'ALL' : 'in_progress')}
          className={`glass-card rounded-2xl p-5 border text-right transition-all cursor-pointer flex items-center justify-between ${
            statusFilter === 'in_progress'
              ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/30'
              : 'border-amber-400/30 hover:border-amber-400/60'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-extrabold text-amber-200 flex items-center gap-1.5">
              <span>🟡 قيد التنفيذ</span>
              <span className="text-[11px] text-white/60 font-normal">(In Progress)</span>
            </div>
            <div className="text-3xl font-mono font-black text-white" style={englishNumericStyle} dir="ltr">
              {summaryCounts.inProgress.toLocaleString('en-US')}
            </div>
            <p className="text-[11px] text-white/60">جاري العمل عليها من القسم المختص</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
            <Clock className="w-6 h-6" />
          </div>
        </button>

        {/* Card 3: Resolved Tickets */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'ALL' : 'resolved')}
          className={`glass-card rounded-2xl p-5 border text-right transition-all cursor-pointer flex items-center justify-between ${
            statusFilter === 'resolved'
              ? 'border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/30'
              : 'border-emerald-400/30 hover:border-emerald-400/60'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-extrabold text-emerald-200 flex items-center gap-1.5">
              <span>🟢 تذاكر مغلقة</span>
              <span className="text-[11px] text-white/60 font-normal">(Resolved)</span>
            </div>
            <div className="text-3xl font-mono font-black text-white" style={englishNumericStyle} dir="ltr">
              {summaryCounts.resolved.toLocaleString('en-US')}
            </div>
            <p className="text-[11px] text-white/60">تم الحل وتوثيق الإجراء المتخذ</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-white/15 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-white/90">
            <Filter className="w-4 h-4 text-indigo-300" />
            <span>تصفية وبحث التذاكر:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportTicketsPdf}
              disabled={isExportingPdf || filteredTickets.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 hover:text-white transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>تصدير تقرير PDF</span>
            </button>

            {(statusFilter !== 'ALL' ||
              priorityFilter !== 'ALL' ||
              departmentFilter !== 'ALL' ||
              employeeFilter !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setPriorityFilter('ALL');
                  setDepartmentFilter('ALL');
                  setEmployeeFilter('ALL');
                  setSearchQuery('');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-300" />
              <span>بحث (التذكرة، الاشتراك، العميل):</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الاشتراك أو اسم العميل..."
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75">حالة التذكرة:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900 text-white">الكل (جميع الحالات)</option>
              <option value="open" className="bg-zinc-900 text-white">🔴 مفتوحة (Open)</option>
              <option value="in_progress" className="bg-zinc-900 text-white">🟡 قيد التنفيذ (In Progress)</option>
              <option value="resolved" className="bg-zinc-900 text-white">🟢 مغلقة / تم الحل (Resolved)</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75">الأولوية:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900 text-white">الكل (جميع الأولويات)</option>
              <option value="high" className="bg-zinc-900 text-white">عالية (High)</option>
              <option value="medium" className="bg-zinc-900 text-white">متوسطة (Medium)</option>
              <option value="low" className="bg-zinc-900 text-white">منخفضة (Low)</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75">القسم المختص:</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900 text-white">الكل (جميع الأقسام)</option>
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept} value={dept} className="bg-zinc-900 text-white">
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75">الموظف:</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900 text-white">الكل (جميع الموظفين)</option>
              {userRoster.map((username) => (
                <option key={username} value={username} className="bg-zinc-900 text-white">
                  {username}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-rose-500/20 border border-rose-400/40 rounded-2xl p-4 text-xs font-bold text-rose-200 flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => void fetchTickets()}
            className="px-3 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/40 text-white cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Tickets Data Table */}
      <div className="glass-panel rounded-3xl border border-white/20 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead>
              <tr className="bg-white/[0.07] border-b border-white/15 text-white/85 font-extrabold">
                <th className="py-3.5 px-4 whitespace-nowrap">رقم التذكرة</th>
                <th className="py-3.5 px-4 whitespace-nowrap">التاريخ</th>
                <th className="py-3.5 px-4 whitespace-nowrap">المشترك / العميل</th>
                <th className="py-3.5 px-4 whitespace-nowrap">النوع</th>
                <th className="py-3.5 px-4 whitespace-nowrap">القسم المختص</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الأولوية</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الحالة</th>
                <th className="py-3.5 px-4">الوصف</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-white/70">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-300" />
                      <span className="font-bold">جاري تحميل التذاكر...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-white/60">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Ticket className="w-8 h-8 text-white/30" />
                      <p className="font-extrabold text-sm text-white/80">
                        لا توجد تذاكر مطابقة حالياً
                      </p>
                      <p className="text-xs text-white/50">
                        اضغط على زر &quot;إنشاء تذكرة جديدة&quot; لإضافة تذكرة وتفعيل إشعارات الأتمتة.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const isResolved = normalizeTicketStatus(t.status) === 'resolved';

                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleOpenResolveModal(t)}
                      className="hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      {/* 1. Ticket Number */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-black text-indigo-300" style={englishNumericStyle} dir="ltr">
                        #{Number(t.ticket_number || 0).toLocaleString('en-US')}
                      </td>

                      {/* 2. Created At (Compact) */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-white/85" style={englishNumericStyle} dir="ltr">
                        {formatCompactDateTime(t.created_at)}
                      </td>

                      {/* 3. Customer & Subscription ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-white text-xs sm:text-sm">
                            {t.customer_name || 'عميل غير محدد'}
                          </div>
                          {t.subscription_id && (
                            <div
                              className="inline-block font-mono text-[11px] px-2 py-0.5 rounded bg-white/10 border border-white/15 text-emerald-300"
                              style={englishNumericStyle}
                              dir="ltr"
                            >
                              #{toEnglishDigitsStr(t.subscription_id)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Issue Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/35 text-xs font-bold text-indigo-200">
                          {t.issue_type}
                        </span>
                      </td>

                      {/* 5. Department */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-xs font-bold text-white/90">
                          <Building2 className="w-3.5 h-3.5 text-teal-300" />
                          <span>{t.department || t.assigned_department || 'إدارة'}</span>
                        </span>
                      </td>

                      {/* 6. Priority Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {renderPriorityBadge(t.priority)}
                      </td>

                      {/* 7. Status Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {renderStatusBadge(t.status)}
                      </td>

                      {/* 8. Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-white/90 line-clamp-2 font-medium">
                          {t.description}
                        </p>
                      </td>

                      {/* 9. Actions (Resolve / Edit / Delete) */}
                      <td
                        className="py-3.5 px-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenResolveModal(t)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                              isResolved
                                ? 'bg-white/10 hover:bg-white/15 border-white/20 text-white/80'
                                : 'bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-400/50 text-emerald-200 hover:text-white'
                            }`}
                          >
                            {isResolved ? 'عرض التفاصيل' : 'معالجة / إغلاق'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(t)}
                            title="تعديل التذكرة"
                            aria-label="تعديل التذكرة"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-indigo-500/25 border border-white/15 hover:border-indigo-400/50 text-white/80 hover:text-indigo-200 transition-all cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(t)}
                            disabled={!isAdmin}
                            title={
                              isAdmin
                                ? 'حذف التذكرة'
                                : 'صلاحية الأدمن (Admin / SuperAdmin) مطلوبة للحذف'
                            }
                            aria-label="حذف التذكرة"
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              isAdmin
                                ? 'bg-rose-500/15 hover:bg-rose-500/35 border-rose-400/40 text-rose-200 hover:text-white cursor-pointer'
                                : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================
          MODAL 1: CREATE NEW TICKET (إنشاء تذكرة جديدة)
         ======================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="font-sans bg-black/85 backdrop-blur-2xl rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-white border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.75)] relative flex flex-col tabular-nums"
            style={{
              fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
              fontVariantNumeric: 'lining-nums tabular-nums',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/15 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/40 rounded-xl text-indigo-300">
                  {editingTicket ? <Pencil className="w-5 h-5" /> : <Ticket className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    {editingTicket
                      ? `تعديل التذكرة #${toEnglishDigitsStr(editingTicket.ticket_number)}`
                      : 'إنشاء تذكرة جديدة 🎫'}
                  </h3>
                  <p className="text-[11px] text-white/65">
                    {editingTicket
                      ? 'تحديث بيانات التذكرة الأساسية والقسم المختص'
                      : 'تسجيل تذكرة تشغيلية جديدة وإرسال إشعار فوري للقسم المختص'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingCreate) {
                    setIsCreateModalOpen(false);
                    setEditingTicket(null);
                  }
                }}
                disabled={isSubmittingCreate}
                className="text-white/60 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createModalError && (
              <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-3 text-xs font-bold text-rose-200">
                ⚠️ {createModalError}
              </div>
            )}

            <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Subscription ID (Required & Validated) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    رقم الاشتراك (Subscription ID): <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    dir="rtl"
                    value={newSubId}
                    onChange={(e) => setNewSubId(toEnglishDigitsStr(e.target.value))}
                    disabled={isSubmittingCreate}
                    placeholder="مثال: 2703326"
                    className={`w-full bg-white/5 hover:bg-white/10 border rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder:text-white/40 text-right placeholder:text-right focus:outline-none focus:ring-2 ${
                      newSubId && validateSubscriptionId(newSubId)
                        ? 'border-rose-400/70 focus:ring-rose-400/50'
                        : 'border-white/20 focus:ring-indigo-400/50'
                    }`}
                    style={{
                      ...englishNumericStyle,
                      direction: 'rtl',
                    }}
                  />
                  {newSubId && validateSubscriptionId(newSubId) && (
                    <p className="text-[11px] font-bold text-rose-300">
                      {validateSubscriptionId(newSubId)}
                    </p>
                  )}
                </div>

                {/* Customer Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    اسم العميل (Customer Name):
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    disabled={isSubmittingCreate}
                    placeholder="اسم المشترك..."
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Issue Type */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    نوع التذكرة (Issue Type):
                  </label>
                  <select
                    value={newIssueType}
                    onChange={(e) => setNewIssueType(e.target.value)}
                    disabled={isSubmittingCreate}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
                  >
                    {ISSUE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-zinc-900 text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    الأولوية (Priority):
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as 'high' | 'medium' | 'low')}
                    disabled={isSubmittingCreate}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
                  >
                    <option value="high" className="bg-zinc-900 text-white">🔴 عالية (High)</option>
                    <option value="medium" className="bg-zinc-900 text-white">🟡 متوسطة (Medium)</option>
                    <option value="low" className="bg-zinc-900 text-white">🔵 منخفضة (Low)</option>
                  </select>
                </div>

                {/* Assigned Department */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    القسم المختص (Department):
                  </label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    disabled={isSubmittingCreate}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
                  >
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <option key={dept} value={dept} className="bg-zinc-900 text-white">
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Employee Assignment / Creator (on creation) */}
              {!editingTicket && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    الموظف المسؤول (Assigned / Created By):
                  </label>
                  <select
                    value={newAssignedUser || sessionUsername || ''}
                    onChange={(e) => setNewAssignedUser(e.target.value)}
                    disabled={isSubmittingCreate || (isLoadingUsers && userRoster.length === 0)}
                    required
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
                  >
                    <option value="" disabled className="bg-zinc-900 text-white/50">
                      {isLoadingUsers ? 'جاري تحميل قائمة المستخدمين...' : '-- اختر اسم الموظف --'}
                    </option>
                    {userRoster.map((username) => (
                      <option key={username} value={username} className="bg-zinc-900 text-white">
                        {username} {username === sessionUsername ? '(جلسة نشطة)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/90">
                  تفاصيل المشكلة / الوصف (Description):
                </label>
                <textarea
                  rows={3}
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  disabled={isSubmittingCreate}
                  placeholder="اشرح تفاصيل الشكوى أو التعويض أو الملاحظة المطلوبة من القسم المختص..."
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSubmittingCreate) {
                      setIsCreateModalOpen(false);
                      setEditingTicket(null);
                    }
                  }}
                  disabled={isSubmittingCreate}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold rounded-xl border border-white/20 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingCreate ||
                    !newDescription.trim() ||
                    Boolean(validateSubscriptionId(newSubId))
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 backdrop-blur-md text-white font-extrabold rounded-xl shadow-sm text-xs sm:text-sm cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isSubmittingCreate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{editingTicket ? 'جاري حفظ التعديلات...' : 'جاري الحفظ والإرسال...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>{editingTicket ? 'حفظ التعديلات' : 'إنشاء وإرسال التذكرة'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 2: RESOLVE / UPDATE TICKET (معالجة وحل التذكرة)
         ======================================================================== */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
          <div
            dir="rtl"
            className="font-sans bg-black/85 backdrop-blur-2xl rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-white text-right border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.75)] relative flex flex-col tabular-nums"
            style={{
              fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
              fontVariantNumeric: 'lining-nums tabular-nums',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/15 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-300">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <span>معالجة التذكرة</span>
                    <span className="font-mono text-emerald-300" style={englishNumericStyle} dir="ltr">
                      #{Number(selectedTicket.ticket_number || 0).toLocaleString('en-US')}
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/65">
                    تحديث حالة التذكرة إلى &quot;تم الحل&quot; وتوثيق ملاحظات الإجراء المتخذ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingResolve && setSelectedTicket(null)}
                disabled={isSubmittingResolve}
                className="text-white/60 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resolveModalError && (
              <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-3 text-xs font-bold text-rose-200">
                ⚠️ {resolveModalError}
              </div>
            )}

            {/* Ticket Details Summary Box */}
            <div className="bg-white/[0.04] border border-white/15 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-300" />
                  <span className="font-extrabold text-white text-sm">
                    {selectedTicket.customer_name || 'عميل غير محدد'}
                  </span>
                  {selectedTicket.subscription_id && (
                    <span
                      className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200"
                      style={englishNumericStyle}
                      dir="ltr"
                    >
                      #{toEnglishDigitsStr(selectedTicket.subscription_id)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {renderPriorityBadge(selectedTicket.priority)}
                  {renderStatusBadge(selectedTicket.status)}
                </div>
              </div>

              <div dir="rtl" className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10 text-white/75 text-right">
                <div className="text-right">
                  <span className="text-white/50">نوع التذكرة: </span>
                  <strong className="text-white">{selectedTicket.issue_type}</strong>
                </div>
                <div className="text-right">
                  <span className="text-white/50">القسم المختص: </span>
                  <strong className="text-white">
                    {selectedTicket.department || selectedTicket.assigned_department || 'إدارة'}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-white/50">بواسطة: </span>
                  <strong className="text-white">{selectedTicket.created_by}</strong>
                </div>
                <div className="text-right">
                  <span className="text-white/50">تاريخ الإنشاء: </span>
                  <strong className="font-mono text-white inline-block" style={englishNumericStyle}>
                    {formatCompactDateTime(selectedTicket.created_at)}
                  </strong>
                </div>
              </div>

              {/* SLA Turnaround & Closing Date (Strict RTL Layout) */}
              {selectedTicket.resolved_at ? (
                <div
                  dir="rtl"
                  className="pt-2.5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-right bg-emerald-500/10 border border-emerald-400/25 rounded-xl p-3.5"
                >
                  <div className="text-right">
                    <span className="text-emerald-200/75 block">تاريخ الإغلاق:</span>
                    <strong
                      className="font-mono text-emerald-100 inline-block mt-1"
                      style={englishNumericFontStyle}
                      dir="ltr"
                    >
                      {formatCompactDateTime(selectedTicket.resolved_at)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-200/75 block">وقت المعالجة (SLA):</span>
                    <strong
                      dir="rtl"
                      className="text-teal-200 block mt-1 font-extrabold text-right"
                      style={englishNumericFontStyle}
                    >
                      ⏱️ استغرقت: {toEnglishDigitsStr(formatSlaDuration(selectedTicket.created_at, selectedTicket.resolved_at) || '—')}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-white/10" dir="rtl">
                  <div className="flex items-center justify-between bg-teal-500/10 border border-teal-400/25 rounded-xl px-3 py-2 text-xs text-right">
                    <span className="text-teal-200/80 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-300" />
                      <span>عداد وقت الاستجابة (SLA Active):</span>
                    </span>
                    <strong
                      dir="rtl"
                      className="text-teal-200 font-extrabold text-right"
                      style={englishNumericFontStyle}
                    >
                      مضى حتى الآن: {toEnglishDigitsStr(formatSlaDuration(selectedTicket.created_at, new Date().toISOString()) || 'أقل من دقيقة')}
                    </strong>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-white/10">
                <div className="text-[11px] font-bold text-white/60 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-300" />
                  <span>تفاصيل التذكرة:</span>
                </div>
                <p className="text-xs text-white bg-black/30 rounded-xl p-2.5 border border-white/10 leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>
            </div>

            <form onSubmit={handleResolveTicketSubmit} className="space-y-4">
              {/* Status Selector (RTL Order: In Progress on Right, Resolved on Left) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/90">
                  تحديث حالة التذكرة:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setResolveStatus('in_progress')}
                    disabled={isSubmittingResolve}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                      resolveStatus === 'in_progress'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span>🟡 قيد التنفيذ (In Progress)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolveStatus('resolved')}
                    disabled={isSubmittingResolve}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                      resolveStatus === 'resolved'
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span>🟢 تم الحل (Resolved)</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Employee Assignment / Closer (`app_users.id` UUID) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/90">
                  الموظف المنفذ / المغلق للتذكرة (Resolved By):
                </label>
                <select
                  value={resolvedByUserId || matchedSessionAppUser?.id || appUsers[0]?.id || ''}
                  onChange={(e) => setResolvedByUserId(e.target.value)}
                  disabled={isSubmittingResolve || (isLoadingUsers && appUsers.length === 0)}
                  required
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 [color-scheme:dark] cursor-pointer"
                >
                  <option value="" disabled className="bg-zinc-900 text-white/50">
                    {isLoadingUsers ? 'جاري تحميل قائمة المستخدمين...' : '-- اختر اسم الموظف --'}
                  </option>
                  {appUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-zinc-900 text-white">
                      {u.username} {matchedSessionAppUser?.id === u.id ? '(جلسة نشطة)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ticket Resolution Action Dropdown (Strictly 2 Options) */}
              {resolveStatus === 'resolved' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    الإجراء المتخذ (Resolution Action):
                  </label>
                  <select
                    value={resolutionAction}
                    onChange={(e) => setResolutionAction(e.target.value)}
                    disabled={isSubmittingResolve}
                    required
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 [color-scheme:dark] cursor-pointer"
                  >
                    {TICKET_RESOLUTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-zinc-900 text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Resolution Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/90">
                  ملاحظات الحل (Resolution Notes):
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  disabled={isSubmittingResolve}
                  placeholder="اكتب ملاحظات الحل والتفاصيل النهائية..."
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 resize-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => !isSubmittingResolve && setSelectedTicket(null)}
                  disabled={isSubmittingResolve}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold rounded-xl border border-white/20 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold rounded-xl border border-emerald-400/50 shadow-lg shadow-emerald-500/25 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingResolve ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {resolveStatus === 'resolved'
                          ? 'تأكيد الحل وإغلاق التذكرة'
                          : 'حفظ تحديث التذكرة'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 3: DELETE CONFIRMATION (تأكيد حذف التذكرة - صلاحية الأدمن)
         ======================================================================== */}
      {deleteTargetTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="font-sans bg-black/90 backdrop-blur-2xl rounded-3xl w-full max-w-md p-6 space-y-4 text-white border border-rose-400/35 shadow-[0_24px_70px_rgba(0,0,0,0.8)]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  تأكيد حذف التذكرة{' '}
                  <span className="font-mono text-rose-300" style={englishNumericStyle} dir="ltr">
                    #{toEnglishDigitsStr(deleteTargetTicket.ticket_number)}
                  </span>
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  هل أنت متأكد من حذف هذه التذكرة نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
            </div>

            {deleteModalError && (
              <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-3 text-xs font-bold text-rose-200">
                ⚠️ {deleteModalError}
              </div>
            )}

            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 text-xs space-y-1">
              <div>
                <span className="text-white/50">العميل / الاشتراك: </span>
                <strong className="text-white">
                  {deleteTargetTicket.customer_name || 'غير محدد'}{' '}
                  {deleteTargetTicket.subscription_id && (
                    <span className="font-mono text-emerald-300" style={englishNumericStyle} dir="ltr">
                      (#{toEnglishDigitsStr(deleteTargetTicket.subscription_id)})
                    </span>
                  )}
                </strong>
              </div>
              <p className="text-white/75 line-clamp-2">{deleteTargetTicket.description}</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => !isDeletingTicket && setDeleteTargetTicket(null)}
                disabled={isDeletingTicket}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold rounded-xl border border-white/20 text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteTicket()}
                disabled={isDeletingTicket}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600/80 hover:bg-rose-500 text-white font-extrabold rounded-xl border border-rose-400/50 text-xs cursor-pointer disabled:opacity-50"
              >
                {isDeletingTicket ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأكيد الحذف النهائي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

