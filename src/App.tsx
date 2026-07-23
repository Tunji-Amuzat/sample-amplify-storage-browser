import { useEffect, useRef, useState } from 'react';
import {
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { Authenticator, Button } from '@aws-amplify/ui-react';
import { ProfilePanel } from './ProfilePanel';

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

  // Only render when a location is selected and no action (upload/delete/etc.) is active
  if (!state.location.current || state.actionType) return null;

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

type View = 'browser' | 'profile';

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
        <>
          <div className="header">
            {view !== 'browser' && (
              <Button onClick={() => setView('browser')} variation="link">
                Back to files
              </Button>
            )}
            {view !== 'profile' && (
              <Button onClick={() => setView('profile')} variation="link">
                My profile
              </Button>
            )}
            <Button onClick={signOut} variation="link">
              Sign out
            </Button>
          </div>
          {view === 'profile' && <ProfilePanel />}
          {view === 'browser' && (
            <div className="browser-card">
              <StorageBrowser.Provider
                onValueChange={(event) => setHasLocation(!!event.location)}
              >
                {hasLocation ? (
                  <>
                    <LocationDetailViewWithExtras />
                    <StorageBrowser.LocationActionView />
                  </>
                ) : (
                  <RootLocationGate />
                )}
              </StorageBrowser.Provider>
            </div>
          )}
        </>
      )}
    </Authenticator>
  );
}

export default App;
