'use server';

import platformClient from 'purecloud-platform-client-v2';

export interface UserStatus {
  id: string;
  name: string;
  status: 'Available' | 'Busy' | 'Offline' | 'On Queue' | 'Away' | 'Meeting';
}

// Helper function to map Genesys Cloud system presence to UserStatus
function mapGenesysToUserStatus(genesysSystemPresence?: string): UserStatus['status'] {
  if (!genesysSystemPresence) return 'Offline';

  switch (genesysSystemPresence.toUpperCase()) {
    case 'AVAILABLE':
    case 'IDLE': // IDLE is often considered available
      return 'Available';
    case 'BUSY':
    case 'MEAL': // MEAL, TRAINING are types of Busy
    case 'TRAINING':
      return 'Busy';
    case 'AWAY':
    case 'BREAK': // BREAK is a type of Away
      return 'Away';
    case 'ON_QUEUE': // Specifically for agents waiting for interactions
      return 'On Queue';
    case 'MEETING':
      return 'Meeting';
    case 'OFFLINE':
      return 'Offline';
    default:
      // Fallback for any other unmapped Genesys statuses
      console.warn(`Unknown Genesys system presence: ${genesysSystemPresence}`);
      return 'Offline';
  }
}

interface GenesysUser {
  id: string;
  name: string;
  presence?: {
    presenceDefinition?: {
      id: string;
      systemPresence?: string;
    };
    // Other presence details might be available but are not used here
  };
  // Other user details might be available but are not used here
}

export async function getGenesysUsers(): Promise<UserStatus[]> {
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  const region = process.env.GENESYS_REGION;

  if (!clientId || !clientSecret || !region) {
    console.error('Genesys Cloud API credentials or region not configured in environment variables.');
    throw new Error('API credentials or region not configured. Please set GENESYS_CLIENT_ID, GENESYS_CLIENT_SECRET, and GENESYS_REGION in your .env.local file.');
  }

  const client = platformClient.ApiClient.instance;
  const usersApi = new platformClient.UsersApi();

  try {
    // Set Genesys Cloud environment
    const regionHost = platformClient.PureCloudRegionHosts[region as keyof typeof platformClient.PureCloudRegionHosts];
    if (!regionHost) {
      console.error(`Invalid Genesys Cloud region: ${region}. See https://developer.genesys.cloud/platform/api/`);
      throw new Error(`Invalid Genesys Cloud region specified. Please check your GENESYS_REGION environment variable.`);
    }
    client.setEnvironment(regionHost);

    // Authenticate
    await client.loginClientCredentialsGrant(clientId, clientSecret);
    console.log('Successfully authenticated with Genesys Cloud API.');

    // Fetch users with their presence information
    // Note: This fetches up to 100 users. For more users, pagination would be required.
    const userResponse = await usersApi.getUsers({
      pageSize: 100, // Max users to fetch in one go
      pageNumber: 1,
      expand: ['presence'], // Crucial to get presence data
      // Add other filters if needed, e.g., state: 'active'
    });

    if (!userResponse.entities) {
      console.log('No users found or an issue with the API response.');
      return [];
    }

    const mappedUsers = (userResponse.entities as GenesysUser[]).map((user) => {
      return {
        id: user.id,
        name: user.name || 'Unknown User',
        status: mapGenesysToUserStatus(user.presence?.presenceDefinition?.systemPresence),
      };
    });
    
    console.log(`Fetched and mapped ${mappedUsers.length} users.`);
    return mappedUsers;

  } catch (error) {
    console.error('Error fetching or processing Genesys Cloud user data:', error);
    // Provide a more specific error message if possible
    if (error instanceof Error && error.message.includes('Invalid OAuth client credentials')) {
         throw new Error('Genesys Cloud authentication failed: Invalid client ID or secret.');
    } else if (error instanceof Error && error.message.includes('Unable to find a session for token')) {
        // This can happen if token expired or was invalidated before use
        throw new Error('Genesys Cloud session/token issue. Please try again or re-check credentials.');
    }
    throw new Error('Failed to retrieve user statuses from Genesys Cloud. Check server logs for details.');
  }
}
