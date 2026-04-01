import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar user={session.user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
