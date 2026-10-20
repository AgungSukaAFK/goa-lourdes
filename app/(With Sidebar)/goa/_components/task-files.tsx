"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { formatDateTime } from "@/lib/utils";
import { attachTaskFiles } from "@/lib/goa/files";
import {
  FILE_ACCEPT,
  FILE_KINDS,
  MAX_FILE_MB,
  canDeleteFile,
  canUploadKind,
  isClosed,
  type GoaFileKind,
  type GoaTask,
  type GoaTaskFile,
} from "@/lib/goa/types";
import { deleteTaskFile, listTaskFiles } from "../actions";
import { RatingStars, canRateTask, type TaskCtx } from "./task-card";

/** Input file untuk form (dibaca lewat FormData.getAll(name)). */
export function FileField({ id, name, required }: { id: string; name: string; required?: boolean }) {
  return (
    <Input
      id={id}
      name={name}
      type="file"
      multiple
      accept={FILE_ACCEPT}
      required={required}
      className="h-auto py-1.5 file:mr-3 file:rounded file:bg-muted file:px-2 file:py-0.5 file:text-xs"
    />
  );
}

export const FILE_HINT = `Foto, PDF, Word, atau Excel. Maks ${MAX_FILE_MB} MB per file, foto dikompres otomatis.`;

/** Tombol "Lampiran (n)" + dialog galeri, upload, dan penilaian. */
export function TaskFilesDialog({ task, ctx, size = "sm" }: { task: GoaTask; ctx: TaskCtx; size?: "sm" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<GoaTaskFile[] | null>(null);
  const kinds = FILE_KINDS.filter((k) => canUploadKind(task, k.kind, ctx) || files?.some((f) => f.kind === k.kind));
  const canRate = canRateTask(task, ctx);
  const canUploadAny = FILE_KINDS.some((k) => canUploadKind(task, k.kind, ctx));
  if (!task.file_count && !canUploadAny) return null;

  const load = async () => {
    const res = await listTaskFiles(task.id);
    if (res.ok) setFiles(res.data ?? []);
    else toast.error(res.error);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <DialogTrigger asChild>
        {size === "icon" ? (
          <Button variant="ghost" size="icon" className="relative size-8" aria-label={`Lampiran ${task.code} (${task.file_count})`}>
            <Paperclip />
            {task.file_count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">{task.file_count}</span>
            )}
          </Button>
        ) : (
          <Button size="sm" variant="ghost">
            <Paperclip />
            Lampiran{task.file_count > 0 && ` (${task.file_count})`}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lampiran {task.code}</DialogTitle>
          <DialogDescription className="line-clamp-2">{task.title}</DialogDescription>
        </DialogHeader>

        {isClosed(task) && (canRate || task.rating) && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm dark:bg-muted/10">
            <span className="font-medium">Nilai</span>
            <RatingStars task={task} canRate={canRate} />
            {canRate && <span className="text-xs text-muted-foreground">Lampirkan temuan/catatan di bagian Lampiran reviewer.</span>}
          </div>
        )}

        {files === null ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Memuat lampiran...
          </div>
        ) : (
          <div className="space-y-5">
            {kinds.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Belum ada lampiran.</p>}
            {kinds.map((k) => (
              <KindSection
                key={k.kind}
                task={task}
                ctx={ctx}
                kind={k.kind}
                label={k.label}
                desc={k.desc}
                files={files.filter((f) => f.kind === k.kind)}
                onChange={load}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KindSection({
  task,
  ctx,
  kind,
  label,
  desc,
  files,
  onChange,
}: {
  task: GoaTask;
  ctx: TaskCtx;
  kind: GoaFileKind;
  label: string;
  desc: string;
  files: GoaTaskFile[];
  onChange: () => Promise<void>;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const canUpload = canUploadKind(task, kind, ctx);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const res = await attachTaskFiles(task.id, kind, [...list]);
      if (res.ok) {
        toast.success(res.message);
        await onChange();
        router.refresh();
      } else toast.error(res.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload gagal.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="space-y-2" aria-label={label}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">
            {label} <span className="text-muted-foreground">({files.length})</span>
          </h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        {canUpload && (
          <>
            <input ref={input} type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={(e) => upload(e.target.files)} aria-label={`Upload ${label}`} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </>
        )}
      </div>
      {files.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Belum ada file.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f) => (
            <li key={f.id} className="group relative overflow-hidden rounded-md border bg-card">
              <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {f.mime.startsWith("image/") && f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-muted/50 p-2 text-center dark:bg-muted/10">
                    <FileText className="size-7 text-muted-foreground" />
                    <span className="line-clamp-2 break-all text-xs">{f.name}</span>
                  </div>
                )}
              </a>
              <div className="px-2 py-1 text-[11px] leading-tight text-muted-foreground">
                <p className="truncate">{f.uploader_name ?? "-"}</p>
                <p>{formatDateTime(f.created_at)}</p>
              </div>
              {canDeleteFile(f, task, ctx) && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 size-7 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Hapus ${f.name}`}
                  disabled={pending}
                  onClick={() => run(() => deleteTaskFile(f.id), { onSuccess: () => onChange() })}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
