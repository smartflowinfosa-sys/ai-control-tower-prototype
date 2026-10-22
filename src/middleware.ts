import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
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
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
