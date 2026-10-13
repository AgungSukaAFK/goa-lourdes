"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { dotIcon, ThemedTiles } from "./leaflet-base";

export type MapVehicle = { id: string; lat: number; lng: number; label: string; sub?: string; stale?: boolean };

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15 });
  }, [map, points.length]);
  return null;
}

/** Peta rute (jejak GPS) + posisi kendaraan + tujuan. */
export default function RouteMap({
  center,
  route = [],
  destination,
  vehicles = [],
  height = "h-80",
  fit = true,
}: {
  center: [number, number];
  route?: [number, number][];
  destination?: [number, number] | null;
  vehicles?: MapVehicle[];
  height?: string;
  fit?: boolean;
}) {
  const fitPts = [...route, ...vehicles.map((v) => [v.lat, v.lng] as [number, number]), ...(destination ? [destination] : [])];
  return (
    <MapContainer center={center} zoom={11} className={`${height} w-full rounded-md border`} scrollWheelZoom>
      <ThemedTiles />
      {fit && <Fit points={fitPts.length ? fitPts : [center]} />}
      {route.length > 1 && <Polyline positions={route} pathOptions={{ color: "hsl(var(--primary))", weight: 3 }} />}
      {destination && (
        <Marker position={destination} icon={dotIcon("muted", 14)}>
          <Tooltip>Tujuan</Tooltip>
        </Marker>
      )}
      {vehicles.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lng]} icon={dotIcon(v.stale ? "destructive" : "primary", 18)}>
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span className="font-medium">{v.label}</span>
            {v.sub && <span className="block text-[11px] text-muted-foreground">{v.sub}</span>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
