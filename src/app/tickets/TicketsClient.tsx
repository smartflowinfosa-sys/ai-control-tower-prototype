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
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('en');

const SAUDI_TZ = 'Asia/Riyadh';

const englishNumericStyle: CSSProperties = {
  fontFamily: 'var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
  fontVariantNumeric: 'lining-nums tabular-nums',
  direction: 'ltr',
};

const toEnglishDigitsStr = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
};

export interface TicketRecord {
  id: string;
  ticket_number: number;
  subscription_id: string | null;
  customer_name: string | null;
  issue_type: string;
  priority: 'high' | 'medium' | 'low' | string;
  status: 'open' | 'in_progress' | 'resolved' | string;
  description: string;
  assigned_department: string | null;
  resolution_notes: string | null;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
}

const ISSUE_TYPE_OPTIONS = ['تعويض', 'شكوى', 'استفسار', 'تأخير'] as const;
const DEPARTMENT_OPTIONS = ['مطبخ', 'توصيل', 'إدارة'] as const;

export default function TicketsClient() {
  const { lang } = useLanguage();
  const { data: session } = useSession();

  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newSubId, setNewSubId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newIssueType, setNewIssueType] = useState<string>('تعويض');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newDepartment, setNewDepartment] = useState<string>('مطبخ');
  const [newDescription, setNewDescription] = useState<string>('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Resolve / Update Ticket Modal State
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'resolved' | 'in_progress' | 'open'>('resolved');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState<boolean>(false);
  const [resolveModalError, setResolveModalError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

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
    void fetchTickets();
  }, [fetchTickets]);

  // Top Summary Counts (computed across all tickets)
  const summaryCounts = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;

    for (const t of tickets) {
      const st = String(t.status || 'open').toLowerCase();
      if (st === 'resolved' || st === 'closed') {
        resolved++;
      } else if (st === 'in_progress' || st === 'in-progress') {
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
      const st = String(t.status || 'open').toLowerCase();
      const pr = String(t.priority || 'medium').toLowerCase();
      const dept = String(t.assigned_department || '');

      if (statusFilter !== 'ALL' && st !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && pr !== priorityFilter) {
        return false;
      }
      if (departmentFilter !== 'ALL' && dept !== departmentFilter) {
        return false;
      }
      if (q) {
        const numMatch = String(t.ticket_number || '').includes(q);
        const subMatch = String(t.subscription_id || '').toLowerCase().includes(q);
        const custMatch = String(t.customer_name || '').toLowerCase().includes(q);
        const descMatch = String(t.description || '').toLowerCase().includes(q);
        const issueMatch = String(t.issue_type || '').toLowerCase().includes(q);
        const deptMatch = dept.toLowerCase().includes(q);
        if (!numMatch && !subMatch && !custMatch && !descMatch && !issueMatch && !deptMatch) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, departmentFilter, searchQuery]);

  const handleOpenCreateModal = () => {
    setNewSubId('');
    setNewCustomerName('');
    setNewIssueType('تعويض');
    setNewPriority('medium');
    setNewDepartment('مطبخ');
    setNewDescription('');
    setCreateModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateTicketSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);

    if (!newDescription.trim()) {
      setCreateModalError('يرجى إدخال وصف وتفاصيل التذكرة.');
      return;
    }

    try {
      setIsSubmittingCreate(true);
      const createdBy =
        session?.user?.name ||
        session?.user?.email ||
        'موظف العمليات';

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_id: toEnglishDigitsStr(newSubId),
          customer_name: newCustomerName.trim(),
          issue_type: newIssueType,
          priority: newPriority,
          assigned_department: newDepartment,
          description: newDescription.trim(),
          created_by: createdBy,
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
    } catch (err: unknown) {
      console.error('Error creating ticket:', err);
      setCreateModalError(err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء التذكرة');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenResolveModal = (ticket: TicketRecord) => {
    setSelectedTicket(ticket);
    const currentSt = String(ticket.status || 'open').toLowerCase();
    setResolveStatus(currentSt === 'resolved' ? 'resolved' : 'resolved');
    setResolutionNotes(ticket.resolution_notes || '');
    setResolveModalError(null);
  };

  const handleResolveTicketSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setResolveModalError(null);

    if (resolveStatus === 'resolved' && !resolutionNotes.trim()) {
      setResolveModalError('يرجى كتابة ملاحظات الحل قبل إغلاق التذكرة.');
      return;
    }

    try {
      setIsSubmittingResolve(true);
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTicket.id,
          ticket_number: selectedTicket.ticket_number,
          status: resolveStatus,
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
          ? `تم إغلاق وحل التذكرة #${toEnglishDigitsStr(num)} بنجاح ✨`
          : `تم تحديث حالة التذكرة #${toEnglishDigitsStr(num)} بنجاح ✨`
      );
    } catch (err: unknown) {
      console.error('Error resolving ticket:', err);
      setResolveModalError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث التذكرة');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const formatKsaDateTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const m = dayjs(iso).tz(SAUDI_TZ).locale('en');
    return m.isValid() ? `${m.format('YYYY-MM-DD hh:mm A')} KSA` : iso;
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
    const s = String(status || 'open').toLowerCase();
    if (s === 'resolved' || s === 'closed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-500/20 border border-emerald-400/50 text-emerald-200">
          <span>🟢</span>
          <span>تم الحل (Resolved)</span>
        </span>
      );
    }
    if (s === 'in_progress' || s === 'in-progress') {
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 border border-indigo-400/50 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
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

          {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || departmentFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setDepartmentFilter('ALL');
                setSearchQuery('');
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-300" />
              <span>بحث (رقم التذكرة، الاشتراك، العميل):</span>
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
                <th className="py-3.5 px-4 whitespace-nowrap">التاريخ (KSA)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">المشترك / العميل</th>
                <th className="py-3.5 px-4 whitespace-nowrap">النوع</th>
                <th className="py-3.5 px-4 whitespace-nowrap">القسم المختص</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الأولوية</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الحالة</th>
                <th className="py-3.5 px-4">الوصف وملاحظات الحل</th>
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
                  const isResolved = String(t.status || '').toLowerCase() === 'resolved';

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

                      {/* 2. Created At (KSA) */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-white/85" style={englishNumericStyle} dir="ltr">
                        {formatKsaDateTime(t.created_at)}
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

                      {/* 5. Assigned Department */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-xs font-bold text-white/90">
                          <Building2 className="w-3.5 h-3.5 text-teal-300" />
                          <span>{t.assigned_department || 'إدارة'}</span>
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

                      {/* 8. Description & Resolution Notes */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-white/90 line-clamp-2 font-medium">
                          {t.description}
                        </p>
                        {t.resolution_notes && (
                          <p className="text-[11px] text-emerald-300 mt-1 line-clamp-1 font-bold">
                            ✓ الحل: {t.resolution_notes}
                          </p>
                        )}
                      </td>

                      {/* 9. Action */}
                      <td
                        className="py-3.5 px-4 text-center whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenResolveModal(t);
                        }}
                      >
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            isResolved
                              ? 'bg-white/10 hover:bg-white/15 border-white/20 text-white/80'
                              : 'bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-400/50 text-emerald-200 hover:text-white'
                          }`}
                        >
                          {isResolved ? 'عرض التفاصيل' : 'معالجة / حل التذكرة'}
                        </button>
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
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">إنشاء تذكرة جديدة 🎫</h3>
                  <p className="text-[11px] text-white/65">
                    تسجيل تذكرة تشغيلية جديدة وإرسال إشعار فوري للقسم المختص
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingCreate && setIsCreateModalOpen(false)}
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
                {/* Subscription ID */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-white/90">
                    رقم الاشتراك (Subscription ID):
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={newSubId}
                    onChange={(e) => setNewSubId(toEnglishDigitsStr(e.target.value))}
                    disabled={isSubmittingCreate}
                    placeholder="مثال: 2703326"
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                    style={englishNumericStyle}
                  />
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
                  onClick={() => !isSubmittingCreate && setIsCreateModalOpen(false)}
                  disabled={isSubmittingCreate}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold rounded-xl border border-white/20 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate || !newDescription.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-extrabold rounded-xl border border-indigo-400/50 shadow-lg shadow-indigo-500/25 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCreate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ والإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>إنشاء وإرسال التذكرة</span>
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
            className="font-sans bg-black/85 backdrop-blur-2xl rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-white border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.75)] relative flex flex-col tabular-nums"
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

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-white/75">
                <div>
                  <span className="text-white/50">نوع التذكرة: </span>
                  <strong className="text-white">{selectedTicket.issue_type}</strong>
                </div>
                <div>
                  <span className="text-white/50">القسم المختص: </span>
                  <strong className="text-white">{selectedTicket.assigned_department || 'إدارة'}</strong>
                </div>
                <div>
                  <span className="text-white/50">أنشئت بواسطة: </span>
                  <strong className="text-white">{selectedTicket.created_by}</strong>
                </div>
                <div>
                  <span className="text-white/50">تاريخ الإنشاء: </span>
                  <strong className="font-mono text-white" style={englishNumericStyle} dir="ltr">
                    {formatKsaDateTime(selectedTicket.created_at)}
                  </strong>
                </div>
              </div>

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
              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/90">
                  تحديث حالة التذكرة:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
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
                </div>
              </div>

              {/* Resolution Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-white/90">
                  ملاحظات الحل (Resolution Notes):
                </label>
                <textarea
                  rows={3}
                  required={resolveStatus === 'resolved'}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  disabled={isSubmittingResolve}
                  placeholder="اكتب الإجراء الذي تم اتخاذه لحل المشكلة أو تعويض العميل..."
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
    </div>
  );
}

