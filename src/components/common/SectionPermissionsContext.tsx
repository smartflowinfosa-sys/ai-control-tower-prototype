"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ShieldCheck,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Users,
} from "lucide-react";

export type SectionKey =
  | "dashboard"
  | "reports_quantity"
  | "reports_packaging"
  | "production"
  | "inventory"
  | "tickets"
  | "communications"
  | "suppliers";

export interface SystemSectionDef {
  key: SectionKey;
  labelAr: string;
  href: string;
}

export const ALL_SYSTEM_SECTIONS: SystemSectionDef[] = [
  { key: "dashboard", labelAr: "الرئيسية (Dashboard)", href: "/" },
  { key: "reports_quantity", labelAr: "فاتورة الكمية", href: "/operations/quantity" },
  { key: "reports_packaging", labelAr: "التغليف", href: "/operations/packaging" },
  { key: "production", labelAr: "الإنتاج (Production)", href: "/production" },
  { key: "inventory", labelAr: "إدارة المخزون (Inventory)", href: "/inventory" },
  { key: "tickets", labelAr: "التذاكر والعمليات", href: "/tickets" },
  { key: "communications", labelAr: "تواصل (Meet)", href: "/communications" },
  { key: "suppliers", labelAr: "الموردين (Suppliers)", href: "/suppliers" },
];

const VALID_SECTION_KEY_SET = new Set<string>(ALL_SYSTEM_SECTIONS.map((s) => s.key));

export function normalizeAllowedSections(raw: unknown): SectionKey[] {
  if (!Array.isArray(raw)) return ["inventory"];
  const filtered = raw
    .map((item) => String(item || "").trim())
    .filter((k): k is SectionKey => VALID_SECTION_KEY_SET.has(k));
  return Array.from(new Set(filtered));
}

