
'use server';

import platformClient from 'purecloud-platform-client-v2';
import type { ApiClient } from 'purecloud-platform-client-v2';


export interface UserStatus {
  id: string;
  name: string;
  status: 'Available' | 'Busy' | 'Offline' | 'On Queue' | 'Away' | 'Meeting';
  divisionId: string;
  divisionName: string;
}

function mapGenesysToUserStatus(genesysSystemPresence?: string): UserStatus['status'] {
  if (!genesysSystemPresence) return 'Offline';
  switch (genesysSystemPresence.toUpperCase()) {
    case 'AVAILABLE': case 'IDLE': return 'Available';
    case 'BUSY': case 'MEAL': case 'TRAINING': return 'Busy';
    case 'AWAY': case 'BREAK': return 'Away';
    case 'ON_QUEUE': return 'On Queue';
    case 'MEETING': return 'Meeting';
    case 'OFFLINE': return 'Offline';
    default: console.warn(`Unknown Genesys system presence: ${genesysSystemPresence}`); return 'Offline';
  }
}

interface GenesysUser {
  id: string;
  name: string;
  presence?: { presenceDefinition?: { id: string; systemPresence?: string; }; };
  division?: { id: string; name: string; };
}

// Helper to manage Genesys Cloud API client authentication
async function getAuthenticatedClient(): Promise<ApiClient> {
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  const region = process.env.GENESYS_REGION;

  if (!clientId || !clientSecret || !region) {
    console.error('Genesys Cloud API credentials or region not configured.');
    throw new Error('API credentials or region not configured. Please set GENESYS_CLIENT_ID, GENESYS_CLIENT_SECRET, and GENESYS_REGION in your .env.local file.');
  }

  const client = platformClient.ApiClient.instance;
  const regionHost = platformClient.PureCloudRegionHosts[region as keyof typeof platformClient.PureCloudRegionHosts];
  if (!regionHost) {
    console.error(`Invalid Genesys Cloud region: ${region}.`);
    throw new Error(`Invalid Genesys Cloud region specified: "${region}".`);
  }
  
  // Check if already authenticated by looking for the authentication object and access token
  if (!client.authentications['PureCloud OAuth']?.accessToken) {
    client.setEnvironment(regionHost);
    try {
      await client.loginClientCredentialsGrant(clientId, clientSecret);
      console.log('Successfully authenticated with Genesys Cloud API.');
    } catch (authError: any) {
      console.error('Genesys Cloud authentication failed:', authError.message || authError);
      let errorMessage = 'Genesys Cloud authentication failed.';
      if (authError.message?.includes('invalid_client')) {
        errorMessage = 'Genesys Cloud authentication failed: Invalid client ID or secret, or client not authorized for client_credential grant.';
      } else if (authError.body && authError.body.error === 'unauthorized_client') {
        errorMessage = 'Genesys Cloud authentication failed: Client is not authorized to use the client_credential grant type. Please check OAuth client configuration in Genesys Cloud.';
      }
      throw new Error(errorMessage);
    }
  }
  return client;
}


export async function getGenesysUsers(): Promise<UserStatus[]> {
  await getAuthenticatedClient();
  const usersApi = new platformClient.UsersApi();

  try {
    const userResponse = await usersApi.getUsers({
      pageSize: 100, // Consider pagination for more users
      pageNumber: 1,
      expand: ['presence', 'division'],
    });

    if (!userResponse.entities) {
      console.log('No users found or an issue with the API response.');
      return [];
    }

    const mappedUsers = (userResponse.entities as GenesysUser[]).map((user) => ({
      id: user.id,
      name: user.name || 'Unknown User',
      status: mapGenesysToUserStatus(user.presence?.presenceDefinition?.systemPresence),
      divisionId: user.division?.id || 'N/A',
      divisionName: user.division?.name || 'N/A',
    }));
    console.log(`Fetched and mapped ${mappedUsers.length} users.`);
    return mappedUsers;
  } catch (error: any) {
    console.error('Error fetching or processing Genesys Cloud user data (full error object):', error);
    let detailedErrorMessage = 'An unknown error occurred while fetching user data.';
     if (error.body && error.body.message) {
        detailedErrorMessage = error.body.message;
        if (error.body.contextId) detailedErrorMessage += ` (Trace ID: ${error.body.contextId})`;
    } else if (error.message) {
        detailedErrorMessage = error.message;
    }
    throw new Error(`Failed to retrieve user statuses from Genesys Cloud. Details: ${detailedErrorMessage}. Check server logs for the full error object and Genesys API response body.`);
  }
}


