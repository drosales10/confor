import { GeoDashboardMap } from "@/components/GeoDashboardMap";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inicio</h1>
      <GeoDashboardMap />
    </div>
  );
}
