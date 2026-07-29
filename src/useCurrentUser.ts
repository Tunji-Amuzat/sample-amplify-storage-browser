import { useEffect, useState } from 'react';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

export interface CurrentUser {
  email: string;
  name: string;
  initial: string;
  isAdmin: boolean;
}

/** Best-effort first name from an email local part, e.g. joshua.adebayo@x → Joshua */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const first = local.split(/[.\-_+]/)[0] ?? local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'there';
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
          name: nameFromEmail(email),
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
