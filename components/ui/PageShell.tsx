/** Full-height centered page frame for sign-in and access requests. */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
