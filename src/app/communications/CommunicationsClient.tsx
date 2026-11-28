"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { TeamMeetingRecord } from '@/components/communications/GlobalMeetingBanner';
import {
  Video,
  Users,
  Calendar,
  Clock,
  Mail,
  Bell,
  Pencil,
  Check,
  X,
  Loader2,
  ExternalLink,
  Mic,
  MicOff,
  Sparkles,
  Copy,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Send,
  FileText,
  Trash2,
} from 'lucide-react';

interface CommUser {
  id: string;
  username: string;
  role?: string;
  name_ar?: string | null;
  name_en?: string | null;
  job_title?: string | null;
  email?: string | null;
  personal_meet_url?: string | null;
  can_use_ai_minutes?: boolean;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

const REMINDER_OPTIONS = [
  { minutes: 1440, label: 'قبل 24 ساعة' },
  { minutes: 60, label: 'قبل ساعة واحدة' },
  { minutes: 30, label: 'قبل 30 دقيقة' },
  { minutes: 15, label: 'قبل 15 دقيقة' },
] as const;

function formatEnglishDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

function reminderMinutesLabel(mins: number): string {
  if (mins >= 1440) return 'قبل 24 ساعة';
  if (mins >= 60) return 'قبل ساعة واحدة';
  if (mins >= 30) return 'قبل 30 دقيقة';
  return `قبل ${mins} دقيقة`;
}

function parseExternalEmails(raw: string): string[] {
  return Array.from(
    new Set(
      String(raw || '')
        .split(/[,،;\s]+/)
        .map((e) => e.trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  );
}

function CleanRtlDateInput({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
}) {
  return (
    <div className="relative w-full">
      <input
        type={value ? 'date' : 'text'}
        placeholder=""
        dir="ltr"
        lang="en"
        required={required}
        value={value}
        onFocus={(e) => {
          e.currentTarget.type = 'date';
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // ignore
          }
        }}
        onClick={(e) => {
          if (e.currentTarget.type !== 'date') {
            e.currentTarget.type = 'date';
          }
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // ignore
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.value) {
            e.currentTarget.type = 'text';
          }
        }}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/10 border border-white/20 rounded-xl pl-9 pr-3 py-2.5 text-white text-xs font-mono outline-none focus:border-teal-300 cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
      />
      <Calendar className="w-4 h-4 text-white/60 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
    </div>
  );
}

export default function CommunicationsClient() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<CommUser[]>([]);
  const [meetings, setMeetings] = useState<TeamMeetingRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Personal Room Bar Edit State
  const [isEditingMyRoom, setIsEditingMyRoom] = useState<boolean>(false);
  const [myEmailInput, setMyEmailInput] = useState<string>('');
  const [myMeetUrlInput, setMyMeetUrlInput] = useState<string>('');
  const [isSavingMyRoom, setIsSavingMyRoom] = useState<boolean>(false);

  // Admin Edit User Modal State
  const [editingUser, setEditingUser] = useState<CommUser | null>(null);
  const [editUserEmail, setEditUserEmail] = useState<string>('');
  const [editUserMeetUrl, setEditUserMeetUrl] = useState<string>('');
  const [editUserCanAi, setEditUserCanAi] = useState<boolean>(false);
  const [isSavingAdminUser, setIsSavingAdminUser] = useState<boolean>(false);

  // Meeting Setup Form State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [externalEmailsInput, setExternalEmailsInput] = useState<string>('');
  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [isInstant, setIsInstant] = useState<boolean>(true);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [selectedReminders, setSelectedReminders] = useState<number[]>([60, 15]);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState<boolean>(false);

  // Last created email fallback links (shown when SMTP/Resend key is not configured)
  const [emailFallbackLinks, setEmailFallbackLinks] = useState<{
    title: string;
    mailtoUrl: string;
    gmailUrl: string;
    recipientsCount: number;
  } | null>(null);

  // Permission-Gated Free AI Meeting Minutes State
  const [activeMinutesMeeting, setActiveMinutesMeeting] = useState<TeamMeetingRecord | null>(null);
  const [isRecordingSpeech, setIsRecordingSpeech] = useState<boolean>(false);
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [generatedMinutes, setGeneratedMinutes] = useState<string>('');
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  // Send Meeting Minutes via Email Modal State
  const [isSendMinutesModalOpen, setIsSendMinutesModalOpen] = useState<boolean>(false);
  const [minutesRecipientIds, setMinutesRecipientIds] = useState<string[]>([]);
  const [minutesExternalGuests, setMinutesExternalGuests] = useState<string[]>([]);
  const [selectedExternalGuests, setSelectedExternalGuests] = useState<string[]>([]);
  const [minutesExtraExternalInput, setMinutesExtraExternalInput] = useState<string>('');
  const [minutesEmailSubject, setMinutesEmailSubject] = useState<string>('');
  const [isSendingMinutesEmail, setIsSendingMinutesEmail] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const sessionRole = String(session?.user?.role || '').trim().toUpperCase();
  const isAdminOrSuperAdmin = sessionRole === 'ADMIN' || sessionRole === 'SUPERADMIN';

  const parsedExternalEmails = useMemo(
    () => parseExternalEmails(externalEmailsInput),
    [externalEmailsInput]
  );

  const currentUserRecord = useMemo(() => {
    if (!session?.user || users.length === 0) return null;
    const sId = String(session.user.id || '').trim();
    const sUsername = String(session.user.username || '').trim().toLowerCase();
    return (
      users.find((u) => (sId && u.id === sId) || (sUsername && u.username.toLowerCase() === sUsername)) ||
      null
    );
  }, [session, users]);

