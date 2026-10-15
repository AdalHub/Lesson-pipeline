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
  const prepared = file.size > DOWNSCALE_ABOVE_BYTES ? await downscale(dataUrl) : dataUrl;
  if (prepared.length > 4_000_000) throw new Error('Image is too large; crop it to the question and try again.');
  return prepared;
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
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
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
      <p className="text-sm leading-6 text-muted">
        Public demo: questions and lessons appear in shared History. Please do not upload personal or student information.
      </p>
      <section
        className={`overflow-hidden rounded-[18px] border-2 bg-card transition-colors ${
          dragOver ? 'border-accent bg-accent-soft/30' : 'border-foreground'
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
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-accent text-sm font-extrabold text-white">
              1
            </span>
            <h2 className="font-bold">Add the test question</h2>
          </div>
          <p className="hidden text-xs text-muted sm:block">Text, PNG, JPG, or WebP</p>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_270px]">
          {image ? (
            <div className="flex min-h-[170px] flex-col justify-between gap-3 rounded-xl border border-border bg-background p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.dataUrl}
                alt="Question screenshot"
                className="max-h-64 w-auto rounded-lg border border-border object-contain"
              />
              <div className="flex items-center justify-between gap-4 text-sm text-muted">
                <span className="truncate">{image.name}</span>
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  disabled={generate.isPending}
                  className="shrink-0 font-semibold text-danger hover:underline disabled:opacity-50"
                >
                  Remove image
                </button>
              </div>
            </div>
          ) : (
            <div className="relative min-h-[170px] rounded-xl border border-border bg-background">
              <textarea
                aria-label="Test question"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={generate.isPending}
                rows={6}
                maxLength={10_000}
                placeholder={'Paste a question here...\nExample: A store has 24 pencils and sells 9. How many are left?'}
                className="min-h-[170px] w-full resize-y bg-transparent p-4 pb-9 text-base leading-6 outline-none placeholder:text-muted/70 disabled:opacity-60"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
                }}
              />
              <span className="pointer-events-none absolute bottom-3 left-4 text-xs text-muted">
                {text.length.toLocaleString()} / 10,000 characters
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={generate.isPending}
            className={`flex min-h-[170px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition disabled:opacity-50 ${
              dragOver
                ? 'border-accent bg-accent-soft'
                : 'border-foreground bg-card hover:bg-background'
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground bg-signal-soft">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" />
              </svg>
            </span>
            <span className="text-sm font-bold">Drop a screenshot</span>
            <span className="text-xs text-muted">or click to choose a file</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file, file.name);
            e.target.value = '';
          }}
        />

        <div className="flex flex-col items-start justify-between gap-4 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <p className="text-xs leading-5 text-muted">
            Your input is saved before either AI step begins. Ctrl+Enter also submits.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex h-12 items-center gap-3 rounded-lg border-2 border-foreground bg-foreground px-5 text-sm font-bold text-card transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {generate.isPending ? 'Working...' : 'Generate lesson'}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal text-white">
              →
            </span>
          </button>
        </div>
      </section>

      {stage && (
        <ol className="space-y-2 rounded-xl border border-foreground bg-card p-4 text-sm">
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
