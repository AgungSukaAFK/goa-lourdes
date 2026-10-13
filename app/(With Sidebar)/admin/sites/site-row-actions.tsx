"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import type { Option } from "@/components/option-select";
import { useAction } from "@/hooks/use-action";
import type { Site } from "@/lib/types";
import { deleteSite } from "./actions";
import { SiteFormDialog } from "./site-form";

export function SiteRowActions({ site, companies }: { site: Site; companies: Option[] }) {
  const { run } = useAction();
  return (
    <div className="flex justify-end gap-1">
      <SiteFormDialog
        site={site}
        companies={companies}
        trigger={
          <Button variant="ghost" size="sm" title="Edit" aria-label={`Edit ${site.name}`}>
            <Pencil />
          </Button>
        }
      />
      <ConfirmButton
        destructive
        title={`Hapus site ${site.name}?`}
        description="Karyawan, aset, dan kendaraan di site ini akan kehilangan lokasi. Lebih aman dinonaktifkan."
        confirmText="Hapus"
        onConfirm={() => run(() => deleteSite(site.id))}
        trigger={
          <Button variant="ghost" size="sm" title="Hapus" aria-label={`Hapus ${site.name}`}>
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  );
}
