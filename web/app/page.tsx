import ListingsTable from "@/components/ListingsTable";

export default function Home() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-slate-50">
      <div className="h-full flex flex-col px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <ListingsTable />
      </div>
    </main>
  );
}
