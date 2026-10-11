'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/trpc/client';

/** Images above this size are downscaled client-side before upload. */
const DOWNSCALE_ABOVE_BYTES = 1_500_000;
const MAX_DIMENSION = 1600;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}

async function downscale(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function prepareImage(file: Blob): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  return file.size > DOWNSCALE_ABOVE_BYTES ? downscale(dataUrl) : dataUrl;
}

type Stage = 'classify' | 'generate';

export function QuestionInput() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [error, setError] = useState<{ message: string; submissionId?: string } | null>(null);

  const generate = api.lesson.generate.useMutation({
    onSuccess: (data) => router.push(`/lessons/${data.submissionId}`),
    onError: (err) => {
      setError({
        message: err.message,
        submissionId: err.data?.pipeline?.submissionId,
      });
    },
  });

  // While the mutation runs, poll the submission to learn which stage is live:
  // once a classification row exists, call 2 is running. Polling starts after a
  // short delay so the first request lands after the submission row is inserted.
  const progress = api.lesson.getById.useQuery(
    { id: submissionId ?? '' },
    {
      enabled: generate.isPending && pollEnabled && !!submissionId,
      refetchInterval: 1500,
      retry: false,
    },
  );
  const stage: Stage | null = !generate.isPending
    ? null
    : progress.data?.classification
      ? 'generate'
      : 'classify';

  const handleFile = useCallback(async (file: Blob, name = 'pasted image') => {
    if (!file.type.startsWith('image/')) {
      setError({ message: 'Please choose an image file (PNG, JPEG, WebP or GIF).' });
      return;
    }
    setError(null);
    try {
      setImage({ dataUrl: await prepareImage(file), name });
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not read image' });
    }
  }, []);

  // Clipboard paste anywhere on the page: that's how people paste screenshots.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void handleFile(file, 'pasted screenshot');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  const canSubmit = !generate.isPending && (image !== null || text.trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    setError(null);
    const id = crypto.randomUUID();
    setSubmissionId(id);
    setPollEnabled(false);
    window.setTimeout(() => setPollEnabled(true), 1200);
    if (image) {
      generate.mutate({ submissionId: id, inputType: 'image', imageDataUrl: image.dataUrl });
    } else {
      generate.mutate({ submissionId: id, inputType: 'text', text: text.trim() });
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border-2 border-dashed p-1 transition-colors ${
          dragOver ? 'border-accent bg-accent-soft/40' : 'border-border'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file, file.name);
        }}
      >
        {image ? (
          <div className="space-y-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.dataUrl}
              alt="Question screenshot"
              className="max-h-80 w-auto rounded-lg border border-border"
            />
            <div className="flex items-center justify-between text-sm text-muted">
              <span>{image.name}</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                disabled={generate.isPending}
                className="text-danger hover:underline disabled:opacity-50"
              >
                Remove image
              </button>
            </div>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={generate.isPending}
            rows={7}
            placeholder={
              'Paste a test question here...\n\nOr paste a screenshot (Ctrl+V / Cmd+V), drop an image, or pick a file.'
            }
            className="w-full resize-y rounded-lg bg-transparent p-4 text-base outline-none placeholder:text-muted/70 disabled:opacity-60"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generate.isPending ? 'Working...' : 'Generate lesson'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file, file.name);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={generate.isPending}
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent-soft/40 disabled:opacity-50"
        >
          Upload screenshot
        </button>
        <span className="text-xs text-muted">Ctrl+Enter to submit</span>
      </div>

      {stage && (
        <ol className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
          <StageRow
            n={1}
            label="Classifying against TEKS"
            state={stage === 'classify' ? 'active' : 'done'}
          />
          <StageRow
            n={2}
            label="Writing the lesson for that grade level"
            state={stage === 'generate' ? 'active' : 'pending'}
          />
        </ol>
      )}

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-medium">{error.message}</p>
          {error.submissionId && (
            <p className="mt-1">
              The submission was saved.{' '}
              <Link href={`/lessons/${error.submissionId}`} className="underline">
                View what was persisted
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StageRow({
  n,
  label,
  state,
}: {
  n: number;
  label: string;
  state: 'pending' | 'active' | 'done';
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
          state === 'done'
            ? 'bg-success-soft text-success'
            : state === 'active'
              ? 'bg-accent text-white'
              : 'bg-border text-muted'
        }`}
      >
        {state === 'done' ? '✓' : n}
      </span>
      <span className={state === 'pending' ? 'text-muted' : ''}>{label}</span>
      {state === 'active' && (
        <span className="ml-auto inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      )}
    </li>
  );
}
