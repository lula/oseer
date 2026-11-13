"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  CheckIcon,
  FileIcon,
  RotateCcwIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

export type UploadFn = (
  file: File,
  options: { onProgress: (percent: number) => void; signal: AbortSignal },
) => Promise<void>;

type UploadState = "uploading" | "error" | "done";

interface UploadItem {
  id: string;
  file: File;
  state: UploadState;
  progress: number;
  error?: string;
  controller?: AbortController;
}

export interface FileUploaderProps {
  /** Sends one file. Use `xhrUpload(url)` for a real progress bar. */
  upload: UploadFn;
  /** Same format as the `accept` attribute of `<input type="file">`. */
  accept?: string;
  /** Maximum size of each file, in bytes. */
  maxSize?: number;
  /** Maximum number of files in the list. */
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  /** Called after each file uploads successfully. */
  onUploaded?: (file: File) => void;
}

export function FileUploader({
  upload,
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled,
  className,
  onUploaded,
}: FileUploaderProps) {
  const t = useTranslations("uploader");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [rejected, setRejected] = React.useState<string[]>([]);

  const patch = React.useCallback(
    (id: string, changes: Partial<UploadItem>) =>
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      ),
    [],
  );

  const start = React.useCallback(
    async (id: string, file: File) => {
      const controller = new AbortController();
      patch(id, { state: "uploading", progress: 0, error: undefined, controller });
      try {
        await upload(file, {
          signal: controller.signal,
          onProgress: (progress) => patch(id, { progress }),
        });
        patch(id, { state: "done", progress: 100, controller: undefined });
        onUploaded?.(file);
      } catch (error) {
        if (controller.signal.aborted) return;
        patch(id, {
          state: "error",
          controller: undefined,
          error: error instanceof Error ? error.message : t("failed"),
        });
      }
    },
    [patch, upload, onUploaded, t],
  );

  const addFiles = (list: FileList | null) => {
    if (!list || disabled) return;
    const errors: string[] = [];
    const accepted: UploadItem[] = [];
    let room = maxFiles ? maxFiles - items.length : Infinity;

    for (const file of Array.from(list)) {
      if (accept && !matchesAccept(file, accept)) {
        errors.push(t("rejectedType", { name: file.name }));
      } else if (maxSize && file.size > maxSize) {
        errors.push(
          t("rejectedSize", { name: file.name, max: formatBytes(maxSize) }),
        );
      } else if (room <= 0) {
        errors.push(t("rejectedCount", { name: file.name, max: maxFiles! }));
      } else {
        room--;
        accepted.push({
          id: crypto.randomUUID(),
          file,
          state: "uploading",
          progress: 0,
        });
      }
      if (!multiple && accepted.length) break;
    }

    setRejected(errors);
    if (!accepted.length) return;
    setItems((prev) => (multiple ? [...prev, ...accepted] : accepted));
    for (const item of accepted) void start(item.id, item.file);
  };

  const remove = (item: UploadItem) => {
    item.controller?.abort();
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const hints = [
    accept && t("hintTypes", { types: accept.split(",").join(", ") }),
    maxSize && t("hintSize", { max: formatBytes(maxSize) }),
  ].filter(Boolean);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Empty
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={t("browse")}
        data-dragging={dragging || undefined}
        className={cn(
          "cursor-pointer border transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-dragging:border-primary data-dragging:bg-muted/50",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          // Ignore leaving into a child element.
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UploadIcon />
          </EmptyMedia>
          <EmptyTitle>{dragging ? t("drop") : t("title")}</EmptyTitle>
          {hints.length > 0 && (
            <EmptyDescription>{hints.join(" · ")}</EmptyDescription>
          )}
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" tabIndex={-1} disabled={disabled}>
            {t("browse")}
          </Button>
        </EmptyContent>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            addFiles(event.target.files);
            // Allow picking the same file again.
            event.target.value = "";
          }}
        />
      </Empty>

      {rejected.length > 0 && (
        <ul role="alert" className="text-sm text-destructive">
          {rejected.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t("files")}>
          {items.map((item) => (
            <li key={item.id}>
              <Attachment state={item.state} className="w-full">
                <AttachmentMedia>
                  {item.state === "uploading" ? (
                    <Spinner />
                  ) : item.state === "done" ? (
                    <CheckIcon />
                  ) : (
                    <FileIcon />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{item.file.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {item.state === "error"
                      ? item.error
                      : item.state === "uploading"
                        ? `${formatBytes(item.file.size)} · ${Math.round(item.progress)}%`
                        : formatBytes(item.file.size)}
                  </AttachmentDescription>
                  {item.state === "uploading" && (
                    <Progress
                      value={item.progress}
                      className="mt-1.5"
                      aria-label={item.file.name}
                    />
                  )}
                </AttachmentContent>
                <AttachmentActions>
                  {item.state === "error" && (
                    <AttachmentAction
                      aria-label={t("retry")}
                      onClick={() => void start(item.id, item.file)}
                    >
                      <RotateCcwIcon />
                    </AttachmentAction>
                  )}
                  <AttachmentAction
                    aria-label={
                      item.state === "uploading" ? t("cancel") : t("remove")
                    }
                    onClick={() => remove(item)}
                  >
                    <XIcon />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Uploads with XMLHttpRequest (fetch can't report upload progress) as
 * multipart form data, field name `file`. Non-2xx responses reject with the
 * JSON `error` message if there is one.
 */
export function xhrUpload(url: string, field = "file"): UploadFn {
  return (file, { onProgress, signal }) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = `${xhr.status} ${xhr.statusText}`;
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {}
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", () => xhr.abort());

      const body = new FormData();
      body.append(field, file);
      xhr.send(body);
    });
}

function matchesAccept(file: File, accept: string) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(",").some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
