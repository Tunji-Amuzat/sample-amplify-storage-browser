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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Actions render in a modal over this view, so the list stays put behind them
  // instead of the whole page navigating away.
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

  return (
    <StorageBrowser.LocationDetailView.Provider {...state} pageItems={filteredItems}>
      <StorageBrowser.LocationDetailView.Navigation />
      <div className="detail-actions">
        <button
          className="action-button action-button--primary"
          onClick={() => state.onActionSelect('createFolder')}
        >
          New folder
        </button>
        <button className="action-button" onClick={() => state.onActionSelect('upload')}>
          Upload
        </button>
      </div>
      <div className="detail-toolbar">
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
        {selectedCount > 0 && (
          <span className="selected-badge">
            {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>
      <StorageBrowser.LocationDetailView.ActionsList />
      <StorageBrowser.LocationDetailView.Search />
      <StorageBrowser.LocationDetailView.SearchSubfoldersToggle />
      <StorageBrowser.LocationDetailView.Message />
      <StorageBrowser.LocationDetailView.LoadingIndicator />
      <div className="detail-body">
        <div className="detail-table-area">
          <StorageBrowser.LocationDetailView.LocationItemsTable />
          <StorageBrowser.LocationDetailView.Pagination />
        </div>
        <StorageBrowser.LocationDetailView.FilePreview />
      </div>
    </StorageBrowser.LocationDetailView.Provider>
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

/**
 * Renders the file list with actions layered over it in a modal, and refreshes
 * the list once an action closes so new folders and uploads appear without a
 * manual page refresh.
 */
function LocationWorkspace() {
  const state = useView('LocationDetail');
  const { actionType, onRefresh } = state;

  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  const previousAction = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousAction.current && !actionType) refresh.current();
    previousAction.current = actionType;
  }, [actionType]);

  return (
    <>
      <LocationDetailViewWithExtras />
      {actionType && (
        <div className="modal-scrim" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true">
            <StorageBrowser.LocationActionView />
          </div>
        </div>
      )}
    </>
  );
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

function Sidebar({
  view,
  onNavigate,
  onSignOut,
}: {
  view: View;
  onNavigate: (view: View) => void;
  onSignOut: () => void;
}) {
  const user = useCurrentUser();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandMark />
        <span>Bastion Vault</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-link${view === 'browser' ? ' is-active' : ''}`}
          onClick={() => onNavigate('browser')}
        >
          <FilesIcon />
          Files
        </button>
        <button
          className={`sidebar-link${view === 'profile' ? ' is-active' : ''}`}
          onClick={() => onNavigate('profile')}
        >
          <ProfileIcon />
          Profile
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.initial ?? '·'}</div>
          <div className="sidebar-user-text">
            <span className="sidebar-user-email">{user?.email ?? 'Signed in'}</span>
            <span className="sidebar-user-role">
              {user?.isAdmin ? 'Administrator' : 'Standard user'}
            </span>
          </div>
          <button className="sidebar-signout" onClick={onSignOut} aria-label="Sign out">
            <SignOutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 4 5.2v6.3c0 4.6 3.2 8.9 8 10.5 4.8-1.6 8-5.9 8-10.5V5.2L12 2Z"
        fill="var(--bv-navy)"
      />
      <path
        d="M12 9.6a1.9 1.9 0 0 0-1 3.5v1.7a1 1 0 0 0 2 0v-1.7a1.9 1.9 0 0 0-1-3.5Z"
        fill="var(--bv-lilac)"
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
        <h1>Welcome back</h1>
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
          <Sidebar view={view} onNavigate={setView} onSignOut={() => signOut?.()} />

          <main className="app-main">
            {view === 'profile' && <ProfilePanel />}
            {view === 'browser' && (
              <div className="browser-card">
                <StorageBrowser.Provider
                  onValueChange={(event) => setHasLocation(!!event.location)}
                >
                  {hasLocation ? <LocationWorkspace /> : <RootLocationGate />}
                </StorageBrowser.Provider>
              </div>
            )}
          </main>
        </div>
      )}
    </Authenticator>
  );
}

export default App;
