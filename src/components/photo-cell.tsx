"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { useTx } from "@/components/i18n-text";

/// Shared thumbnail + upload/remove control for entity photos (POS products,
/// services, stock items). The GET endpoint issues a signed, short-TTL URL.
interface Props {
  getUrl: string;
  uploadUrl: string;
  alt: string;
  canWrite: boolean;
}

export function PhotoCell({ getUrl, uploadUrl, alt, canWrite }: Props) {
  const router = useRouter();
  const tUi = useTx();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [has, setHas] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setHas(false);
    fetch(getUrl)
      .then((r) => r.json().catch(() => null))
      .then((d: { url?: string } | null) => {
        if (!cancelled && d?.url) {
          setSrc(d.url);
          setHas(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getUrl]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(uploadUrl, { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: tUi("Upload failed"), description: data.message, variant: "destructive" });
      return;
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(uploadUrl, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      push({ title: tUi("Remove failed"), variant: "destructive" });
      return;
    }
    setSrc(null);
    setHas(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      {has && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={36} height={36} className="h-9 w-9 shrink-0 rounded border object-cover" />
      ) : (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">
          —
        </span>
      )}
      {canWrite ? (
        <span className="flex flex-col leading-none">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="text-[10px] text-muted-foreground underline underline-offset-2 disabled:opacity-50"
          >
            {tUi(has ? "Change photo" : "Add photo")}
          </button>
          {has ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="mt-0.5 text-[10px] text-muted-foreground underline underline-offset-2 disabled:opacity-50"
            >
              {tUi("Remove")}
            </button>
          ) : null}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </span>
      ) : null}
    </div>
  );
}