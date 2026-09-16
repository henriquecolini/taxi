import { AppHeader } from "@/components/layout/app-header";
import { requireViewer } from "@/lib/authz";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();
  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {children}
      </main>
    </>
  );
}
