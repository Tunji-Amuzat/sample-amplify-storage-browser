import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { Button } from '@aws-amplify/ui-react';
import config from '../amplify_outputs.json';
import { FOLDER_GROUPS } from './folderGroups';

const USER_POOL_ID = config.auth.user_pool_id;

async function getClient() {
  const session = await fetchAuthSession();
  return new CognitoIdentityProviderClient({
    region: config.auth.aws_region,
    credentials: session.credentials,
  });
}

function getEmail(user: UserType) {
  return user.Attributes?.find((attr) => attr.Name === 'email')?.Value ?? user.Username ?? '';
}

export function AdminPanel() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSavingGroups, setIsSavingGroups] = useState(false);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);
    try {
      const client = await getClient();
      const result = await client.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID }));
      setUsers(result.Users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;
    setIsCreatingUser(true);
    setError(null);
    try {
      const client = await getClient();
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: newUserEmail,
          UserAttributes: [
            { Name: 'email', Value: newUserEmail },
            { Name: 'email_verified', Value: 'true' },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        })
      );
      setNewUserEmail('');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleSelectUser = async (username: string) => {
    setSelectedUsername(username);
    setIsLoadingGroups(true);
    setError(null);
    try {
      const client = await getClient();
      const result = await client.send(
        new AdminListGroupsForUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
      );
      const groupNames = (result.Groups ?? [])
        .map((group) => group.GroupName)
        .filter((name): name is string => !!name && FOLDER_GROUPS.includes(name));
      setSelectedGroups(groupNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder assignments.');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const toggleGroup = (groupName: string) => {
    setSelectedGroups((current) =>
      current.includes(groupName)
        ? current.filter((name) => name !== groupName)
        : [...current, groupName]
    );
  };

  const handleSaveGroups = async () => {
    if (!selectedUsername) return;
    setIsSavingGroups(true);
    setError(null);
    try {
      const client = await getClient();
      const result = await client.send(
        new AdminListGroupsForUserCommand({ UserPoolId: USER_POOL_ID, Username: selectedUsername })
      );
      const currentGroups = (result.Groups ?? [])
        .map((group) => group.GroupName)
        .filter((name): name is string => !!name && FOLDER_GROUPS.includes(name));

      const toAdd = selectedGroups.filter((name) => !currentGroups.includes(name));
      const toRemove = currentGroups.filter((name) => !selectedGroups.includes(name));

      for (const groupName of toAdd) {
        await client.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: selectedUsername,
            GroupName: groupName,
          })
        );
      }
      for (const groupName of toRemove) {
        await client.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: selectedUsername,
            GroupName: groupName,
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder assignments.');
    } finally {
      setIsSavingGroups(false);
    }
  };

  return (
    <div className="admin-panel">
      <p className="admin-panel-note">
        Folder assignments below are for organizing access and aren't enforced yet — every
        signed-in user currently has full access to all folders.
      </p>

      {error && <p className="admin-panel-error">{error}</p>}

      <div className="admin-panel-body">
        <div className="admin-panel-users">
          <h3>Users</h3>
          <form className="admin-create-user-form" onSubmit={handleCreateUser}>
            <input
              type="email"
              placeholder="new.user@example.com"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              required
            />
            <Button type="submit" isLoading={isCreatingUser} variation="primary">
              Invite user
            </Button>
          </form>

          {isLoadingUsers ? (
            <p>Loading users...</p>
          ) : (
            <ul className="admin-user-list">
              {users.map((user) => (
                <li key={user.Username}>
                  <button
                    type="button"
                    className={user.Username === selectedUsername ? 'selected' : ''}
                    onClick={() => user.Username && handleSelectUser(user.Username)}
                  >
                    {getEmail(user)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-panel-folders">
          <h3>Folder access</h3>
          {!selectedUsername ? (
            <p>Select a user to view or edit their folder assignments.</p>
          ) : isLoadingGroups ? (
            <p>Loading folder assignments...</p>
          ) : (
            <>
              <ul className="admin-folder-list">
                {FOLDER_GROUPS.map((groupName) => (
                  <li key={groupName}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(groupName)}
                        onChange={() => toggleGroup(groupName)}
                      />
                      {groupName}
                    </label>
                  </li>
                ))}
              </ul>
              <Button onClick={handleSaveGroups} isLoading={isSavingGroups} variation="primary">
                Save
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
