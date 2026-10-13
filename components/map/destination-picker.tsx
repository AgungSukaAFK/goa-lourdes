"use client";

import { MapContainer, Marker, Polyline, useMapEvents } from "react-leaflet";
import { dotIcon, ThemedTiles } from "./leaflet-base";

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Klik peta untuk menentukan tujuan. Garis putus-putus dari pool. */
export default function DestinationPicker({
  pool,
  value,
  onPick,
}: {
  pool: [number, number];
  value: [number, number] | null;
  onPick: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer center={value ?? pool} zoom={10} className="h-64 w-full rounded-md border" scrollWheelZoom>
      <ThemedTiles />
      <ClickHandler onPick={onPick} />
      <Marker position={pool} icon={dotIcon("muted", 14)} title="Pool" />
      {value && (
        <>
          <Marker position={value} icon={dotIcon("primary", 18)} title="Tujuan" />
          <Polyline positions={[pool, value]} pathOptions={{ color: "hsl(var(--primary))", weight: 2, dashArray: "6 6" }} />
        </>
      )}
    </MapContainer>
  );
}
