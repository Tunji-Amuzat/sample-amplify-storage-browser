import { useEffect, useRef, useState } from 'react';
import {
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { ProfilePanel } from './ProfilePanel';
import { useCurrentUser } from './useCurrentUser';
import { UploadModal } from './UploadModal';
import { DeleteModal, type DeleteTarget } from './DeleteModal';

Amplify.configure(config);

function PdfPreview({ url }: { url: string }) {
  return <iframe src={url} title="PDF preview" className="pdf-preview-frame" />;
}

// `contentDisposition` is supported by the underlying Amplify Storage `getUrl` call
// but isn't declared on the library's public `FilePreviewUrlOptions` type.
interface PdfUrlOptions {
  contentDisposition?: 'inline' | 'attachment';
  expiresIn?: number;
  validateObjectExistence?: boolean;
}

/**
 * Where the vault starts.
 *
 * Empty string = the whole bucket, so every top-level folder that exists in S3
 * shows up without being declared anywhere. Set this to a prefix such as
 * `'client-records/'` to root a deployment inside one folder instead.
 */
const ROOT_PREFIX = '';

const BUCKET_NAME = config.storage.bucket_name;

/**
 * A "location" is normally a hardcoded IAM grant, which meant every top-level
 * folder had to be declared in `backend.ts` and redeployed before it appeared.
 * Serving a single location rooted at the bucket instead lets the browser list
 * whatever is actually in S3, and lets users create folders from the UI.
 */
const amplifyAdapter = createAmplifyAuthAdapter();

const { StorageBrowser, useView } = createStorageBrowser({
  config: {
    ...amplifyAdapter,
    listLocations: async () => ({
      items: [
        {
          bucket: BUCKET_NAME,
          id: 'vault-root',
          prefix: ROOT_PREFIX,
          permissions: ['get', 'list', 'write', 'delete'],
          type: ROOT_PREFIX === '' ? 'BUCKET' : 'PREFIX',
        },
      ],
      nextToken: undefined,
    }),
  },
  filePreview: {
    fileTypeResolver: (fileData) =>
      fileData.key?.toLowerCase().endsWith('.pdf') ? 'pdf' : undefined,
    rendererResolver: (fileType) => (fileType === 'pdf' ? PdfPreview : undefined),
    // The library defaults preview URLs to `contentDisposition: 'attachment'`, which
    // makes browsers download PDFs loaded in an <iframe> instead of rendering them inline.
    urlOptions: (fileType) =>
      fileType === 'pdf' ? ({ contentDisposition: 'inline' } as PdfUrlOptions) : undefined,
  },
});

function LocationDetailViewWithExtras() {
  const state = useView('LocationDetail');
  const user = useCurrentUser();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { actionType, onRefresh } = state;

  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  // Refresh the listing once an action closes so new folders and uploads appear
  // without a manual page refresh.
  const previousAction = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousAction.current && !actionType) refresh.current();
    previousAction.current = actionType;
  }, [actionType]);

  if (!state.location.current) return null;

  const isFiltering = fromDate || toDate;

  const filteredItems = isFiltering
    ? state.pageItems.filter((item) => {
        if (item.type === 'FILE') {
          const itemDate = new Date(item.lastModified).toISOString().split('T')[0];
          if (fromDate && itemDate < fromDate) return false;
          if (toDate && itemDate > toDate) return false;
          return true;
        }
        return true;
      })
    : state.pageItems;

  const selectedCount = state.dataItems?.length ?? 0;

  const deleteTargets: DeleteTarget[] = (state.dataItems ?? [])
    .filter((item) => item.type === 'FILE' || item.type === 'FOLDER')
    .map((item) => ({
      key: item.key,
      type: item.type as 'FILE' | 'FOLDER',
      name: item.key.split('/').filter(Boolean).pop() ?? item.key,
    }));

  return (
    <>
    <StorageBrowser.LocationDetailView.Provider {...state} pageItems={filteredItems}>
      {/* Greeting + primary actions on one row (Figma page header) */}
      <div className="files-header">
        <div className="files-title">
          <h1>Welcome back{user ? `, ${user.name}` : ''}</h1>
          <p>Browse and manage your documents</p>
        </div>
        <div className="files-actions">
          <button className="btn-outline" onClick={() => state.onActionSelect('createFolder')}>
            <FolderPlusIcon />
            New Folder
          </button>
          <button className="btn-primary" onClick={() => state.onActionSelect('upload')}>
            <PlusIcon />
            Upload
          </button>
        </div>
      </div>

      {/* Breadcrumb on the left, search + date filter on the right */}
      <div className="files-toolbar">
        <StorageBrowser.LocationDetailView.Navigation />
        <div className="files-toolbar-right">
          <StorageBrowser.LocationDetailView.Search />
          <div className="date-filter">
            <label>Date range</label>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
            />
            {isFiltering && (
              <button className="clear-filter" onClick={() => { setFromDate(''); setToDate(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contextual action bar — appears when rows are selected, replacing the
          overflow kebab menu (Drive-style). */}
      {selectedCount > 0 && (
        <div className="selection-bar">
          <span className="selection-count">
            {selectedCount} selected
          </span>
          <div className="selection-actions">
            <button onClick={() => state.onActionSelect('download')}>
              <DownloadIcon />
              Download
            </button>
            <button className="danger" onClick={() => state.onActionSelect('delete')}>
              <TrashIcon />
              Delete
            </button>
          </div>
        </div>
      )}
      <StorageBrowser.LocationDetailView.SearchSubfoldersToggle />
      <StorageBrowser.LocationDetailView.Message />
      <StorageBrowser.LocationDetailView.LoadingIndicator />
      <div className="detail-body">
        <div className="detail-table-area">
          <StorageBrowser.LocationDetailView.LocationItemsTable />
          <StorageBrowser.LocationDetailView.Pagination />
        </div>
      </div>

      {/* File preview as a centred lightbox instead of a squeezed side panel */}
      {state.activeFile && (
        <div
          className="modal-scrim"
          role="presentation"
          onClick={() => state.onSelectActiveFile(undefined)}
        >
          <div
            className="preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="File preview"
            onClick={(e) => e.stopPropagation()}
          >
            <StorageBrowser.LocationDetailView.FilePreview />
          </div>
        </div>
      )}
    </StorageBrowser.LocationDetailView.Provider>
    {actionType === 'upload' ? (
      <UploadModal
        bucketName={BUCKET_NAME}
        region={config.storage.aws_region}
        destinationKey={state.location.key}
        destinationLabel={state.location.key || BUCKET_NAME}
        onClose={() => state.onActionExit()}
        onUploaded={() => state.onRefresh()}
      />
    ) : actionType === 'delete' && deleteTargets.length > 0 ? (
      <DeleteModal
        bucketName={BUCKET_NAME}
        region={config.storage.aws_region}
        items={deleteTargets}
        onClose={() => state.onActionExit()}
        onDeleted={() => {
          state.onRefresh();
          state.onActionExit();
        }}
      />
    ) : (
      actionType && (
        <div className="modal-scrim" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true">
            <StorageBrowser.LocationActionView />
          </div>
        </div>
      )
    )}
    </>
  );
}

/**
 * The vault grants a single root location, so the locations list would be a
 * one-row table. Navigate straight into it and let users work with real folders
 * instead. Falls back to the normal list if more than one location is granted.
 */
function RootLocationGate() {
  const state = useView('Locations');
  const entered = useRef(false);

  const only = state.pageItems.length === 1 ? state.pageItems[0] : undefined;

  useEffect(() => {
    if (entered.current || !only) return;
    entered.current = true;
    state.onNavigate(only);
  }, [only, state]);

  if (only) return null;

  return <StorageBrowser.LocationsView />;
}

type View = 'browser' | 'profile';

function FilesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5v-10Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 8V6a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 14 18v-2" />
      <path d="M17 12H9m8 0-2.5-2.5M17 12l-2.5 2.5" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5v-10Z" />
      <path d="M11 12.5h4M13 10.5v4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 18V7" />
    </svg>
  );
}

function TopNav({
  view,
  onNavigate,
  onSignOut,
}: {
  view: View;
  onNavigate: (view: View) => void;
  onSignOut: () => void;
}) {
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="topnav-brand">
          <BrandMark />
          <span>Bastion Vault</span>
        </div>

        <nav className="topnav-links">
          <button
            className={`topnav-link${view === 'browser' ? ' is-active' : ''}`}
            onClick={() => onNavigate('browser')}
          >
            <FilesIcon />
            Folders
          </button>
        </nav>

        <div className="topnav-user-menu">
          <button
            className="topnav-user-pill"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="topnav-avatar">{user?.initial ?? '·'}</span>
            <span className="topnav-user-text">
              <span className="topnav-user-name">{user?.name ?? 'Account'}</span>
              <span className="topnav-user-role">
                {user?.isAdmin ? 'Administrator' : 'Standard user'}
              </span>
            </span>
            <ChevronDownIcon />
          </button>

          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="user-dropdown" role="menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    onNavigate('profile');
                    setMenuOpen(false);
                  }}
                >
                  <ProfileIcon />
                  Profile
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    onSignOut();
                    setMenuOpen(false);
                  }}
                >
                  <SignOutIcon />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 4 5.2v6.3c0 4.6 3.2 8.9 8 10.5 4.8-1.6 8-5.9 8-10.5V5.2L12 2Z"
        fill="var(--bv-primary)"
      />
      <path
        d="M12 9.6a1.9 1.9 0 0 0-1 3.5v1.7a1 1 0 0 0 2 0v-1.7a1.9 1.9 0 0 0-1-3.5Z"
        fill="var(--bv-accent)"
      />
    </svg>
  );
}

