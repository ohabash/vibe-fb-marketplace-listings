import ListingsTable from "@/components/ListingsTable";

export default function Home() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-surface dotted-bg relative">
      {/* Atmospheric top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/[0.04] to-transparent" />
      <div className="relative h-full flex flex-col px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <ListingsTable />
      </div>
    </main>

  );
}
