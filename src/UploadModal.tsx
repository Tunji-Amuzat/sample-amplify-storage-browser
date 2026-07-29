import { useRef, useState } from 'react';
import { uploadData } from 'aws-amplify/storage';

interface UploadModalProps {
  bucketName: string;
  region: string;
  /** prefix within the bucket the files land in, e.g. "sylvester/" */
  destinationKey: string;
  /** human-readable destination for the header */
  destinationLabel: string;
  onClose: () => void;
  onUploaded: () => void;
}

type Status = 'queued' | 'uploading' | 'done' | 'error';

interface Item {
  id: string;
  file: File;
  status: Status;
  transferred: number;
  total: number;
  error?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

const BADGE_COLORS: Record<string, string> = {
  pdf: '#e5484d',
  doc: '#2f6feb',
  docx: '#2f6feb',
  xls: '#2f9e44',
  xlsx: '#2f9e44',
  csv: '#2f9e44',
  ppt: '#e8590c',
  pptx: '#e8590c',
  mp3: '#e64980',
  wav: '#e64980',
  mp4: '#3b5bdb',
  mov: '#3b5bdb',
  png: '#34a99d',
  jpg: '#34a99d',
  jpeg: '#34a99d',
  gif: '#34a99d',
  svg: '#34a99d',
  html: '#7048e8',
  json: '#7048e8',
  zip: '#868e96',
};

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'file';
}

function UploadCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.6-1.02A3.75 3.75 0 0 1 17.5 18" />
      <path d="M12 13v6m0-6 2.5 2.5M12 13l-2.5 2.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 18V7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function UploadModal({
  bucketName,
  region,
  destinationKey,
  destinationLabel,
  onClose,
  onUploaded,
}: UploadModalProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      status: 'queued' as Status,
      transferred: 0,
      total: file.size,
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const runOne = (item: Item) =>
    new Promise<void>((resolve) => {
      const task = uploadData({
        path: `${destinationKey}${item.file.name}`,
        data: item.file,
        options: {
          bucket: { bucketName, region },
          onProgress: ({ transferredBytes, totalBytes }) =>
            update(item.id, {
              status: 'uploading',
              transferred: transferredBytes,
              total: totalBytes ?? item.file.size,
            }),
        },
      });

      task.result
        .then(() =>
          update(item.id, { status: 'done', transferred: item.file.size, total: item.file.size })
        )
        .catch((err) =>
          update(item.id, { status: 'error', error: err instanceof Error ? err.message : 'Failed' })
        )
        .finally(() => resolve());
    });

  const startUpload = async () => {
    const pending = items.filter((it) => it.status === 'queued' || it.status === 'error');
    if (pending.length === 0) return;
    setBusy(true);
    await Promise.all(pending.map(runOne));
    setBusy(false);
    onUploaded();
  };

  const pendingCount = items.filter((it) => it.status === 'queued' || it.status === 'error').length;
  const allDone = items.length > 0 && items.every((it) => it.status === 'done');

  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <div
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Upload files"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="upload-modal-head">
          <div>
            <h2>Upload and attach files</h2>
            <p>Add files to {destinationLabel}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label
          className={`dropzone${dragOver ? ' is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="dropzone-icon">
            <UploadCloudIcon />
          </span>
          <p className="dropzone-title">
            <span className="dropzone-link">Click to upload</span> or drag and drop
          </p>
          <p className="dropzone-hint">Documents, images, media and more</p>
        </label>

        {items.length > 0 && (
          <div className="upload-list">
            {items.map((it) => {
              const ext = extOf(it.file.name);
              const pct =
                it.status === 'done'
                  ? 100
                  : it.total
                    ? Math.min(100, Math.round((it.transferred / it.total) * 100))
                    : 0;
              return (
                <div className="upload-card" key={it.id}>
                  <span
                    className="file-badge"
                    style={{ background: BADGE_COLORS[ext] ?? '#868e96' }}
                  >
                    {ext.slice(0, 4)}
                  </span>
                  <div className="upload-card-body">
                    <div className="upload-card-row">
                      <span className="upload-name">{it.file.name}</span>
                      {it.status !== 'uploading' && (
                        <button
                          className="upload-remove"
                          onClick={() => removeItem(it.id)}
                          aria-label={`Remove ${it.file.name}`}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                    <div className="upload-meta">
                      {formatBytes(it.transferred)} of {formatBytes(it.total || it.file.size)}
                      {it.status === 'done' && (
                        <span className="upload-status done">
                          <CheckIcon /> Complete
                        </span>
                      )}
                      {it.status === 'uploading' && (
                        <span className="upload-status">Uploading…</span>
                      )}
                      {it.status === 'error' && (
                        <span className="upload-status error">{it.error ?? 'Failed'}</span>
                      )}
                    </div>
                    <div className="progress">
                      <div
                        className={`progress-fill${it.status === 'error' ? ' error' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="upload-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="upload-modal-foot">
          <button className="btn-outline" onClick={onClose}>
            {allDone ? 'Close' : 'Cancel'}
          </button>
          <button
            className="btn-primary"
            disabled={busy || pendingCount === 0}
            onClick={startUpload}
          >
            {busy ? 'Uploading…' : `Upload${pendingCount ? ` ${pendingCount}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
