import type { Metadata } from "next";
import { Content } from "@/components/content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireFleet } from "@/lib/fleet/guard";
import { getCostSettings } from "@/lib/fleet/server";
import { createClient } from "@/lib/supabase/server";
import type { P2hItem, Part } from "@/lib/fleet/types";
import { ChecklistTab, CostTab, InspectorsTab, PartsTab } from "./settings-client";

export const metadata: Metadata = { title: "Pengaturan Fleet" };

export default async function FleetSettings() {
  await requireFleet(["admin"]);
  const supabase = await createClient();
  const [{ data: parts }, { data: items }, { data: inspectors }, { data: vehicles }, cost] = await Promise.all([
    supabase.from("fleet_parts").select("*").order("name"),
    supabase.from("fleet_p2h_items").select("*").order("target").order("sort"),
    supabase.from("fleet_inspectors").select("id, name").order("name"),
    supabase.from("fleet_vehicles").select("id, plate, model").order("plate"),
    getCostSettings(),
  ]);
  const vehicleOpts = (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.plate} · ${v.model}` }));

  return (
    <Content title="Pengaturan Fleet">
      <Tabs defaultValue="parts">
        <TabsList className="flex-wrap">
          <TabsTrigger value="parts">Part & interval</TabsTrigger>
          <TabsTrigger value="checklist">Checklist P2H</TabsTrigger>
          <TabsTrigger value="inspectors">Pemeriksa</TabsTrigger>
          <TabsTrigger value="cost">Biaya & pool</TabsTrigger>
        </TabsList>
        <TabsContent value="parts" className="pt-4">
          <PartsTab parts={(parts ?? []) as Part[]} vehicles={vehicleOpts} />
        </TabsContent>
        <TabsContent value="checklist" className="pt-4">
          <ChecklistTab items={(items ?? []) as P2hItem[]} />
        </TabsContent>
        <TabsContent value="inspectors" className="pt-4">
          <InspectorsTab inspectors={inspectors ?? []} />
        </TabsContent>
        <TabsContent value="cost" className="pt-4">
          <CostTab cost={cost} />
        </TabsContent>
      </Tabs>
    </Content>
  );
}
