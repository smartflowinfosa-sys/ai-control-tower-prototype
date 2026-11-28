"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Video, ExternalLink, X, Clock, Bell } from 'lucide-react';

export interface TeamMeetingRecord {
  id: string;
  title: string;
  host_id: string;
  host_name: string;
  host_email?: string | null;
  meet_url: string;
  participant_ids: string[];
  participant_names: string[];
  participant_emails: string[];
  is_instant: boolean;
  scheduled_at: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  reminder_minutes: number[];
  sent_reminders: number[];
  ai_transcript?: string | null;
  ai_minutes?: string | null;
  created_at?: string;
}

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

function reminderMinutesToArabicLabel(mins: number): string {
  if (mins >= 1440) return 'قبل 24 ساعة';
  if (mins >= 60) return 'قبل ساعة واحدة';
  if (mins >= 30) return 'قبل 30 دقيقة';
  return `قبل ${mins} دقيقة`;
}

export default function GlobalMeetingBanner() {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
  const [bannerMeeting, setBannerMeeting] = useState<{
    meeting: TeamMeetingRecord;
    reason: 'active' | 'reminder';
    reminderLabel?: string;
  } | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  const checkMeetingsAndReminders = useCallback(async () => {
    if (sessionStatus !== 'authenticated' || !session?.user || pathname === '/login') {
      return;
    }

    const userId = String(session.user.id || '').trim();
    const username = String(session.user.username || '').trim().toLowerCase();
    const userEmail = String(session.user.email || '').trim().toLowerCase();

    try {
      const res = await fetch('/api/meetings', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const meetings: TeamMeetingRecord[] = Array.isArray(json?.meetings) ? json.meetings : [];

      const nowMs = Date.now();
      let candidate: {
        meeting: TeamMeetingRecord;
        reason: 'active' | 'reminder';
        reminderLabel?: string;
      } | null = null;

      for (const m of meetings) {
        if (!m || !m.id || m.status === 'completed' || m.status === 'cancelled') continue;

        const pIds = Array.isArray(m.participant_ids) ? m.participant_ids.map((v) => String(v).trim().toLowerCase()) : [];
        const pEmails = Array.isArray(m.participant_emails) ? m.participant_emails.map((v) => String(v).trim().toLowerCase()) : [];
        const isHost =
          (userId && m.host_id === userId) ||
          (username && m.host_id.toLowerCase() === username);
        const isParticipant =
          (userId && pIds.includes(userId.toLowerCase())) ||
          (username && pIds.includes(username)) ||
          (userEmail && pEmails.includes(userEmail));

        // 1. Background reminder checker for scheduled meetings
        if (m.status === 'scheduled' && m.scheduled_at) {
          const schedMs = Date.parse(m.scheduled_at);
          if (!Number.isNaN(schedMs)) {
            const reminderList = Array.isArray(m.reminder_minutes) ? m.reminder_minutes : [];
            const alreadySent = Array.isArray(m.sent_reminders) ? m.sent_reminders : [];

            const dueNewReminders = reminderList.filter(
              (mins) =>
                !alreadySent.includes(mins) &&
                nowMs >= schedMs - mins * 60 * 1000 &&
                nowMs <= schedMs + 30 * 60 * 1000
            );

            if (dueNewReminders.length > 0 && (isHost || isParticipant)) {
              const nextSent = Array.from(new Set([...alreadySent, ...dueNewReminders]));
              const label = reminderMinutesToArabicLabel(Math.min(...dueNewReminders));

              // Mark reminders as sent & trigger /api/meetings/notify in background
              void fetch('/api/meetings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: m.id, sent_reminders: nextSent }),
              }).catch(() => undefined);

              void fetch('/api/meetings/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: m.title,
                  host_name: m.host_name,
                  meet_url: m.meet_url,
                  scheduled_at: m.scheduled_at,
                  participant_emails: m.participant_emails || [],
                  is_instant: false,
                  is_reminder: true,
                  reminder_label: label,
                }),
              }).catch(() => undefined);
            }

            // Show banner if user is involved and we are within any reminder window or up to 30m after start
            if (isHost || isParticipant) {
              const maxWindowMins = reminderList.length > 0 ? Math.max(...reminderList) : 15;
              const windowStartMs = schedMs - maxWindowMins * 60 * 1000;
              const windowEndMs = schedMs + 30 * 60 * 1000;
              const key = `${m.id}-reminder`;
              if (nowMs >= windowStartMs && nowMs <= windowEndMs && !dismissedKeys.includes(key)) {
                const minsLeft = Math.max(0, Math.round((schedMs - nowMs) / 60000));
                const reminderLabel =
                  minsLeft === 0 ? 'يبدأ الاجتماع الآن' : `متبقي ${minsLeft} دقيقة على البدء`;
                if (!candidate) {
                  candidate = { meeting: m, reason: 'reminder', reminderLabel };
                }
              }
            }
          }
        }

        // 2. Active instant/live meeting involving the user (within last 2 hours)
        if (m.status === 'active' && (isParticipant || isHost)) {
          const schedMs = Date.parse(m.scheduled_at || m.created_at || '');
          const isRecent = Number.isNaN(schedMs) || nowMs - schedMs <= 2 * 60 * 60 * 1000;
          const key = `${m.id}-active`;
          if (isRecent && !dismissedKeys.includes(key)) {
            candidate = { meeting: m, reason: 'active' };
            break;
          }
        }
      }

      setBannerMeeting(candidate);
    } catch {
      // Non-blocking background poll
    }
  }, [session, sessionStatus, pathname, dismissedKeys]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || pathname === '/login') return;

    void checkMeetingsAndReminders();
    const interval = setInterval(() => {
      void checkMeetingsAndReminders();
    }, 30000);

    // Subscribe to Supabase Realtime for instant live invites
    const channel = supabase
      .channel('global-team-meetings-banner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_meetings' },
        () => {
          void checkMeetingsAndReminders();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [sessionStatus, pathname, checkMeetingsAndReminders]);

  if (!bannerMeeting || pathname === '/login') return null;

  const { meeting, reason, reminderLabel } = bannerMeeting;
  const dismissKey = `${meeting.id}-${reason}`;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[75] w-[94%] max-w-3xl animate-in fade-in slide-in-from-top-4">
      <div className="bg-[#0d1f1c]/90 backdrop-blur-2xl border border-teal-400/50 shadow-[0_18px_50px_rgba(0,0,0,0.65)] rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-300/40 text-teal-200 shrink-0">
            {reason === 'active' ? (
              <Video className="w-5 h-5 animate-pulse" />
            ) : (
              <Bell className="w-5 h-5 animate-bounce text-amber-300" />
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-300/40 text-emerald-200">
                {reason === 'active' ? 'دعوة اجتماع مباشر الآن' : reminderLabel || 'تذكير اجتماع مجدول'}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                {meeting.title}
              </span>
            </div>
            <div className="text-xs text-white/75 flex items-center gap-2.5 flex-wrap">
              <span>
                المضيف: <strong className="text-teal-200">{meeting.host_name}</strong>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-mono" dir="ltr" lang="en">
                <Clock className="w-3 h-3 text-teal-300" />
                {formatEnglishDateTime(meeting.scheduled_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={meeting.meet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white text-xs font-extrabold border border-teal-300/40 shadow-lg inline-flex items-center gap-1.5 transition-all"
          >
            <Video className="w-3.5 h-3.5" />
            <span>انضمام عبر Google Meet</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={() => {
              setDismissedKeys((prev) => [...prev, dismissKey]);
              setBannerMeeting(null);
            }}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold border border-white/20 inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>تجاهل</span>
          </button>
        </div>
      </div>
    </div>
  );
}
