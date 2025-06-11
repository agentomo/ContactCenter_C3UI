
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
    case 'IDLE': 
      return 'Available';
    case 'BUSY':
    case 'MEAL': 
    case 'TRAINING':
      return 'Busy';
    case 'AWAY':
    case 'BREAK': 
      return 'Away';
    case 'ON_QUEUE': 
      return 'On Queue';
    case 'MEETING':
      return 'Meeting';
    case 'OFFLINE':
      return 'Offline';
    default:
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
  };
}

export async function getGenesysUsers(): Promise<UserStatus[]> {
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  const region = process.env.GENESYS_REGION;

  if (!clientId || !clientSecret || !region) {
    console.error('Genesys Cloud API credentials or region not configured in environment variables.');
    throw new Error('API credentials or region not configured. Please set GENESYS_CLIENT_ID, GENESYS_CLIENT_SECRET, and GENESYS_REGION in your .env.local file (in the project root).');
  }

  const client = platformClient.ApiClient.instance;
  const usersApi = new platformClient.UsersApi();

  try {
    const regionHost = platformClient.PureCloudRegionHosts[region as keyof typeof platformClient.PureCloudRegionHosts];
    if (!regionHost) {
      console.error(`Invalid Genesys Cloud region: ${region}. See https://developer.genesys.cloud/platform/api/`);
      throw new Error(`Invalid Genesys Cloud region specified: "${region}". Please check your GENESYS_REGION environment variable.`);
    }
    client.setEnvironment(regionHost);

    await client.loginClientCredentialsGrant(clientId, clientSecret);
    console.log('Successfully authenticated with Genesys Cloud API.');

    const userResponse = await usersApi.getUsers({
      pageSize: 100, 
      pageNumber: 1,
      expand: ['presence'], 
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

  } catch (error: any) {
    console.error('Error fetching or processing Genesys Cloud user data (full error object):', error);
    
    let detailedErrorMessage = 'An unknown error occurred with the Genesys Cloud API.';
    if (error.isAxiosError && error.response) {
      // Log the detailed error response from Genesys API
      console.error('Genesys API Error Response Body:', error.response.data);
      detailedErrorMessage = `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}. Trace ID (contextId): ${error.response.data?.contextId || 'N/A'}`;
    } else if (error instanceof Error) {
      detailedErrorMessage = error.message;
    } else {
      detailedErrorMessage = String(error);
    }

    if (detailedErrorMessage.includes('Invalid OAuth client credentials') || (error.response && error.response.status === 401)) {
         throw new Error('Genesys Cloud authentication failed: Invalid client ID or secret, or token issue.');
    } else if (detailedErrorMessage.includes('Unable to find a session for token')) {
        throw new Error('Genesys Cloud session/token issue. Please try again or re-check credentials.');
    }
    
    throw new Error(`Failed to retrieve user statuses from Genesys Cloud. Details: ${detailedErrorMessage}. Check server logs for the full error object and Genesys API response body.`);
  }
}
