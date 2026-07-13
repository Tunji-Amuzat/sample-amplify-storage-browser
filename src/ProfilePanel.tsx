import { useEffect, useState } from 'react';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { FOLDER_GROUPS } from './folderGroups';

interface ProfileDetails {
  email: string;
  username: string;
  userId: string;
  isAdmin: boolean;
  folders: string[];
}

export function ProfilePanel() {
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [user, session] = await Promise.all([getCurrentUser(), fetchAuthSession()]);
        const payload = session.tokens?.idToken?.payload;
        const groups = Array.isArray(payload?.['cognito:groups'])
          ? (payload['cognito:groups'].filter((g): g is string => typeof g === 'string'))
          : [];

        setDetails({
          email:
            typeof payload?.email === 'string' ? payload.email : user.signInDetails?.loginId ?? user.username,
          username: user.username,
          userId: user.userId,
          isAdmin: groups.includes('admin'),
          folders: groups.filter((group) => FOLDER_GROUPS.includes(group)),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      }
    })();
  }, []);

  if (error) return <p className="admin-panel-error">{error}</p>;
  if (!details) return <p>Loading profile...</p>;

  return (
    <div className="profile-panel">
      <h3>My profile</h3>
      <dl className="profile-details">
        <dt>Email</dt>
        <dd>{details.email}</dd>
        <dt>Username</dt>
        <dd>{details.username}</dd>
        <dt>User ID</dt>
        <dd>{details.userId}</dd>
        <dt>Role</dt>
        <dd>{details.isAdmin ? 'Administrator' : 'Standard user'}</dd>
        <dt>Assigned folders</dt>
        <dd>{details.folders.length > 0 ? details.folders.join(', ') : 'None assigned'}</dd>
      </dl>
      <p className="admin-panel-note">
        Assigned folders are informational only — every signed-in user currently has full access
        to all folders.
      </p>
    </div>
  );
}
