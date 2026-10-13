"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportButton } from "@/components/import-button";
import type { Option } from "@/components/option-select";
import { VEHICLE_IMPORT_HEADERS } from "@/lib/fleet/import";
import { importVehicles } from "./actions";
import { VehicleFormDialog } from "./vehicle-form";

export function VehicleToolbar({ companies, sites }: { companies: Option[]; sites: (Option & { company: string })[] }) {
  return (
    <>
      <ImportButton
        title="Import kendaraan"
        description="Plat yang sudah ada akan diperbarui. Format tanggal YYYY-MM-DD."
        templateName="template-kendaraan.xlsx"
        headers={VEHICLE_IMPORT_HEADERS}
        example={["B 1234 XYZ", "Avanza 1.3 G", "Toyota", 2022, "GMI", "Head Office", 45200, 5000, 40000, "2027-03-01", "", "2027-03-01"]}
        onImport={importVehicles}
      />
      <VehicleFormDialog
        companies={companies}
        sites={sites}
        trigger={
          <Button>
            <Plus />
            Tambah Kendaraan
          </Button>
        }
      />
    </>
  );
}
