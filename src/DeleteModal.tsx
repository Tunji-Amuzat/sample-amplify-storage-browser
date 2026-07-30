import { useState } from 'react';
import { list, remove } from 'aws-amplify/storage';

export interface DeleteTarget {
  key: string;
  type: 'FILE' | 'FOLDER';
  name: string;
}

interface DeleteModalProps {
  bucketName: string;
  region: string;
  items: DeleteTarget[];
  onClose: () => void;
  onDeleted: () => void;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 18V7" />
    </svg>
  );
}

export function DeleteModal({ bucketName, region, items, onClose, onDeleted }: DeleteModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bucket = { bucketName, region };
  const count = items.length;
  const single = count === 1 ? items[0] : undefined;

  async function deleteTarget(t: DeleteTarget) {
    if (t.type === 'FOLDER') {
      // A folder is a prefix — remove every object beneath it.
      const listed = await list({ path: t.key, options: { bucket, listAll: true } });
      for (const obj of listed.items) {
        await remove({ path: obj.path, options: { bucket } });
      }
    } else {
      await remove({ path: t.key, options: { bucket } });
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      for (const t of items) await deleteTarget(t);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm delete"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="confirm-icon danger">
          <TrashIcon />
        </span>
        <h2>
          Delete {count > 1 ? `${count} items` : single?.type === 'FOLDER' ? 'folder' : 'file'}?
        </h2>
        <p>
          {count > 1 ? (
            <>Are you sure you want to delete these {count} items?</>
          ) : (
            <>
              Are you sure you want to delete <strong>{single?.name}</strong>?
            </>
          )}{' '}
          This can’t be undone.
          {single?.type === 'FOLDER' && ' Everything inside it will be removed.'}
        </p>

        {error && <p className="confirm-error">{error}</p>}

        <div className="confirm-foot">
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-danger" onClick={confirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
