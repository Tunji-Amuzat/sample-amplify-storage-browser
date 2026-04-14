import {
  createAmplifyAuthAdapter,
  createStorageBrowser,
  defaultHandlers,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { Authenticator, Button } from '@aws-amplify/ui-react';
Amplify.configure(config);

const { StorageBrowser } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
  actions: {
    custom: {
      bulkDownload: {
        handler: defaultHandlers.download,
        viewName: 'DownloadView',
        actionListItem: {
          icon: 'download',
          label: 'Download',
          disable: (selectedValues) => !selectedValues || selectedValues.length === 0,
        },
      },
    },
  },
});

function App() {
  return (
    <Authenticator hideSignUp={true}>
      {({ signOut, user }) => (
        <>
          <div className="header">
            <h1>{`Hello ${user?.username}`}</h1>
            <Button onClick={signOut}>Sign out</Button>
          </div>
          <StorageBrowser />
        </>
      )}
    </Authenticator>
  );
}

export default App;