  const canUseAiMinutes =
    isAdminOrSuperAdmin || currentUserRecord?.can_use_ai_minutes === true;

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [usersRes, meetingsRes] = await Promise.all([
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/meetings', { cache: 'no-store' }),
      ]);
      if (usersRes.ok) {
        const uJson = await usersRes.json().catch(() => ({}));
        if (Array.isArray(uJson?.users)) {
          setUsers(uJson.users);
        }
      }
      if (meetingsRes.ok) {
        const mJson = await meetingsRes.json().catch(() => ({}));
        if (Array.isArray(mJson?.meetings)) {
          setMeetings(mJson.meetings);
        }
      }
    } catch (err) {
      console.warn('Failed loading communications data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Sync personal room inputs whenever currentUserRecord loads
  useEffect(() => {
    if (currentUserRecord) {
      setMyEmailInput(currentUserRecord.email || '');
      setMyMeetUrlInput(currentUserRecord.personal_meet_url || '');
    }
  }, [currentUserRecord]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const handleSaveMyPersonalRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserRecord || isSavingMyRoom) return;

    const trimmedUrl = myMeetUrlInput.trim();
    if (!trimmedUrl || !/^https?:\/\/.+/i.test(trimmedUrl)) {
      showError('يرجى إدخال رابط Google Meet الدائم بشكل صحيح (يبدأ بـ https://meet.google.com/...)');
      return;
    }

    setIsSavingMyRoom(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUserRecord.id,
          username: currentUserRecord.username,
          email: myEmailInput.trim() || null,
          personal_meet_url: trimmedUrl,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'تعذر حفظ رابط Google Meet الدائم');
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUserRecord.id
            ? {
                ...u,
                email: myEmailInput.trim() || null,
                personal_meet_url: trimmedUrl,
              }
            : u
        )
      );
      setIsEditingMyRoom(false);
      showToast('تم حفظ رابط Google Meet الدائم والبريد الإلكتروني بنجاح');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حفظ بيانات غرفتك الدائمة');
    } finally {
      setIsSavingMyRoom(false);
    }
  };

  const handleSaveAdminUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || isSavingAdminUser) return;

    const trimmedUrl = editUserMeetUrl.trim();
    if (trimmedUrl && !/^https?:\/\/.+/i.test(trimmedUrl)) {
      showError('يرجى إدخال رابط Google Meet صحيح يبدأ بـ https://');
      return;
    }

    setIsSavingAdminUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          username: editingUser.username,
          email: editUserEmail.trim() || null,
          personal_meet_url: trimmedUrl || null,
          can_use_ai_minutes: editUserCanAi,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'تعذر تحديث بيانات المستخدم');
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                email: editUserEmail.trim() || null,
                personal_meet_url: trimmedUrl || null,
                can_use_ai_minutes: editUserCanAi,
              }
            : u
        )
      );
      setEditingUser(null);
      showToast(`تم تحديث بيانات وصلاحيات (${editingUser.name_ar || editingUser.username}) بنجاح`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر تحديث بيانات المستخدم');
    } finally {
      setIsSavingAdminUser(false);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleReminder = (mins: number) => {
    setSelectedReminders((prev) =>
      prev.includes(mins) ? prev.filter((m) => m !== mins) : [...prev, mins]
    );
  };

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingMeeting) return;

    const hostMeetUrl = currentUserRecord?.personal_meet_url?.trim() || '';
    if (!hostMeetUrl) {
      setIsEditingMyRoom(true);
      showError('يرجى حفظ رابط Google Meet الدائم الخاص بك في الشريط العلوي أولاً قبل إنشاء الاجتماع.');
      return;
    }

    if (!meetingTitle.trim()) {
      showError('يرجى إدخال موضوع الاجتماع.');
      return;
    }

    const externalEmails = parseExternalEmails(externalEmailsInput);
    if (selectedUserIds.length === 0 && externalEmails.length === 0) {
      showError('يرجى اختيار مشارك واحد على الأقل من الفريق أو إدخال بريد إلكتروني خارجي صحيح.');
      return;
    }

    let scheduledAtIso = new Date().toISOString();
    if (!isInstant) {
      if (!scheduledDate || !scheduledTime) {
        showError('يرجى تحديد تاريخ ووقت الاجتماع المجدول.');
        return;
      }
      const parsed = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (Number.isNaN(parsed.getTime())) {
        showError('تاريخ أو وقت الاجتماع غير صالح.');
        return;
      }
      scheduledAtIso = parsed.toISOString();
    }

    const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));
    const participantIds = selectedUsers.map((u) => u.id);
    const participantNames = [
      ...selectedUsers.map((u) => u.name_ar || u.name_en || u.username),
      ...externalEmails.map((em) => `ضيف خارجي (${em})`),
    ];
    const participantEmails = Array.from(
      new Set([
        ...selectedUsers
          .map((u) => (u.email || '').trim())
          .filter((em) => em.includes('@')),
        ...externalEmails,
      ])
    );

    const hostName =
      currentUserRecord?.name_ar ||
      session?.user?.name_ar ||
      session?.user?.name ||
      session?.user?.username ||
      'المضيف';

    setIsCreatingMeeting(true);
    try {
      const createRes = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle.trim(),
          host_id: currentUserRecord?.id || session?.user?.id || session?.user?.username,
          host_name: hostName,
          host_email: currentUserRecord?.email || session?.user?.email || null,
          meet_url: hostMeetUrl,
          participant_ids: participantIds,
          participant_names: participantNames,
          participant_emails: participantEmails,
          is_instant: isInstant,
          scheduled_at: scheduledAtIso,
          reminder_minutes: isInstant ? [] : selectedReminders,
        }),
      });

      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(createJson?.error || 'تعذر حفظ الاجتماع');
      }

      const createdMeeting: TeamMeetingRecord = createJson.meeting;
      setMeetings((prev) => [createdMeeting, ...prev]);

      // Notify participants via /api/meetings/notify (Resend if configured, else mailto/Gmail fallback)
      const notifyRes = await fetch('/api/meetings/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createdMeeting.title,
          host_name: hostName,
          meet_url: hostMeetUrl,
          scheduled_at: createdMeeting.scheduled_at,
          participant_emails: participantEmails,
          is_instant: isInstant,
          is_reminder: false,
        }),
      });
      const notifyJson = await notifyRes.json().catch(() => ({}));

      if (notifyJson?.deliveredVia === 'resend') {
        setEmailFallbackLinks(null);
        showToast(
          isInstant
            ? `تم بدء الاجتماع وإرسال الدعوة بالبريد الإلكتروني لـ (${participantEmails.length}) مشاركين!`
            : `تمت جدولة الاجتماع وإرسال الدعوة بالبريد الإلكتروني لـ (${participantEmails.length}) مشاركين!`
        );
      } else {
        if (notifyJson?.mailtoUrl || notifyJson?.gmailUrl) {
          setEmailFallbackLinks({
            title: createdMeeting.title,
            mailtoUrl: notifyJson.mailtoUrl || '',
            gmailUrl: notifyJson.gmailUrl || '',
            recipientsCount: participantEmails.length,
          });
        }
        showToast(
          isInstant
            ? 'تم بدء الاجتماع وإرسال التنبيه المباشر للفريق! يمكنك إرسال الإيميل للمدعوين بضغطة زر.'
            : 'تمت جدولة الاجتماع وحفظ التذكيرات! يمكنك إرسال الإيميل للمدعوين من الشريط أدناه.'
        );
      }

      if (isInstant) {
        window.open(hostMeetUrl, '_blank', 'noopener,noreferrer');
      }

      setMeetingTitle('');
      setSelectedUserIds([]);
      setExternalEmailsInput('');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر إنشاء الاجتماع');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const handleUpdateMeetingStatus = async (
    meetingId: string,
    nextStatus: 'active' | 'completed' | 'cancelled'
  ) => {
    try {
      const res = await fetch('/api/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: meetingId, status: nextStatus }),
      });
      if (!res.ok) throw new Error('تعذر تحديث حالة الاجتماع');
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, status: nextStatus } : m))
      );
      showToast(
        nextStatus === 'completed'
          ? 'تم إنهاء الاجتماع وأرشفته بنجاح'
          : 'تم تحديث حالة الاجتماع بنجاح'
      );
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر تحديث حالة الاجتماع');
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const res = await fetch(`/api/meetings?id=${encodeURIComponent(meetingId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('تعذر حذف الاجتماع');
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      if (activeMinutesMeeting?.id === meetingId) {
        setActiveMinutesMeeting(null);
      }
      showToast('تم حذف سجل الاجتماع بنجاح');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حذف الاجتماع');
    }
  };

  // Free Browser Web Speech API Transcription (ar-SA) — stays active until manually stopped
  const handleToggleSpeechRecording = () => {
    if (isRecordingSpeech || isRecordingRef.current) {
      isRecordingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsRecordingSpeech(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      showError(
        'متصفحك الحالي لا يدعم التسجيل الصوتي المباشر (Web Speech API). استخدم متصفح Chrome أو Edge أو الصق النص يدوياً.'
      );
      return;
    }

    const scheduleAutoRestart = () => {
      if (!isRecordingRef.current) return;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (!isRecordingRef.current) return;
        try {
          recognitionRef.current?.start();
        } catch {
          // Recognition may already be running; ignore
        }
      }, 150);
    };

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let addedText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result && result.isFinal && result[0]?.transcript) {
            addedText += result[0].transcript.trim() + '.\n';
          }
        }
        if (addedText) {
          setRawTranscript((prev) => (prev ? `${prev}${addedText}` : addedText));
        }
      };

      recognition.onerror = (event: { error?: string }) => {
        const errCode = String(event?.error || '');
        if (
          errCode === 'not-allowed' ||
          errCode === 'service-not-allowed' ||
          errCode === 'audio-capture'
        ) {
          isRecordingRef.current = false;
          if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = null;
          }
          setIsRecordingSpeech(false);
          showError(
            'تعذر الوصول إلى الميكروفون. يرجى منح صلاحية الميكروفون للمتصفح ثم المحاولة مجدداً.'
          );
          return;
        }

        // Non-fatal errors (no-speech, network, aborted): keep recording alive until Stop is clicked
        if (isRecordingRef.current) {
          scheduleAutoRestart();
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          scheduleAutoRestart();
        } else {
          setIsRecordingSpeech(false);
        }
      };

      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      recognition.start();
      setIsRecordingSpeech(true);
      showToast('بدأ التدوين الصوتي المباشر باللغة العربية (ar-SA) — سيبقى مستمراً حتى تضغط إيقاف.');
    } catch {
      isRecordingRef.current = false;
      showError('تعذر تشغيل الميكروفون. يرجى التأكد من منح صلاحية الميكروفون للمتصفح.');
      setIsRecordingSpeech(false);
    }
  };

  const handleGenerateAiMinutes = async () => {
    if (!rawTranscript.trim() || isGeneratingMinutes) {
      showError('يرجى تسجيل أو لصق نص الاجتماع أولاً.');
      return;
    }

    setIsGeneratingMinutes(true);
    try {
      const exactHostName =
        currentUserRecord?.name_en ||
        currentUserRecord?.name_ar ||
        currentUserRecord?.username ||
        session?.user?.name_en ||
        session?.user?.name_ar ||
        session?.user?.username ||
        session?.user?.name ||
        activeMinutesMeeting?.host_name ||
        'Host';

      const actualMeetingDate = activeMinutesMeeting?.scheduled_at
        ? formatEnglishDateTime(activeMinutesMeeting.scheduled_at)
        : !isInstant && scheduledDate
        ? `${scheduledDate} ${scheduledTime || '10:00'}`
        : formatEnglishDateTime(new Date().toISOString());

      const selectedParticipantNames =
        activeMinutesMeeting && activeMinutesMeeting.participant_names?.length > 0
          ? activeMinutesMeeting.participant_names
          : [
              ...users
                .filter((u) => selectedUserIds.includes(u.id))
                .map((u) => u.name_en || u.name_ar || u.username),
              ...parsedExternalEmails,
            ];

      const res = await fetch('/api/meetings/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: activeMinutesMeeting?.id || '',
          title: activeMinutesMeeting?.title || meetingTitle || 'اجتماع فريق العمل',
          host_name: exactHostName,
          meeting_date: actualMeetingDate,
          participants: selectedParticipantNames,
          transcript: rawTranscript.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'تعذر توليد محضر الاجتماع');
      }

      const minutesText = String(json?.ai_minutes || '');
      setGeneratedMinutes(minutesText);

      if (activeMinutesMeeting) {
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === activeMinutesMeeting.id
              ? { ...m, ai_transcript: rawTranscript.trim(), ai_minutes: minutesText }
              : m
          )
        );
      }

      showToast('تم توليد وحفظ محضر الاجتماع الرسمي بنجاح!');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر توليد محضر الاجتماع');
    } finally {
      setIsGeneratingMinutes(false);
    }
  };

  const handleCopyMinutes = async () => {
    if (!generatedMinutes) return;
    try {
      await navigator.clipboard.writeText(generatedMinutes);
      showToast('تم نسخ محضر الاجتماع إلى الحافظة بنجاح');
    } catch {
      showError('تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  const handleOpenSendMinutesModal = () => {
    if (!generatedMinutes.trim()) return;
    const defaultTitle = activeMinutesMeeting?.title || meetingTitle || 'اجتماع فريق العمل';
    setMinutesEmailSubject(`محضر اجتماع: ${defaultTitle}`);

    // Pre-select meeting participants (or currently checked users) who have a valid email
    const preferredIds =
      activeMinutesMeeting && activeMinutesMeeting.participant_ids?.length > 0
        ? activeMinutesMeeting.participant_ids
        : selectedUserIds;

    const preChecked = users
      .filter((u) => Boolean(u.email && u.email.includes('@')) && preferredIds.includes(u.id))
      .map((u) => u.id);

    // Collect external guest emails from active meeting (not matching system users) + currently entered external emails
    const systemEmailSet = new Set(
      users
        .map((u) => (u.email || '').trim().toLowerCase())
        .filter((e) => e.includes('@'))
    );
    const meetingExternal = (activeMinutesMeeting?.participant_emails || [])
      .map((e) => e.trim())
      .filter((e) => e.includes('@') && !systemEmailSet.has(e.toLowerCase()));
    const combinedExternals = Array.from(
      new Set([...meetingExternal, ...parseExternalEmails(externalEmailsInput)])
    );

    setMinutesRecipientIds(preChecked);
    setMinutesExternalGuests(combinedExternals);
    setSelectedExternalGuests(combinedExternals);
    setMinutesExtraExternalInput('');
    setIsSendMinutesModalOpen(true);
  };

  const handleSendMinutesViaEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatedMinutes.trim() || isSendingMinutesEmail) return;

    const systemEmails = users
      .filter((u) => minutesRecipientIds.includes(u.id) && u.email && u.email.includes('@'))
      .map((u) => String(u.email).trim());
    const extraEmails = parseExternalEmails(minutesExtraExternalInput);

    const targetEmails = Array.from(
      new Set([...systemEmails, ...selectedExternalGuests, ...extraEmails])
    );

    if (targetEmails.length === 0) {
      showError('يرجى اختيار مستلم واحد على الأقل أو إدخال بريد إلكتروني خارجي صحيح.');
      return;
    }

    setIsSendingMinutesEmail(true);
    try {
      const res = await fetch('/api/meetings/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'minutes',
          title: activeMinutesMeeting?.title || meetingTitle || 'اجتماع فريق العمل',
          subject: minutesEmailSubject.trim() || 'محضر اجتماع رسمي',
          minutes_text: generatedMinutes.trim(),
          participant_emails: targetEmails,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'تعذر إرسال المحضر عبر الإيميل');
      }

      if (json?.deliveredVia === 'resend') {
        showToast(
          `تم إرسال محضر الاجتماع بالبريد الإلكتروني إلى (${targetEmails.length.toLocaleString('en-US')}) مستلمين بنجاح!`
        );
      } else if (json?.gmailUrl) {
        window.open(json.gmailUrl, '_blank', 'noopener,noreferrer');
        showToast(
          `تم فتح رسالة Gmail جاهزة بمحضر الاجتماع وموجهة إلى (${targetEmails.length.toLocaleString('en-US')}) مستلمين.`
        );
      }

      setIsSendMinutesModalOpen(false);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر إرسال محضر الاجتماع');
    } finally {
      setIsSendingMinutesEmail(false);
    }
  };

  const handlePrintMinutes = () => {
    if (!generatedMinutes) return;
    const printWin = window.open('', '_blank', 'width=850,height=700');
    if (!printWin) return;
    const safeTitle = (activeMinutesMeeting?.title || 'محضر اجتماع رسمي').replace(/</g, '&lt;');
    const safeBody = generatedMinutes.replace(/</g, '&lt;').replace(/\n/g, '<br/>');
    printWin.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${safeTitle}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 32px; color: #0f172a; line-height: 1.8; }
            h1 { color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 10px; font-size: 20px; }
            .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>برج مراقبة زاهي — ${safeTitle}</h1>
          <div class="box">${safeBody}</div>
          <script>window.onload = function(){ window.print(); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const buildDirectEmailLink = (m: TeamMeetingRecord) => {
    const emails = (m.participant_emails || []).filter((e) => e.includes('@')).join(',');
    const subject = `دعوة اجتماع: ${m.title} — برج مراقبة زاهي`;
    const body = [
      'السلام عليكم ورحمة الله وبركاته،',
      '',
      `• موضوع الاجتماع: ${m.title}`,
      `• المضيف: ${m.host_name}`,
      `• الموعد: ${formatEnglishDateTime(m.scheduled_at)}`,
      `• رابط الدخول (Google Meet): ${m.meet_url}`,
    ].join('\n');
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      emails
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (sessionStatus === 'authenticated' && !isAdminOrSuperAdmin) {
    return null;
  }

  return (
    <div className="page-shell w-full mx-auto space-y-6 font-sans">
      {/* Toasts */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[95] bg-zinc-900/95 border border-teal-400/40 shadow-2xl text-white px-5 py-3 rounded-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{toast}</span>
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[95] bg-rose-950/95 border border-rose-400/50 shadow-2xl text-rose-100 px-5 py-3 rounded-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{errorMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <header className="glass-panel bg-white/[0.06] backdrop-blur-xl border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-400/35 text-teal-200">
            <Video className="w-6 h-6" />
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            تواصل (Meet)
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-teal-100 font-mono" lang="en">
            {users.length.toLocaleString('en-US')} أعضاء فريق
          </span>
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-xs font-bold text-emerald-200 font-mono" lang="en">
            {meetings.filter((m) => m.status === 'active' || m.status === 'scheduled').length.toLocaleString('en-US')} اجتماعات نشطة / مجدولة
          </span>
        </div>
      </header>

      {/* Top Personal Room Bar (Strictly Permanent Meet URL Workflow) */}
      <section className="glass-card bg-[#0d1f1c]/70 backdrop-blur-xl border border-teal-400/35 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-300/35 text-teal-200 shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                غرفة Google Meet الدائمة الخاصة بك ({currentUserRecord?.name_ar || session?.user?.name || 'المستخدم'})
              </h2>
              {currentUserRecord?.personal_meet_url ? (
                <div className="text-xs text-white/80 flex items-center gap-3 flex-wrap mt-1">
                  <a
                    href={currentUserRecord.personal_meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-teal-300 hover:underline inline-flex items-center gap-1"
                    dir="ltr"
                    lang="en"
                  >
                    <span>{currentUserRecord.personal_meet_url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-white/75" dir="ltr" lang="en">
                    <Mail className="w-3.5 h-3.5 text-teal-300" />
                    {currentUserRecord.email || 'لم يتم تعيين البريد الإلكتروني بعد'}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-amber-200 font-bold mt-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    لم تحفظ رابط Google Meet الدائم الخاص بك بعد. يرجى حفظه مرة واحدة لبدء أو جدولة الاجتماعات.
                  </span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingMyRoom((prev) => !prev)}
            className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/35 border border-teal-300/40 text-teal-100 text-xs font-extrabold inline-flex items-center gap-1.5 self-start md:self-auto cursor-pointer transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>
              {isEditingMyRoom
                ? 'إغلاق التعديل'
                : currentUserRecord?.personal_meet_url
                ? 'تحديث رابط غرفتي / إيميلي'
                : 'حفظ رابط Google Meet الدائم'}
            </span>
          </button>
        </div>

        {(isEditingMyRoom || (!isLoadingData && currentUserRecord && !currentUserRecord.personal_meet_url)) && (
          <form
            onSubmit={handleSaveMyPersonalRoom}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-white/15 text-xs items-end"
          >
            <div className="md:col-span-5 space-y-1">
              <label className="font-bold text-teal-200 block">
                رابط Google Meet الدائم الخاص بك:
              </label>
              <input
                type="url"
                required
                dir="ltr"
                lang="en"
                value={myMeetUrlInput}
                onChange={(e) => setMyMeetUrlInput(e.target.value)}
                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                className="w-full bg-black/40 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none focus:border-teal-400"
              />
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="font-bold text-teal-200 block">البريد الإلكتروني لاستلام الدعوات:</label>
              <input
                type="email"
                dir="ltr"
                lang="en"
                value={myEmailInput}
                onChange={(e) => setMyEmailInput(e.target.value)}
                placeholder="name@zahi.sa"
                className="w-full bg-black/40 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none focus:border-teal-400"
              />
            </div>

            <div className="md:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={isSavingMyRoom}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-extrabold border border-teal-300/40 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingMyRoom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>حفظ الغرفة الدائمة</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Instant Email Fallback Action Bar (when no Resend/SMTP API key is configured yet) */}
      {emailFallbackLinks && (
        <div className="glass-card bg-emerald-950/50 border border-emerald-400/45 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <Mail className="w-5 h-5 text-emerald-300 shrink-0" />
            <div>
              <span className="font-extrabold text-white">
                دعوة الإيميل جاهزة للإرسال للاجتماع ({emailFallbackLinks.title})
              </span>
              <p className="text-xs text-emerald-200/80">
                اضغط أدناه لفتح رسالة جاهزة تحتوي على إيميلات المدعوين ({emailFallbackLinks.recipientsCount.toLocaleString('en-US')}) والموعد ورابط Google Meet الدائم.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={emailFallbackLinks.gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold border border-emerald-300/40 inline-flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>إرسال الإيميل للمدعوين (Gmail)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={emailFallbackLinks.mailtoUrl}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>تطبيق البريد</span>
            </a>
            <button
              type="button"
              onClick={() => setEmailFallbackLinks(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Layout: Users Grid + Meeting Setup Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Right Column 1: Team Users Grid (Multi-Select + Admin Pencil Control) */}
        <section className="lg:col-span-7 glass-card bg-white/[0.06] backdrop-blur-xl border border-white/[0.24] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-300" />
              <div>
                <h2 className="text-base font-extrabold text-white">اختيار المدعوين من فريق العمل</h2>
                <p className="text-xs text-white/65">
                  حدد عضواً واحداً أو عدة أعضاء لإرسال دعوة الاجتماع والتذكيرات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-teal-500/20 border border-teal-400/35 text-teal-200" lang="en">
                المحدد: {selectedUserIds.length.toLocaleString('en-US')}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedUserIds.length === users.length) {
                    setSelectedUserIds([]);
                  } else {
                    setSelectedUserIds(users.map((u) => u.id));
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 cursor-pointer"
              >
                {selectedUserIds.length === users.length && users.length > 0 ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            </div>
          </div>

          {isLoadingData ? (
            <div className="py-12 flex items-center justify-center gap-2 text-white/65 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-teal-300" />
              <span>جاري تحميل قائمة الفريق...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                const displayName = u.name_ar || u.name_en || u.username;
                const hasMeetUrl = Boolean(u.personal_meet_url);

                return (
                  <div
                    key={u.id}
                    onClick={() => toggleSelectUser(u.id)}
                    className={`rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-teal-500/20 border-teal-300/60 shadow-md'
                        : 'bg-white/[0.04] border-white/15 hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(u.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 mt-1 rounded accent-teal-500 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-white truncate">{displayName}</div>
                          <div className="text-[11px] text-white/60 truncate">
                            {u.job_title || u.role || 'عضو فريق'}
                          </div>
                        </div>
                      </div>

                      {/* Admin-Only Edit Pencil Icon */}
                      {isAdminOrSuperAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingUser(u);
                            setEditUserEmail(u.email || '');
                            setEditUserMeetUrl(u.personal_meet_url || '');
                            setEditUserCanAi(Boolean(u.can_use_ai_minutes));
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-teal-500/30 border border-white/20 text-teal-200 transition-colors cursor-pointer shrink-0"
                          title="تعديل الإيميل ورابط Meet وصلاحية محضر AI"
                          aria-label="تعديل بيانات المستخدم"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          u.email
                            ? 'bg-white/10 border-white/20 text-white/85'
                            : 'bg-white/5 border-white/10 text-white/45'
                        }`}
                        dir="ltr"
                        lang="en"
                      >
                        <Mail className="w-3 h-3 text-teal-300" />
                        <span className="truncate max-w-[140px]">{u.email || 'بدون إيميل'}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold ${
                          hasMeetUrl
                            ? 'bg-emerald-500/20 border-emerald-400/35 text-emerald-200'
                            : 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                        }`}
                      >
                        <Video className="w-3 h-3" />
                        <span>{hasMeetUrl ? 'رابط Meet جاهز' : 'بدون رابط Meet'}</span>
                      </span>

                      {isAdminOrSuperAdmin && u.can_use_ai_minutes && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/35 text-purple-200 font-bold">
                          <Sparkles className="w-3 h-3" />
                          <span>محضر AI</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Column 2: Meeting Setup Panel */}
        <section className="lg:col-span-5 glass-card bg-white/[0.06] backdrop-blur-xl border border-white/[0.24] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/15 pb-3">
            <Calendar className="w-5 h-5 text-teal-300" />
            <h2 className="text-base font-extrabold text-white">إعداد وبدء / جدولة الاجتماع</h2>
          </div>

          <form onSubmit={handleSubmitMeeting} className="space-y-4 text-xs">
            {/* 1. Meeting Title */}
            <div className="space-y-1.5">
              <label className="font-bold text-white block">موضوع الاجتماع:</label>
              <input
                type="text"
                required
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="مثال: مراجعة خطة الإنتاج والمخزون الأسبوعية"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-300"
              />
            </div>

            {/* 1B. External Guest Emails (Outside System Users) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-bold text-teal-200 block">
                  دعوة بريد إلكتروني خارجي (من خارج النظام):
                </label>
                {parsedExternalEmails.length > 0 && (
                  <span
                    className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-200"
                    lang="en"
                  >
                    +{parsedExternalEmails.length.toLocaleString('en-US')}
                  </span>
                )}
              </div>
              <input
                type="text"
                dir="ltr"
                lang="en"
                value={externalEmailsInput}
                onChange={(e) => setExternalEmailsInput(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none focus:border-teal-300"
              />
            </div>

            {/* 2. Meeting Timing Toggle */}
            <div className="space-y-2">
              <label className="font-bold text-white block">توقيت الاجتماع:</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsInstant(true)}
                  className={`p-3 rounded-xl border text-center font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isInstant
                      ? 'bg-emerald-500/25 border-emerald-300/60 text-white shadow-md'
                      : 'bg-white/5 border-white/15 text-white/70 hover:text-white'
                  }`}
                >
                  <Video className="w-4 h-4 text-emerald-300" />
                  <span>اجتماع فوري الآن</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInstant(false)}
                  className={`p-3 rounded-xl border text-center font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !isInstant
                      ? 'bg-teal-500/25 border-teal-300/60 text-white shadow-md'
                      : 'bg-white/5 border-white/15 text-white/70 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4 text-teal-300" />
                  <span>تحديد موعد مجدول</span>
                </button>
              </div>
            </div>

            {/* Scheduled Date, Time & Multi-Reminders */}
            {!isInstant && (
              <div className="bg-black/30 border border-white/15 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-teal-200 block">التاريخ (YYYY-MM-DD):</label>
                    <CleanRtlDateInput
                      value={scheduledDate}
                      onChange={setScheduledDate}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-teal-200 block">الوقت (HH:MM):</label>
                    <input
                      type="time"
                      required
                      dir="ltr"
                      lang="en"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white font-mono text-xs outline-none focus:border-teal-300 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* 3. Multi-Select Email Reminders */}
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <label className="font-bold text-amber-200 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    <span>تذكيرات ما قبل الاجتماع (عبر الإيميل):</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {REMINDER_OPTIONS.map((opt) => {
                      const checked = selectedReminders.includes(opt.minutes);
                      return (
                        <label
                          key={opt.minutes}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            checked
                              ? 'bg-amber-500/20 border-amber-400/45 text-amber-100'
                              : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleReminder(opt.minutes)}
                            className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="font-bold" lang="en">
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCreatingMeeting}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-extrabold text-xs sm:text-sm border border-teal-300/45 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isCreatingMeeting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء الاجتماع وإرسال الدعوات...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {isInstant
                      ? 'إرسال الدعوة وبدء الاجتماع الآن'
                      : 'إرسال الدعوة وجدولة الاجتماع'}
                  </span>
                </>
              )}
            </button>
          </form>
        </section>
      </div>

      {/* Permission-Gated Free AI Meeting Minutes Tool (HIDDEN for unauthorized users) */}
      {canUseAiMinutes && (
        <section className="glass-card bg-[#0d1f1c]/70 backdrop-blur-xl border border-teal-400/35 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/15 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-300/40 text-teal-200">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <span>محضر الاجتماع الذكي (AI)</span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-200">
                    تدوين صوتي مجاني 100%
                  </span>
                </h2>
                <p className="text-xs text-white/70">
                  {activeMinutesMeeting
                    ? `الاجتماع المرتبط حالياً: ${activeMinutesMeeting.title}`
                    : 'سجّل حديث الاجتماع صوتياً باللغة العربية أو الصق النص لتوليد محضر اجتماع رسمي منظم'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleToggleSpeechRecording}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                  isRecordingSpeech
                    ? 'bg-rose-600 hover:bg-rose-500 border-rose-300/50 text-white animate-pulse'
                    : 'bg-teal-500/20 hover:bg-teal-500/35 border-teal-300/40 text-teal-100'
                }`}
              >
                {isRecordingSpeech ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>إيقاف التسجيل الصوتي</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>بدء تسجيل وتدوين الاجتماع صوتياً</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleGenerateAiMinutes()}
                disabled={isGeneratingMinutes || !rawTranscript.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold border border-emerald-300/45 shadow-md inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingMinutes ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>توليد محضر الاجتماع الرسمي</span>
              </button>

              <button
                type="button"
                onClick={handleOpenSendMinutesModal}
                disabled={!generatedMinutes.trim()}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold border border-white/25 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-all"
              >
                <Mail className="w-4 h-4 text-teal-300" />
                <span>إرسال المحضر بالإيميل</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            {/* Raw Transcript Box */}
            <div className="space-y-1.5">
              <label className="font-bold text-teal-200 block">
                نص الاجتماع الخام (تدوين صوتي مباشر أو لصق يدوي):
              </label>
              <textarea
                rows={8}
                value={rawTranscript}
                onChange={(e) => setRawTranscript(e.target.value)}
                placeholder="اضغط على 'بدء تسجيل وتدوين الاجتماع صوتياً' أثناء المكالمة أو اكتب/الصق النقاط هنا..."
                className="w-full bg-black/40 border border-white/20 rounded-2xl p-3.5 text-white text-xs leading-relaxed outline-none focus:border-teal-400"
              />
            </div>

            {/* Generated Official Minutes Box */}
            <div className="space-y-1.5 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="font-bold text-emerald-200">
                  محضر الاجتماع الرسمي (الملخص + القرارات + المهام):
                </label>
                {generatedMinutes && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyMinutes()}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>نسخ المحضر</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintMinutes}
                      className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-300/40 text-teal-100 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3 h-3" />
                      <span>طباعة / PDF</span>
                    </button>
                  </div>
                )}
              </div>
              <textarea
                rows={9}
                dir="rtl"
                value={generatedMinutes}
                onChange={(e) =>
                  setGeneratedMinutes(
                    e.target.value
                      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                  )
                }
                placeholder="سيظهر هنا المحضر الرسمي المقسّم إلى: 1. ملخص ما دار في الاجتماع، 2. القرارات المعتمدة، 3. المهام المطلوبة والمسؤولين..."
                className="w-full flex-1 bg-black/40 border border-emerald-400/30 rounded-2xl p-4 text-emerald-50 text-xs sm:text-sm text-right leading-7 whitespace-pre-wrap outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        </section>
      )}

      {/* Meetings Schedule & History List */}
      <section className="glass-card bg-white/[0.06] backdrop-blur-xl border border-white/[0.24] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/15 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-300" />
            <h2 className="text-base font-extrabold text-white">
              سجل الاجتماعات الفورية والمجدولة
            </h2>
          </div>
          <span className="text-xs font-mono text-white/75" lang="en">
            الإجمالي: {meetings.length.toLocaleString('en-US')}
          </span>
        </div>

        {meetings.length === 0 ? (
          <div className="py-10 text-center text-white/60 text-xs">
            لا توجد اجتماعات مسجلة حتى الآن. اختر أعضاء الفريق وأنشئ أول اجتماع فوري أو مجدول من الأعلى.
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="bg-black/30 border border-white/15 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white">{m.title}</span>
                    {m.status === 'active' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 border border-emerald-400/35 text-emerald-200">
                        مباشر الآن
                      </span>
                    )}
                    {m.status === 'scheduled' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 border border-amber-400/35 text-amber-200">
                        مجدول
                      </span>
                    )}
                    {m.status === 'completed' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 border border-white/20 text-white/75">
                        مكتمل
                      </span>
                    )}
                  </div>

                  <div className="text-white/75 flex items-center gap-3 flex-wrap">
                    <span>
                      المضيف: <strong className="text-teal-200">{m.host_name}</strong>
                    </span>
                    <span>•</span>
                    <span className="font-mono" dir="ltr" lang="en">
                      {formatEnglishDateTime(m.scheduled_at)}
                    </span>
                    {m.participant_names?.length > 0 && (
                      <>
                        <span>•</span>
                        <span>المدعوون: {m.participant_names.join('، ')}</span>
                      </>
                    )}
                  </div>

                  {Array.isArray(m.reminder_minutes) && m.reminder_minutes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {m.reminder_minutes.map((mins) => (
                        <span
                          key={`${m.id}-rem-${mins}`}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 font-bold"
                          lang="en"
                        >
                          تذكير: {reminderMinutesLabel(mins)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <a
                    href={m.meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-teal-500/25 hover:bg-teal-500/40 border border-teal-300/40 text-white font-extrabold inline-flex items-center gap-1.5"
                  >
                    <Video className="w-3.5 h-3.5 text-teal-200" />
                    <span>انضمام عبر Google Meet</span>
                  </a>

                  <a
                    href={buildDirectEmailLink(m)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold inline-flex items-center gap-1.5"
                    title="إرسال الدعوة عبر Gmail للمدعوين"
                  >
                    <Mail className="w-3.5 h-3.5 text-teal-300" />
                    <span>إيميل</span>
                  </a>

                  {canUseAiMinutes && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMinutesMeeting(m);
                        setRawTranscript(m.ai_transcript || '');
                        setGeneratedMinutes(m.ai_minutes || '');
                        showToast(`تم فتح محضر الاجتماع الذكي لـ (${m.title})`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/35 text-purple-100 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>محضر AI</span>
                    </button>
                  )}

                  {m.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => void handleUpdateMeetingStatus(m.id, 'completed')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-200 font-bold cursor-pointer"
                    >
                      إنهاء
                    </button>
                  )}

                  {isAdminOrSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteMeeting(m.id)}
                      className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/35 text-rose-200 cursor-pointer"
                      title="حذف الاجتماع"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admin-Only Edit User Modal (Email, Permanent Meet URL, AI Minutes Permission) */}
      {isAdminOrSuperAdmin && editingUser && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-md p-6 space-y-4 text-white border border-teal-400/40 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/35 text-teal-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">
                    إعدادات تواصل العضو وصلاحية AI
                  </h4>
                  <p className="text-xs text-teal-200">
                    {editingUser.name_ar || editingUser.username} ({editingUser.username})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={isSavingAdminUser}
                className="text-white/60 hover:text-white bg-white/10 p-1.5 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminUserUpdate} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-white block">البريد الإلكتروني (Email):</label>
                <input
                  type="email"
                  dir="ltr"
                  lang="en"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  placeholder="member@zahi.sa"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none focus:border-teal-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-white block">رابط Google Meet الدائم:</label>
                <input
                  type="url"
                  dir="ltr"
                  lang="en"
                  value={editUserMeetUrl}
                  onChange={(e) => setEditUserMeetUrl(e.target.value)}
                  placeholder="https://meet.google.com/xxx-yyyy-zzz"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none focus:border-teal-400"
                />
              </div>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-purple-500/10 border border-purple-400/30 cursor-pointer">
                <div>
                  <div className="font-extrabold text-purple-100">صلاحية محضر الاجتماع (AI)</div>
                  <div className="text-[11px] text-purple-200/75">
                    السماح لهذا المستخدم بتسجيل وتوليد محاضر الاجتماعات الذكية
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={editUserCanAi}
                  onChange={(e) => setEditUserCanAi(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500 cursor-pointer shrink-0"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={isSavingAdminUser}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdminUser}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-extrabold border border-teal-300/45 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingAdminUser ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>حفظ الإعدادات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Send Official Meeting Minutes via Email (إرسال المحضر بالإيميل) */}
      {isSendMinutesModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 text-white border border-teal-400/40 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/35 text-teal-200">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">إرسال المحضر بالإيميل</h4>
                  <p className="text-xs text-teal-200/80" lang="en">
                    المستلمون المحددون:{' '}
                    {(
                      minutesRecipientIds.length +
                      selectedExternalGuests.length +
                      parseExternalEmails(minutesExtraExternalInput).length
                    ).toLocaleString('en-US')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSendMinutesModalOpen(false)}
                disabled={isSendingMinutesEmail}
                className="text-white/60 hover:text-white bg-white/10 p-1.5 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendMinutesViaEmail} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-white block">عنوان الرسالة (Subject):</label>
                <input
                  type="text"
                  required
                  value={minutesEmailSubject}
                  onChange={(e) => setMinutesEmailSubject(e.target.value)}
                  placeholder="محضر اجتماع: ..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white">اختيار المستلمين من أعضاء الفريق:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const withEmailIds = users
                        .filter((u) => Boolean(u.email && u.email.includes('@')))
                        .map((u) => u.id);
                      if (minutesRecipientIds.length === withEmailIds.length) {
                        setMinutesRecipientIds([]);
                      } else {
                        setMinutesRecipientIds(withEmailIds);
                      }
                    }}
                    className="text-[11px] font-bold text-teal-300 hover:underline cursor-pointer"
                  >
                    تحديد جميع من لديهم إيميل
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-white/15 bg-white/[0.03] divide-y divide-white/10">
                  {minutesExternalGuests.map((guestEmail) => {
                    const checked = selectedExternalGuests.includes(guestEmail);
                    return (
                      <label
                        key={`ext-guest-${guestEmail}`}
                        className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/5 bg-teal-500/10 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedExternalGuests((prev) =>
                                prev.includes(guestEmail)
                                  ? prev.filter((em) => em !== guestEmail)
                                  : [...prev, guestEmail]
                              );
                            }}
                            className="w-4 h-4 rounded accent-teal-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-teal-100 flex items-center gap-1.5">
                              <span>ضيف خارجي</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/35 text-teal-200">
                                خارج النظام
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-white/85 truncate" dir="ltr" lang="en">
                              {guestEmail}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}

                  {users.map((u) => {
                    const hasEmail = Boolean(u.email && u.email.includes('@'));
                    const checked = minutesRecipientIds.includes(u.id);
                    const displayName = u.name_ar || u.name_en || u.username;

                    return (
                      <label
                        key={`min-rec-${u.id}`}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          hasEmail ? 'cursor-pointer hover:bg-white/5' : 'opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            disabled={!hasEmail}
                            checked={checked}
                            onChange={() => {
                              if (!hasEmail) return;
                              setMinutesRecipientIds((prev) =>
                                prev.includes(u.id)
                                  ? prev.filter((id) => id !== u.id)
                                  : [...prev, u.id]
                              );
                            }}
                            className="w-4 h-4 rounded accent-teal-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{displayName}</div>
                            {hasEmail ? (
                              <div className="text-[11px] font-mono text-teal-200/80 truncate" dir="ltr" lang="en">
                                {u.email}
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-300/90">
                                لا يوجد بريد إلكتروني محفوظ لهذا المستخدم بعد
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-teal-200 block">
                  إضافة بريد إلكتروني خارجي إضافي (اختياري):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  lang="en"
                  value={minutesExtraExternalInput}
                  onChange={(e) => setMinutesExtraExternalInput(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-white font-mono text-xs outline-none focus:border-teal-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => setIsSendMinutesModalOpen(false)}
                  disabled={isSendingMinutesEmail}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={
                    isSendingMinutesEmail ||
                    (minutesRecipientIds.length === 0 &&
                      selectedExternalGuests.length === 0 &&
                      parseExternalEmails(minutesExtraExternalInput).length === 0)
                  }
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-extrabold border border-teal-300/45 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSendingMinutesEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال المحضر الآن</span>
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
