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

Amplify.configure(config);

const { StorageBrowser, useView } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
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
      <StorageBrowser.LocationDetailView.LocationItemsTable />
      <StorageBrowser.LocationDetailView.Pagination />
    </StorageBrowser.LocationDetailView.Provider>
  );
}

function App() {
  return (
    <Authenticator hideSignUp={true}>
      {({ signOut }) => (
        <>
          <div className="header">
            <Button onClick={signOut} variation="link">
              Sign out
            </Button>
          </div>
          <StorageBrowser.Provider>
            <StorageBrowser.LocationsView />
            <LocationDetailViewWithExtras />
            <StorageBrowser.LocationActionView />
          </StorageBrowser.Provider>
        </>
      )}
    </Authenticator>
  );
}

export default App;