const authComponents = {
  Header() {
    return (
      <div className="auth-header">
        <div className="auth-brand">
          <BrandMark />
          <span className="auth-brand-name">Bastion Vault</span>
        </div>
        <h1>Welcome Back</h1>
        <p>Sign in to access your documents</p>
      </div>
    );
  },
  Footer() {
    return <p className="auth-footer">Secure enterprise data access control</p>;
  },
};

function App() {
  const [hasLocation, setHasLocation] = useState(false);
  const [view, setView] = useState<View>('browser');

  return (
    <Authenticator hideSignUp={true} components={authComponents}>
      {({ signOut }) => (
        <div className="app-shell">
          <TopNav view={view} onNavigate={setView} onSignOut={() => signOut?.()} />

          <main className="app-main">
            {view === 'profile' && (
              <>
                <div className="page-heading">
                  <h1>Profile</h1>
                  <p>Your account and access details</p>
                </div>
                <ProfilePanel />
              </>
            )}
            {/* Kept mounted across view changes. Unmounting the provider resets the
                browser's location, which left the file list blank on the way back. */}
            <div className="browser-card" hidden={view !== 'browser'}>
              <StorageBrowser.Provider
                onValueChange={(event) => setHasLocation(!!event.location)}
              >
                {hasLocation ? <LocationDetailViewWithExtras /> : <RootLocationGate />}
              </StorageBrowser.Provider>
            </div>
          </main>
        </div>
      )}
    </Authenticator>
  );
}

export default App;
