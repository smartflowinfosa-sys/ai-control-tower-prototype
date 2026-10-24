import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardClientView from "@/components/dashboard/DashboardClientView";

async function DashboardContent() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const role = ((session.user as any)?.role || "").toUpperCase();
  const isSuperAdminOrAdmin = role === "SUPERADMIN" || role === "ADMIN";

  if (!isSuperAdminOrAdmin) {
    redirect("/operations/quantity");
  }

  return <DashboardClientView {...({ session } as any)} />;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-white font-bold">
          جاري تحميل البيانات...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
