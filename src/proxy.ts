import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthPage = pathname === '/login';

  // If user is not authenticated and trying to access any protected page
  if (!token) {
    if (!isAuthPage) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // If user is already authenticated and visits /login, redirect to "/"
  if (isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth API routes)
     * - _next (Next.js internals: static files, images, chunks, etc.)
     * - Static asset files (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .json)
     */
    '/((?!api/auth|_next|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
};

export default proxy;
