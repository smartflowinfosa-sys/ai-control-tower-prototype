import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (!session.user.id && !(session.user as any).username)) {
      return NextResponse.json({ error: "غير مصرح بالدخول" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("app_users")
      .select("id, username, role, name_ar, name_en, email, job_title, preferred_language, created_at");

    if (session.user.id) {
      query = query.eq("id", session.user.id);
    } else {
      query = query.eq("username", (session.user as any).username);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      console.error("[Profile API GET] Error querying user:", error);
      return NextResponse.json({ error: "تعذر العثور على بيانات المستخدم" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("[Profile API GET] Exception:", error);
    return NextResponse.json({ error: "خطأ في الخادم الداخلي" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (!session.user.id && !(session.user as any).username)) {
      return NextResponse.json({ error: "غير مصرح بالدخول" }, { status: 401 });
    }

    const body = await req.json();
    const { name_ar, name_en, email, preferred_language, new_password } = body;

    // Security enforcement: strictly reject any attempt to alter protected fields.
    const PROTECTED_FIELDS = ["role", "job_title", "department", "username", "id", "created_at"];
    const attemptedForbidden = PROTECTED_FIELDS.filter((field) => field in body);
    if (attemptedForbidden.length > 0) {
      return NextResponse.json(
        {
          error: `لا يُسمح بتعديل الحقول المحمية للنظام (${attemptedForbidden.join(", ")})`,
          code: "PROTECTED_FIELD_VIOLATION",
          protectedFields: attemptedForbidden,
        },
        { status: 403 }
      );
    }

    // Security enforcement: strictly whitelist editable fields.
    const updatePayload: Record<string, any> = {};

    if (typeof name_ar === "string") {
      updatePayload.name_ar = name_ar.trim();
    }
    if (typeof name_en === "string") {
      updatePayload.name_en = name_en.trim();
    }
    if (typeof email === "string") {
      const cleanEmail = email.trim();
      if (cleanEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return NextResponse.json(
          { error: "صيغة البريد الإلكتروني غير صالحة" },
          { status: 400 }
        );
      }
      updatePayload.email = cleanEmail;
    }
    if (preferred_language !== undefined) {
      if (preferred_language === "ar" || preferred_language === "en") {
        updatePayload.preferred_language = preferred_language;
      } else {
        return NextResponse.json(
          { error: "لغة غير مدعومة (يجب أن تكون ar أو en)" },
          { status: 400 }
        );
      }
    }

    // Optional password update: hash with bcryptjs before saving
    if (typeof new_password === "string" && new_password.trim().length > 0) {
      const cleanPassword = new_password.trim();
      if (cleanPassword.length < 4) {
        return NextResponse.json(
          { error: "كلمة المرور يجب أن لا تقل عن 4 خانات" },
          { status: 400 }
        );
      }
      const hashedPassword = await bcrypt.hash(cleanPassword, 10);
      updatePayload.password = hashedPassword;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "لم يتم تقديم أي حقول قابلة للتحديث" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let updateQuery = supabaseAdmin.from("app_users").update(updatePayload);

    if (session.user.id) {
      updateQuery = updateQuery.eq("id", session.user.id);
    } else {
      updateQuery = updateQuery.eq("username", (session.user as any).username);
    }

    const { data: updatedUser, error: updateError } = await updateQuery
      .select("id, username, role, name_ar, name_en, email, job_title, preferred_language, created_at")
      .single();

    if (updateError || !updatedUser) {
      console.error("[Profile API PUT] Supabase update error:", updateError);
      return NextResponse.json(
        { error: "فشل حفظ التعديلات في قاعدة البيانات" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث الملف الشخصي بنجاح",
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("[Profile API PUT] Exception:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    );
  }
}
