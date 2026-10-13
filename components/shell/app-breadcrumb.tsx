"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { titleForUrl } from "@/lib/modules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function titleCase(seg: string) {
  return decodeURIComponent(seg.replace(/-/g, " ").replace(/\b\w/g, (s) => s.toUpperCase()));
}

/** Breadcrumb dari pathname; judul diambil dari config menu bila ada. */
export function AppBreadcrumb() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  // Segmen UUID terakhir (halaman detail) disembunyikan.
  const visible = parts.length > 1 && UUID.test(parts[parts.length - 1]) ? parts.slice(0, -1) : parts;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href="/">GOA HZ</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {visible.map((part, i) => {
          const href = "/" + parts.slice(0, i + 1).join("/");
          const label = titleForUrl(href) ?? titleCase(part);
          const last = i === visible.length - 1;
          return (
            <Fragment key={href}>
              <BreadcrumbSeparator className={i === 0 ? "hidden md:block" : undefined} />
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
