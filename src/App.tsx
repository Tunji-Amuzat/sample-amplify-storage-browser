import { useState } from 'react';
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

const { StorageBrowser, useView } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
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

type View = 'browser' | 'profile';

const authComponents = {
  Header() {
    return (
      <div className="auth-header">
        <h1>Welcome back</h1>
        <p>Sign in to access your documents</p>
      </div>
    );
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
                  <StorageBrowser.LocationsView />
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
