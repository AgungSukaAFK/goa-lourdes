import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Content } from "@/components/content";
import { requireFleet } from "@/lib/fleet/guard";
import { createClient } from "@/lib/supabase/server";
import type { P2hItem } from "@/lib/fleet/types";
import { P2hForm } from "./p2h-form";

export const metadata: Metadata = { title: "Isi P2H" };

export default async function P2hPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking: bookingId } = await searchParams;
  const s = await requireFleet(["admin", "driver"]);
  const supabase = await createClient();

  if (!s.isAdmin && !s.myDriverId) {
    return (
      <Content title="Isi P2H">
        <p className="text-sm text-muted-foreground">Akun Anda belum terdaftar sebagai driver. Hubungi admin Fleet.</p>
      </Content>
    );
  }

  const [{ data: items }, { data: vehicles }, { data: drivers }, { data: inspectors }, { data: myVehicles }, bookingRes] = await Promise.all([
    supabase.from("fleet_p2h_items").select("*").eq("is_active", true).order("target").order("sort"),
    supabase.from("fleet_vehicles").select("id, plate, model, company, odometer, status").neq("status", "inactive").order("plate"),
    supabase.from("fleet_drivers_view").select("id, name, nrp").eq("is_active", true).order("name"),
    supabase.from("fleet_inspectors").select("id, name").eq("is_active", true).order("name"),
    s.myDriverId ? supabase.from("fleet_driver_vehicles").select("vehicle_id").eq("driver_id", s.myDriverId) : Promise.resolve({ data: [] }),
    bookingId ? supabase.from("fleet_bookings").select("id, code, vehicle_id, driver_id, status").eq("id", bookingId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const booking = bookingRes.data;
  if (bookingId && (!booking || !["approved", "in_use"].includes(booking.status))) notFound();
  if (booking && !s.isAdmin && booking.driver_id !== s.myDriverId) notFound();

  const assigned = (myVehicles ?? []).map((m) => m.vehicle_id as string);
  return (
    <P2hForm
      items={(items ?? []) as P2hItem[]}
      vehicles={(vehicles ?? []).map((v) => ({
        value: v.id,
        label: `${v.plate} · ${v.model}`,
        description: v.status === "grounded" ? "tidak layak" : undefined,
        company: v.company,
        odometer: v.odometer,
      }))}
      drivers={(drivers ?? []).map((d) => ({ value: d.id, label: d.name, description: d.nrp }))}
      inspectors={(inspectors ?? []).map((i) => ({ value: i.id, label: i.name }))}
      booking={booking}
      defaultVehicle={assigned[0] ?? ""}
      defaultDriver={s.isAdmin ? "" : (s.myDriverId ?? "")}
      lockDriver={!s.isAdmin}
    />
  );
}
