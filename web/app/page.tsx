import ListingsTable from "@/components/ListingsTable";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl_ mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Marketplace Listings</h1>
        </div>
        <ListingsTable />
      </div>
    </main>
  );
}
