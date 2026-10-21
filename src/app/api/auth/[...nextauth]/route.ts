import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "اسم المستخدم", type: "text" },
        password: { label: "كلمة المرور", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const supabaseAdmin = getSupabaseAdmin();
        const { data: users, error } = await supabaseAdmin
          .from('app_users')
          .select('id, username, role, password')
          .eq('username', credentials.username);

        // Temporary logging for diagnosis (without printing passwords)
        console.log(`[NextAuth Authorize] Query username: "${credentials.username}", rows returned: ${users?.length ?? 0}, error:`, error);

        if (error) {
          console.error("[NextAuth Authorize] Supabase query error:", error.message);
          throw new Error("اسم المستخدم غير صحيح");
        }

        const user = users && users.length > 0 ? users[0] : null;

        if (!user) {
          throw new Error("اسم المستخدم غير صحيح");
        }

        const passwordsMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordsMatch) {
          console.warn(`[NextAuth Authorize] Password mismatch for username: "${credentials.username}"`);
          throw new Error("كلمة المرور غير صحيحة");
        }

        console.log(`[NextAuth Authorize] Successful login for username: "${user.username}" (role: ${user.role})`);
        return { id: user.id, name: user.username, role: user.role };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith("/")) {
        return url === "/login" ? `${baseUrl}/` : `${baseUrl}${url}`;
      }
      if (new URL(url).origin === baseUrl) {
        return new URL(url).pathname === "/login" ? `${baseUrl}/` : url;
      }
      return `${baseUrl}/`;
    }
  },
  pages: { signIn: '/login' },
  session: { strategy: "jwt" as const },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
