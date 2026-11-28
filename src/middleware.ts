import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Strict authentication check: If not authenticated, redirect to /login
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Per-user section access control is enforced by SectionPermissionsProvider
    // using public.app_users.allowed_sections (redirecting non-admins to their first allowed section).
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match root `/` and all protected application routes, excluding:
     * - /login (custom login page)
     * - /api/auth/* (NextAuth endpoints)
     * - /api/chat (AI Assistant chat endpoint)
     * - /api/cron/* (Scheduled Cron endpoints protected by CRON_SECRET)
     * - /_next/static (static chunks)
     * - /_next/image (image optimization)
     * - static files (.svg, .png, .jpg, .ico, etc.)
     */
    "/((?!login|api/auth|api/chat|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
