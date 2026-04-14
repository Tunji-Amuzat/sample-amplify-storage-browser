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

const { StorageBrowser } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
});

const GTCOLogo = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
    <rect width="60" height="60" fill="#e8450a" />
    <rect x="32" y="10" width="14" height="14" fill="white" />
    <text x="30" y="42" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="16" fill="white" textAnchor="middle">GTCO</text>
  </svg>
);

function App() {
  return (
    <Authenticator hideSignUp={true}>
      {({ signOut, user }) => (
        <>
          <div className="header">
            <div className="header-left">
              <GTCOLogo />
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
