import {
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import type { ActionHandler } from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { getUrl } from 'aws-amplify/storage';
import { Authenticator, Button } from '@aws-amplify/ui-react';
Amplify.configure(config);

const bulkDownloadHandler: ActionHandler = ({ data }) => {
  const { key } = data as { key: string };
  const result = getUrl({ path: key }).then(({ url }) => {
    const a = document.createElement('a');
    a.href = url.toString();
    a.download = key.split('/').pop() ?? key;
    a.click();
    return { status: 'COMPLETE' as const };
  });
  return { result };
};

const { StorageBrowser } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
  actions: {
    custom: {
      bulkDownload: {
        handler: bulkDownloadHandler,
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
