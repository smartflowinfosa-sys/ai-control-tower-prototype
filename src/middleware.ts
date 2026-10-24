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

    const role = (token?.role as string | undefined)?.toUpperCase();
    const isSuperAdminOrAdmin = role === "SUPERADMIN" || role === "ADMIN";

    // Admin-only routes: strictly restricted to SUPERADMIN and ADMIN
    // STAFF can access /operations and /inventory
    const adminRoutes = ["/", "/suppliers", "/production", "/supplier-discovery", "/orders"];
    const isAdminRoute = adminRoutes.some(
      (r) => pathname === r || (r !== "/" && pathname.startsWith(r + "/"))
    );

    if (isAdminRoute && !isSuperAdminOrAdmin) {
      // Redirect STAFF to Operations Reports (Quantity Invoice)
      return NextResponse.redirect(new URL("/operations/quantity", req.url));
    }

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
     * - /_next/static (static chunks)
     * - /_next/image (image optimization)
     * - static files (.svg, .png, .jpg, .ico, etc.)
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
