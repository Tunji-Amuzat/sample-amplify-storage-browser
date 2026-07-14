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
          ? payload['cognito:groups'].filter((g): g is string => typeof g === 'string')
          : [];

        setDetails({
          email:
            typeof payload?.email === 'string'
              ? payload.email
              : (user.signInDetails?.loginId ?? user.username),
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

  if (error) {
    return (
      <div className="profile-page">
        <p className="profile-error">{error}</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="profile-page">
        <p className="profile-loading">Loading profile…</p>
      </div>
    );
  }

  const initial = details.email.charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card-header">
          <div className="profile-avatar">{initial}</div>
          <div className="profile-identity">
            <h2 className="profile-email">{details.email}</h2>
            <span className={`profile-role-badge${details.isAdmin ? ' admin' : ''}`}>
              {details.isAdmin ? 'Administrator' : 'Standard user'}
            </span>
          </div>
        </div>

        <dl className="profile-details">
          <div className="profile-row">
            <dt>Email</dt>
            <dd>{details.email}</dd>
          </div>
          <div className="profile-row">
            <dt>User ID</dt>
            <dd className="mono">{details.userId}</dd>
          </div>
          <div className="profile-row">
            <dt>Assigned folders</dt>
            <dd>
              {details.folders.length > 0 ? (
                <span className="profile-folder-tags">
                  {details.folders.map((folder) => (
                    <span key={folder} className="profile-folder-tag">
                      {folder}
                    </span>
                  ))}
                </span>
              ) : (
                'None assigned'
              )}
            </dd>
          </div>
        </dl>

        <p className="profile-note">
          Assigned folders are informational only — every signed-in user currently has full access
          to all folders.
        </p>
      </div>
    </div>
  );
}
