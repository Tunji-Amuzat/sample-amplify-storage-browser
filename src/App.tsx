import {
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { Authenticator, Button } from '@aws-amplify/ui-react';
import gtcoLogo from './gtco-logo.png';
Amplify.configure(config);

const { StorageBrowser } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
});

function App() {
  return (
    <Authenticator hideSignUp={true}>
      {({ signOut, user }) => (
        <>
          <div className="header">
            <div className="header-left">
              <img src={gtcoLogo} alt="GTCO" className="header-logo" />
              <div className="header-text">
                <span className="header-brand">Guaranty Trust Bank</span>
                <span className="header-greeting">Hello, {user?.username}</span>
              </div>
            </div>
            <Button onClick={signOut}>Sign out</Button>
          </div>
          <StorageBrowser />
        </>
      )}
    </Authenticator>
  );
}

export default App;