// --- Skills Management Types and Actions ---

export interface SkillDefinition {
  id: string;
  name: string;
}

export interface UserRoutingSkill {
  id: string; // This is the skill's ID
  name: string;
  proficiency: number; // Genesys API uses 1-5
}

// For updating skills, the API expects a list of objects with skillId and proficiency
export interface UserRoutingSkillUpdateItem {
  skillId: string;
  proficiency: number;
  state?: 'active' | 'inactive' | 'deleted'; // Optional, defaults to 'active' if not provided
}

export async function getAllSkills(): Promise<SkillDefinition[]> {
  await getAuthenticatedClient();
  const routingApi = new platformClient.RoutingApi();
  try {
    // Consider pagination if there are many skills
    const skillsData = await routingApi.getRoutingSkills({ pageSize: 200, pageNumber: 1 });
    return (skillsData.entities || []).map(skill => ({
      id: skill.id!,
      name: skill.name!,
    })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error('Error fetching all skills:', error.body || error.message);
    throw new Error(`Failed to fetch skills from Genesys Cloud. Details: ${error.body?.message || error.message}`);
  }
}

export async function getUserSkills(userId: string): Promise<UserRoutingSkill[]> {
  await getAuthenticatedClient();
  const usersApi = new platformClient.UsersApi();
  try {
    const userSkillsData = await usersApi.getUserRoutingskills(userId, { pageSize: 100 });
    return (userSkillsData.entities || [])
      .filter(skill => skill.id && skill.name && skill.proficiency !== undefined) // Ensure essential fields are present
      .map(skill => ({
        id: skill.id!, 
        name: skill.name!,
        proficiency: skill.proficiency!,
      })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error(`Error fetching skills for user ${userId}:`, error.body || error.message);
    throw new Error(`Failed to fetch skills for user ${userId}. Details: ${error.body?.message || error.message}`);
  }
}

export async function updateUserSkills(userId: string, skillsToSet: UserRoutingSkillUpdateItem[]): Promise<UserRoutingSkill[]> {
  await getAuthenticatedClient();
  const usersApi = new platformClient.UsersApi();

  // Map to the format expected by the SDK/API for PUT request
  // The body for PUT should be an array of objects, each defining a skill and its proficiency.
  // The 'id' in Models.UserRoutingSkill is the skillId.
  const apiFormattedSkills = skillsToSet.map(s => ({
    id: s.skillId, // This is the skill ID
    proficiency: s.proficiency,
    state: s.state || 'active', // Default to active if not specified
  }));

  try {
    // The SDK's putUserRoutingskills method expects the array of skill objects as the second argument (body).
    const updatedSkillsData = await usersApi.putUserRoutingskills(userId, apiFormattedSkills);
    
    // The response from PUT is UserSkillEntityListing, map it back
    return (updatedSkillsData.entities || [])
      .filter(skill => skill.id && skill.name && skill.proficiency !== undefined)
      .map(skill => ({
        id: skill.id!,
        name: skill.name!,
        proficiency: skill.proficiency!,
      })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error(`Error updating skills for user ${userId}:`, error.body || error.message);
    let details = error.message;
    if (error.body && error.body.message) {
        details = error.body.message;
        if (error.body.details && error.body.details.length > 0 && error.body.details[0]) {
            details += ` (${error.body.details[0].errorMessage || error.body.details[0].errorCode || JSON.stringify(error.body.details[0])})`;
        } else if (error.body.contextId) {
            details += ` (Trace ID: ${error.body.contextId})`;
        }
    } else if (error.response?.data?.message) { 
        details = error.response.data.message;
    }
    throw new Error(`Failed to update skills for user ${userId}. Details: ${details}`);
  }
}

// Remove the old helper function for credentials as it's incorporated into getAuthenticatedClient
// function getGenesysCredentials() { ... }
// The usersApi and routingApi are instantiated where needed after client authentication.