export function getSectionKeyForPath(pathname: string | null | undefined): SectionKey | null {
  const path = String(pathname || "").trim();
  if (!path || path === "/login") return null;
  if (path === "/" || path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  if (path === "/operations/quantity" || path.startsWith("/operations/quantity/")) return "reports_quantity";
  if (path === "/operations/packaging" || path.startsWith("/operations/packaging/")) return "reports_packaging";
  if (path === "/operations/inventory" || path.startsWith("/operations/inventory/")) return "inventory";
  if (path === "/production" || path.startsWith("/production/")) return "production";
  if (path === "/inventory" || path.startsWith("/inventory/")) return "inventory";
  if (path === "/tickets" || path.startsWith("/tickets/")) return "tickets";
  if (path === "/communications" || path.startsWith("/communications/")) return "communications";
  if (
    path === "/suppliers" ||
    path.startsWith("/suppliers/") ||
    path === "/supplier-discovery" ||
    path.startsWith("/supplier-discovery/")
  ) {
    return "suppliers";
  }
  return null;
}

export function getHrefForSectionKey(key: SectionKey): string {
  const found = ALL_SYSTEM_SECTIONS.find((s) => s.key === key);
  return found ? found.href : "/inventory";
}

interface StaffPermissionUser {
  id: string;
  username: string;
  role: string;
  name_ar: string | null;
  name_en: string | null;
  job_title: string | null;
  allowed_sections: SectionKey[];
}

interface SectionPermissionsContextValue {
  isAdminOrSuperAdmin: boolean;
  permissionsLoaded: boolean;
  allowedSections: SectionKey[];
  canAccessSection: (key: SectionKey) => boolean;
  firstAllowedHref: string;
  openPermissionsModal: () => void;
}

const ALL_KEYS: SectionKey[] = ALL_SYSTEM_SECTIONS.map((s) => s.key);

const SectionPermissionsContext = createContext<SectionPermissionsContextValue>({
  isAdminOrSuperAdmin: false,
  permissionsLoaded: false,
  allowedSections: ["inventory"],
  canAccessSection: () => false,
  firstAllowedHref: "/inventory",
  openPermissionsModal: () => {},
});

export function useSectionPermissions() {
  return useContext(SectionPermissionsContext);
}

export function SectionPermissionsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const rawRole = String(session?.user?.role || "").trim().toUpperCase();
  const isAdminOrSuperAdmin = rawRole === "ADMIN" || rawRole === "SUPERADMIN";

  const [userAllowedSections, setUserAllowedSections] = useState<SectionKey[]>(["inventory"]);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);

  // Admin Permissions Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffUsers, setStaffUsers] = useState<StaffPermissionUser[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<Record<string, SectionKey[]>>({});
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Global toast shown briefly after saving permissions
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Load current logged-in user's allowed_sections from /api/users (live from Supabase)
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus !== "authenticated" || !session?.user) {
      setPermissionsLoaded(true);
      return;
    }

    if (isAdminOrSuperAdmin) {
      setUserAllowedSections(ALL_KEYS);
      setPermissionsLoaded(true);
      return;
    }

    // Seed from JWT immediately if present, then refresh live from DB
    if (Array.isArray(session.user.allowed_sections)) {
      setUserAllowedSections(normalizeAllowedSections(session.user.allowed_sections));
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(json?.users)) {
          const sId = String(session.user.id || "").trim();
          const sUsername = String(session.user.username || "").trim().toLowerCase();
          const match = json.users.find(
            (u: { id?: string; username?: string }) =>
              (sId && u.id === sId) ||
              (sUsername && String(u.username || "").toLowerCase() === sUsername)
          );
          if (match) {
            setUserAllowedSections(normalizeAllowedSections(match.allowed_sections));
          }
        }
      } catch {
        // keep JWT/default fallback
      } finally {
        if (!cancelled) {
          setPermissionsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, session, isAdminOrSuperAdmin]);

  const allowedSections = useMemo<SectionKey[]>(() => {
    if (isAdminOrSuperAdmin) return ALL_KEYS;
    return userAllowedSections;
  }, [isAdminOrSuperAdmin, userAllowedSections]);

  const canAccessSection = useCallback(
    (key: SectionKey): boolean => {
      if (isAdminOrSuperAdmin) return true;
      return allowedSections.includes(key);
    },
    [isAdminOrSuperAdmin, allowedSections]
  );

  const firstAllowedHref = useMemo(() => {
    if (isAdminOrSuperAdmin) return "/";
    const firstKey = allowedSections[0] || "inventory";
    return getHrefForSectionKey(firstKey);
  }, [isAdminOrSuperAdmin, allowedSections]);

  // Direct URL route protection for non-admin users
  const currentSectionKey = getSectionKeyForPath(pathname);
  const isRouteRestricted =
    sessionStatus === "authenticated" &&
    permissionsLoaded &&
    !isAdminOrSuperAdmin &&
    pathname !== "/login" &&
    Boolean(currentSectionKey && !allowedSections.includes(currentSectionKey));

  useEffect(() => {
    if (isRouteRestricted && firstAllowedHref && pathname !== firstAllowedHref) {
      router.replace(firstAllowedHref);
    }
  }, [isRouteRestricted, firstAllowedHref, pathname, router]);

  // Open Admin Permissions Modal and fetch non-admin staff users
  const openPermissionsModal = useCallback(async () => {
    if (!isAdminOrSuperAdmin) return;
    setIsModalOpen(true);
    setModalFeedback(null);
    setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(json?.users)) {
        throw new Error(json?.error || "تعذر تحميل قائمة المستخدمين");
      }

      const nonAdmins: StaffPermissionUser[] = json.users
        .filter((u: { role?: string }) => {
          const r = String(u.role || "").trim().toUpperCase();
          return r !== "ADMIN" && r !== "SUPERADMIN";
        })
        .map(
          (u: {
            id: string;
            username: string;
            role?: string;
            name_ar?: string | null;
            name_en?: string | null;
            job_title?: string | null;
            allowed_sections?: unknown;
          }) => ({
            id: u.id,
            username: u.username,
            role: String(u.role || "STAFF"),
            name_ar: u.name_ar ?? null,
            name_en: u.name_en ?? null,
            job_title: u.job_title ?? null,
            allowed_sections: normalizeAllowedSections(u.allowed_sections),
          })
        );

      setStaffUsers(nonAdmins);
      const initialDraft: Record<string, SectionKey[]> = {};
      for (const u of nonAdmins) {
        initialDraft[u.id] = [...u.allowed_sections];
      }
      setDraftPermissions(initialDraft);
    } catch (err: unknown) {
      setModalFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "تعذر تحميل قائمة المستخدمين",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [isAdminOrSuperAdmin]);

  const toggleUserSection = (userId: string, key: SectionKey) => {
    setDraftPermissions((prev) => {
      const current = prev[userId] || [];
      const exists = current.includes(key);
      const next = exists ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [userId]: next };
    });
    if (modalFeedback) setModalFeedback(null);
  };

  const toggleAllForUser = (userId: string) => {
    setDraftPermissions((prev) => {
      const current = prev[userId] || [];
      const allSelected = current.length === ALL_KEYS.length;
      return {
        ...prev,
        [userId]: allSelected ? [] : [...ALL_KEYS],
      };
    });
    if (modalFeedback) setModalFeedback(null);
  };

  const handleSavePermissions = async () => {
    if (isSaving || staffUsers.length === 0) return;
    setIsSaving(true);
    setModalFeedback(null);
    try {
      const updates = staffUsers.map((u) => ({
        id: u.id,
        allowed_sections: draftPermissions[u.id] || [],
      }));

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions_updates: updates }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "تعذر حفظ الصلاحيات في قاعدة البيانات");
      }

      setStaffUsers((prev) =>
        prev.map((u) => ({
          ...u,
          allowed_sections: draftPermissions[u.id] || [],
        }))
      );

      setModalFeedback({
        type: "success",
        text: "تم حفظ صلاحيات الأقسام لجميع المستخدمين بنجاح.",
      });
      setToastMsg("تم حفظ صلاحيات الأقسام للمستخدمين بنجاح.");
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: unknown) {
      setModalFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "تعذر حفظ الصلاحيات",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionPermissionsContext.Provider
      value={{
        isAdminOrSuperAdmin,
        permissionsLoaded,
        allowedSections,
        canAccessSection,
        firstAllowedHref,
        openPermissionsModal,
      }}
    >
      {isRouteRestricted ? (
        <div className="flex-1 min-h-screen flex items-center justify-center p-6" dir="rtl">
          <div className="rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/20 px-6 py-5 flex items-center gap-3 text-white text-sm font-bold">
            <Loader2 size={18} className="animate-spin text-sky-300" />
            <span>جاري التحويل إلى القسم المصرح به...</span>
          </div>
        </div>
      ) : (
        children
      )}

      {/* Confirmation Toast */}
      {toastMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-950/90 border border-emerald-400/40 text-emerald-100 text-xs font-extrabold shadow-2xl backdrop-blur-xl"
          dir="rtl"
        >
          <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Admin Section Permissions Modal (ADMIN / SUPERADMIN only) */}
      {isModalOpen && isAdminOrSuperAdmin && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-3xl bg-[#0b111b]/90 backdrop-blur-2xl border border-white/20 shadow-[0_24px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.2)] text-white overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-white/15 bg-white/[0.04] shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-300/35 flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} className="text-sky-300" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    إدارة صلاحيات الأقسام للمستخدمين
                  </h2>
                  <p className="text-xs text-white/65 font-medium mt-0.5">
                    حدد الأقسام الظاهرة والمتاحة لكل مستخدم — الأقسام غير المحددة تختفي تماماً من القائمة الجانبية وتُمنع من الفتح المباشر.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="إغلاق"
                className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {modalFeedback && (
                <div
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-xs font-bold ${
                    modalFeedback.type === "success"
                      ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-100"
                      : "bg-rose-500/15 border-rose-400/35 text-rose-200"
                  }`}
                >
                  {modalFeedback.type === "success" ? (
                    <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-300 shrink-0" />
                  )}
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              {isLoadingUsers ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-white/70">
                  <Loader2 size={28} className="animate-spin text-sky-300" />
                  <span className="text-sm font-bold">جاري تحميل المستخدمين وصلاحياتهم...</span>
                </div>
              ) : staffUsers.length === 0 ? (
                <div className="py-14 text-center rounded-2xl bg-white/[0.03] border border-white/10">
                  <Users size={30} className="mx-auto text-white/40 mb-2" />
                  <p className="text-sm font-bold text-white/75">
                    لا يوجد مستخدمون من غير المديرين (Staff) حالياً.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {staffUsers.map((user) => {
                    const displayName = user.name_ar || user.name_en || user.username;
                    const selected = draftPermissions[user.id] || [];
                    const allSelected = selected.length === ALL_KEYS.length;

                    return (
                      <div
                        key={user.id}
                        className="rounded-2xl bg-white/[0.04] border border-white/15 p-4 md:p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-extrabold text-xs text-white shrink-0">
                              {displayName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-extrabold text-white flex items-center gap-2">
                                <span>{displayName}</span>
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/75">
                                  {selected.length}/{ALL_KEYS.length}
                                </span>
                              </div>
                              <div className="text-xs text-white/60 font-medium mt-0.5">
                                {user.job_title || user.role}
                                {user.username ? ` • @${user.username}` : ""}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleAllForUser(user.id)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white/85 transition-colors cursor-pointer"
                          >
                            {allSelected ? "إلغاء تحديد الكل" : "تحديد جميع الأقسام"}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          {ALL_SYSTEM_SECTIONS.map((sec) => {
                            const checked = selected.includes(sec.key);
                            return (
                              <label
                                key={sec.key}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                  checked
                                    ? "bg-sky-500/20 border-sky-300/45 text-white shadow-sm"
                                    : "bg-black/25 border-white/10 text-white/65 hover:bg-white/[0.06] hover:text-white/90"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleUserSection(user.id, sec.key)}
                                  className="sr-only"
                                />
                                <span
                                  className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                    checked
                                      ? "bg-sky-400 border-sky-300 text-slate-950"
                                      : "bg-transparent border-white/30"
                                  }`}
                                >
                                  {checked && <Check size={12} strokeWidth={3} />}
                                </span>
                                <span className="text-xs font-bold leading-snug">
                                  {sec.labelAr}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/15 bg-white/[0.04] shrink-0">
              <span className="text-[11px] text-white/55 font-medium">
                ملاحظة: حسابات المديرين (ADMIN / SUPERADMIN) تملك صلاحية الوصول الكامل لجميع الأقسام تلقائياً.
              </span>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold text-white/85 transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={isSaving || isLoadingUsers || staffUsers.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-300/45 text-emerald-100 text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>حفظ الصلاحيات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SectionPermissionsContext.Provider>
  );
}
