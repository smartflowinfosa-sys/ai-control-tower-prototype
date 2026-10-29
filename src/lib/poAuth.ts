import type { Session } from 'next-auth';

export interface AuthenticatedPOUser {
  id: string;
  username: string;
  displayName: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEGACY_MOCK_CREATOR_LABELS = new Set([
  '',
  'human',
  'ai_agent',
  'ai agent',
  'وكيل الذكاء الاصطناعي',
  'الذكاء الاصطناعي',
  'system user',
  'مستخدم النظام',
  'موظف المشتريات',
  'مدير العمليات',
  'operations manager',
]);

/**
 * Strips any role, rank, username, ID, or AI tags from a user display name.
 * Examples:
 * - "abdullatif mahdi (admin)" -> "abdullatif mahdi"
 * - "abdullatif mahdi (admin) • AI" -> "abdullatif mahdi"
 */
export function sanitizeCreatorName(name: string | null | undefined): string {
  if (!name) return '';
  return String(name)
    .replace(/\s*[•\-–—]\s*AI\b.*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isUuidString(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(String(value).trim());
}

/**
 * Strictly validates that an authenticated user session exists before allowing
 * Purchase Order creation or execution. Returns null when unauthenticated.
 */
export function getAuthenticatedPOUser(
  session: Session | null | undefined,
  lang: 'ar' | 'en' = 'ar'
): AuthenticatedPOUser | null {
  const user = session?.user as (Session['user'] & {
    full_name?: string | null;
    user_metadata?: { full_name?: string | null; name?: string | null };
  }) | undefined;

  if (!user) return null;

  const rawId = user.id ? String(user.id).trim() : '';
  const rawUsername = user.username
    ? String(user.username).trim()
    : user.name
    ? String(user.name).trim()
    : '';
  const rawEmail = user.email ? String(user.email).trim() : '';

  if (!rawId && !rawUsername && !rawEmail) {
    return null;
  }

  const candidateName =
    user.user_metadata?.full_name ||
    user.full_name ||
    (lang === 'en'
      ? (user.name_en || user.name_ar)
      : (user.name_ar || user.name_en)) ||
    user.user_metadata?.name ||
    user.name ||
    rawUsername ||
    rawEmail;

  const displayName = sanitizeCreatorName(candidateName) || rawUsername || rawEmail;

  return {
    id: rawId || rawUsername || rawEmail,
    username: rawUsername || rawId || rawEmail,
    displayName,
  };
}

/**
 * Resolves the "المُنشئ" (Created By) display label for a Purchase Order.
 * Strictly returns ONLY the clean user name without any role, rank, or AI labels.
 */
export function formatPOCreatorDisplay(
  createdBy: string | undefined | null,
  authenticatedUser: AuthenticatedPOUser | null
): string {
  const raw = (createdBy || '').trim();

  if (isUuidString(raw)) {
    if (authenticatedUser && authenticatedUser.id === raw && authenticatedUser.displayName) {
      return authenticatedUser.displayName;
    }
    return '—';
  }

  const cleaned = sanitizeCreatorName(raw);

  if (cleaned && !LEGACY_MOCK_CREATOR_LABELS.has(cleaned.toLowerCase()) && !LEGACY_MOCK_CREATOR_LABELS.has(raw.toLowerCase())) {
    return cleaned;
  }

  if (authenticatedUser?.displayName) {
    return authenticatedUser.displayName;
  }

  return '—';
}
