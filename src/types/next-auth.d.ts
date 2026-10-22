import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
      username?: string | null;
      name_ar?: string | null;
      name_en?: string | null;
      job_title?: string | null;
      preferred_language?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: string;
    username?: string | null;
    name_ar?: string | null;
    name_en?: string | null;
    job_title?: string | null;
    preferred_language?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    username?: string | null;
    name_ar?: string | null;
    name_en?: string | null;
    job_title?: string | null;
    preferred_language?: string | null;
  }
}
