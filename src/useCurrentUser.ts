import { useEffect, useState } from 'react';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

export interface CurrentUser {
  email: string;
  initial: string;
  isAdmin: boolean;
}

/**
 * Identity for the app shell. The sidebar shows who is signed in on every screen,
 * so this is read once and reused rather than only on the profile page.
 */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [current, session] = await Promise.all([getCurrentUser(), fetchAuthSession()]);
        if (cancelled) return;

        const payload = session.tokens?.idToken?.payload;
        const groups = Array.isArray(payload?.['cognito:groups'])
          ? payload['cognito:groups'].filter((g): g is string => typeof g === 'string')
          : [];

        const email =
          typeof payload?.email === 'string'
            ? payload.email
            : (current.signInDetails?.loginId ?? current.username);

        setUser({
          email,
          initial: email.charAt(0).toUpperCase(),
          isAdmin: groups.includes('admin'),
        });
      } catch {
        if (!cancelled) setUser(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
