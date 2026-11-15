import { Suspense } from "react";
import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardClientView from "@/components/dashboard/DashboardClientView";

async function DashboardContent() {
  await connection();
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const rawRole = (session.user as { role?: string } | undefined)?.role || "";
  const role = rawRole.toUpperCase();
  const isSuperAdminOrAdmin = role === "SUPERADMIN" || role === "ADMIN";
  const isInventory = rawRole.toLowerCase() === "inventory";

  if (!isSuperAdminOrAdmin) {
    if (isInventory) {
      redirect("/inventory");
    }
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
