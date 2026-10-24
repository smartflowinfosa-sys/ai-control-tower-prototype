import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const authOptions: NextAuthOptions = {
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
          .select('id, username, role, password, name_ar, name_en, email, job_title, preferred_language')
          .eq('username', credentials.username);

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
        return {
          id: user.id,
          name: user.username,
          role: user.role,
          username: user.username,
          name_ar: user.name_ar,
          name_en: user.name_en,
          email: user.email,
          job_title: user.job_title,
          preferred_language: user.preferred_language,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
        token.name_ar = user.name_ar;
        token.name_en = user.name_en;
        token.email = user.email;
        token.job_title = user.job_title;
        token.preferred_language = user.preferred_language;
      }

      // Handle client-side session update
      if (trigger === "update" && session) {
        if (session.name_ar !== undefined) token.name_ar = session.name_ar;
        if (session.name_en !== undefined) token.name_en = session.name_en;
        if (session.email !== undefined) token.email = session.email;
        if (session.preferred_language !== undefined) token.preferred_language = session.preferred_language;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.name_ar = token.name_ar as string;
        session.user.name_en = token.name_en as string;
        session.user.email = token.email as string;
        session.user.job_title = token.job_title as string;
        session.user.preferred_language = token.preferred_language as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return url === "/login" ? `${baseUrl}/` : `${baseUrl}${url}`;
      }
      if (new URL(url).origin === baseUrl) {
        return new URL(url).pathname === "/login" ? `${baseUrl}/` : url;
      }
      return `${baseUrl}/`;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
