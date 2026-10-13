import { requireSession } from "@/lib/auth/session";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const metadata = { title: "Cetak" };

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="min-h-svh bg-muted/40 print:bg-white">
      <PrintToolbar />
      <main className="mx-auto max-w-[210mm] bg-white p-[12mm] text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {children}
      </main>
    </div>
  );
}
