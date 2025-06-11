
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
    default: console.warn(`[actions.ts] mapGenesysToUserStatus: Unknown Genesys system presence: ${genesysSystemPresence}`); return 'Offline';
  }
}

interface GenesysUser {
  id: string;
  name: string;
  presence?: { presenceDefinition?: { id: string; systemPresence?: string; }; };
  division?: { id: string; name: string; };
}

async function getAuthenticatedClient(): Promise<ApiClient> {
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  const region = process.env.GENESYS_REGION;

  if (!clientId || !clientSecret || !region) {
    console.error('[actions.ts] getAuthenticatedClient: Genesys Cloud API credentials or region not configured in .env.local');
    throw new Error('API credentials or region not configured. Please set GENESYS_CLIENT_ID, GENESYS_CLIENT_SECRET, and GENESYS_REGION in your .env.local file.');
  }

  const client = platformClient.ApiClient.instance;
  const regionHost = platformClient.PureCloudRegionHosts[region as keyof typeof platformClient.PureCloudRegionHosts];
  if (!regionHost) {
    console.error(`[actions.ts] getAuthenticatedClient: Invalid Genesys Cloud region specified: ${region}.`);
    throw new Error(`Invalid Genesys Cloud region specified: "${region}".`);
  }
  
  if (!client.authentications['PureCloud OAuth']?.accessToken) {
    client.setEnvironment(regionHost);
    try {
      await client.loginClientCredentialsGrant(clientId, clientSecret);
      console.log('[actions.ts] getAuthenticatedClient: Successfully authenticated with Genesys Cloud API.');
    } catch (authError: any) {
      console.error('[actions.ts] getAuthenticatedClient: Genesys Cloud authentication failed:', authError.message || authError);
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
      pageSize: 100, 
      pageNumber: 1,
      expand: ['presence', 'division'],
    });

    if (!userResponse.entities || userResponse.entities.length === 0) {
      console.log('[actions.ts] getGenesysUsers: No users found or an issue with the API response.');
      return [];
    }

    const mappedUsers = (userResponse.entities as GenesysUser[]).map((user) => ({
      id: user.id,
      name: user.name || 'Unknown User',
      status: mapGenesysToUserStatus(user.presence?.presenceDefinition?.systemPresence),
      divisionId: user.division?.id || 'N/A',
      divisionName: user.division?.name || 'N/A',
    }));
    return mappedUsers;
  } catch (error: any) {
    console.error('[actions.ts] getGenesysUsers: Error fetching or processing Genesys Cloud user data:', error.body || error.message, error);
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


export interface SkillDefinition {
  id: string;
  name: string;
}

export interface UserRoutingSkill {
  id: string; 
  name: string;
  proficiency: number; 
}

export interface UserRoutingSkillUpdateItem {
  skillId: string;
  proficiency: number;
  state?: 'active' | 'inactive' | 'deleted'; 
}

export async function getAllSkills(): Promise<SkillDefinition[]> {
  await getAuthenticatedClient();
  const routingApi = new platformClient.RoutingApi();
  try {
    const skillsData = await routingApi.getRoutingSkills({ pageSize: 200, pageNumber: 1 });
    return (skillsData.entities || []).map(skill => ({
      id: skill.id!,
      name: skill.name!,
    })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error('[actions.ts] getAllSkills: Error fetching all skills:', error.body || error.message);
    throw new Error(`Failed to fetch skills from Genesys Cloud. Details: ${error.body?.message || error.message}`);
  }
}

export async function getUserSkills(userId: string): Promise<UserRoutingSkill[]> {
  await getAuthenticatedClient();
  const usersApi = new platformClient.UsersApi();
  try {
    const userSkillsData = await usersApi.getUserRoutingskills(userId, { pageSize: 100 });
    return (userSkillsData.entities || [])
      .filter(skill => skill.id && skill.name && skill.proficiency !== undefined) 
      .map(skill => ({
        id: skill.id!, 
        name: skill.name!,
        proficiency: skill.proficiency!,
      })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error(`[actions.ts] getUserSkills: Error fetching skills for user ${userId}:`, error.body || error.message);
    throw new Error(`Failed to fetch skills for user ${userId}. Details: ${error.body?.message || error.message}`);
  }
}

export async function updateUserSkills(userId: string, skillsToSet: UserRoutingSkillUpdateItem[]): Promise<UserRoutingSkill[]> {
  const apiClient = await getAuthenticatedClient(); 
  const usersApi = new platformClient.UsersApi(apiClient);
  
  const apiFormattedSkills = skillsToSet.map(s => ({
    id: s.skillId, 
    proficiency: s.proficiency,
    state: s.state || 'active', 
  }));

  try {
    // console.log(`[actions.ts] updateUserSkills: Attempting to update skills for user ${userId} with payload:`, JSON.stringify(apiFormattedSkills, null, 2));
    
    const updatedSkillsData = await usersApi.putUserRoutingskills(userId, apiFormattedSkills);
    
    return (updatedSkillsData.entities || [])
      .filter(skill => skill.id && skill.name && skill.proficiency !== undefined)
      .map(skill => ({
        id: skill.id!,
        name: skill.name!,
        proficiency: skill.proficiency!,
      })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error(`[actions.ts] updateUserSkills: Error updating skills for user ${userId}:`, error.body || error.message, error);
    let details = error.message;
    if (error.body && error.body.message) {
        details = error.body.message;
        if (error.body.details && error.body.details.length > 0 && error.body.details[0]) {
            details += ` (${error.body.details[0].errorMessage || error.body.details[0].errorCode || JSON.stringify(error.body.details[0])})`;
        } else if (error.body.contextId) {
            details += ` (Trace ID: ${error.body.contextId})`;
        }
    } else if ((error as any).response?.data?.message) { 
        details = (error as any).response.data.message;
    }
    throw new Error(`Failed to update skills for user ${userId}. Details: ${details}`);
  }
}

// --- DataTable Management Types and Actions ---

export interface DataTable {
  id: string;
  name: string;
  description?: string;
}

export interface DataTableColumn {
  name: string;
  type: string; 
  isPrimaryKey?: boolean;
}

export interface DataTableSchema {
  properties: Record<string, DataTableColumn>; 
  primaryKey?: string[]; 
}

export interface DataTableRow {
  [key: string]: any; 
}

export interface DataTableDetails extends DataTable {
  schema: DataTableSchema;
  primaryKeyField?: string; 
}

export async function getDataTables(): Promise<DataTable[]> {
  await getAuthenticatedClient();
  const architectApi = new platformClient.ArchitectApi();
  try {
    const result = await architectApi.getFlowsDatatables({ pageSize: 100 });
    return (result.entities || []).map(dt => ({
      id: dt.id!,
      name: dt.name!,
      description: dt.description,
    }));
  } catch (error: any) {
    console.error('[actions.ts] getDataTables: Error fetching DataTables:', error.body || error.message);
    throw new Error(`Failed to fetch DataTables from Genesys Cloud. Details: ${error.body?.message || error.message}`);
  }
}

export async function getDataTableDetails(dataTableId: string): Promise<DataTableDetails> {
  await getAuthenticatedClient();
  const architectApi = new platformClient.ArchitectApi();
  try {
    const dt = await architectApi.getFlowsDatatable(dataTableId, { expand: 'schema' } as any); 
    
    const properties: Record<string, DataTableColumn> = {};
    let determinedPrimaryKeyField: string | undefined = undefined;

    if (dt.schema && typeof dt.schema.key === 'string') {
      const trimmedKey = dt.schema.key.trim();
      if (trimmedKey !== '') {
        determinedPrimaryKeyField = trimmedKey;
        // console.log(`[actions.ts] getDataTableDetails: Determined primary key for ${dataTableId} (name: ${dt.name}): '${determinedPrimaryKeyField}'`); // Debug log removed
      } else {
        console.warn(`[actions.ts] getDataTableDetails: Primary key for DataTable ${dataTableId} (name: ${dt.name}) could not be determined: dt.schema.key is an empty string after trimming. Original API value: '${dt.schema.key}'`);
      }
    } else if (dt.schema) {
      console.warn(`[actions.ts] getDataTableDetails: Primary key for DataTable ${dataTableId} (name: ${dt.name}) could not be determined: dt.schema.key is not a string or not present. Value: '${dt.schema.key}', Type: ${typeof dt.schema.key}`);
    } else {
       console.warn(`[actions.ts] getDataTableDetails: Primary key for DataTable ${dataTableId} (name: ${dt.name}) could not be determined: dt.schema is null or undefined.`);
    }
        
    if (dt.schema?.properties) {
        for (const [colName, colDefinition] of Object.entries(dt.schema.properties as Record<string, {type: string | {type: string}} >)) {
            let columnType = 'string'; 
            if (typeof colDefinition.type === 'string') {
                columnType = colDefinition.type;
            } else if (colDefinition.type && typeof colDefinition.type === 'object' && typeof colDefinition.type.type === 'string') {
                 columnType = colDefinition.type.type; 
            }
            
            const isPK = colName === determinedPrimaryKeyField;

            properties[colName] = {
                name: colName,
                type: columnType,
                isPrimaryKey: isPK,
            };
        }
    }

    return {
      id: dt.id!,
      name: dt.name!,
      description: dt.description,
      schema: { 
        properties,
        primaryKey: determinedPrimaryKeyField ? [determinedPrimaryKeyField] : [],
      },
      primaryKeyField: determinedPrimaryKeyField,
    };
  } catch (error: any) {
    console.error(`[actions.ts] getDataTableDetails: Error fetching DataTable details for ${dataTableId}:`, error.body || error.message);
    throw new Error(`Failed to fetch DataTable details for ${dataTableId}. Details: ${error.body?.message || error.message}`);
  }
}

export async function getDataTableRows(dataTableId: string, showEmptyFields: boolean = true): Promise<DataTableRow[]> {
  await getAuthenticatedClient();
  const architectApi = new platformClient.ArchitectApi();
  try {
    const result = await architectApi.getFlowsDatatableRows(dataTableId, { 
      pageSize: 200, 
      showbrief: !showEmptyFields 
    });
    return result.entities || []; 
  } catch (error: any) {
    console.error(`[actions.ts] getDataTableRows: Error fetching rows for DataTable ${dataTableId}:`, error.body || error.message);
    throw new Error(`Failed to fetch rows for DataTable ${dataTableId}. Details: ${error.body?.message || error.message}`);
  }
}

export async function addDataTableRow(dataTableId: string, rowKey: string, rowData: DataTableRow): Promise<DataTableRow> {
    await getAuthenticatedClient();
    const architectApi = new platformClient.ArchitectApi();
    try {
        // Ensure the rowKey (primary key) is part of the rowData payload if the API expects it at the top level
        // For Genesys Cloud, the key is part of the path, and the body is the rest of the data.
        // However, some APIs might expect the key in the body as well. The SDK usually handles this.
        // The `postFlowsDatatableRows` creates a new row with an auto-generated key OR the key specified in the body IF the datatable allows it.
        // For a PUT-like "add or replace", we'd use `putFlowsDatatableRow` with the key.
        // Here, we are assuming `rowData` includes the primary key field and its value.
        const newRow = await architectApi.postFlowsDatatableRows(dataTableId, rowData); // rowData should contain the PK field and its value
        return newRow as DataTableRow; 
    } catch (error: any) {
        console.error(`[actions.ts] addDataTableRow: Error adding row to DataTable ${dataTableId}:`, error.body || error.message);
        let details = error.body?.message || error.message;
        if (error.body?.details?.[0]?.errorMessage) {
            details += ` (${error.body.details[0].errorMessage})`;
        }
        throw new Error(`Failed to add row to DataTable ${dataTableId}. Details: ${details}`);
    }
}

export async function updateDataTableRow(dataTableId: string, rowId: string, rowData: DataTableRow): Promise<DataTableRow> {
    await getAuthenticatedClient();
    const architectApi = new platformClient.ArchitectApi();
    try {
        const updatedRow = await architectApi.putFlowsDatatableRow(dataTableId, rowId, rowData);
        return updatedRow as DataTableRow;
    } catch (error: any) {
        console.error(`[actions.ts] updateDataTableRow: Error updating row ${rowId} in DataTable ${dataTableId}:`, error.body || error.message);
        let details = error.body?.message || error.message;
        if (error.body?.details?.[0]?.errorMessage) {
            details += ` (${error.body.details[0].errorMessage})`;
        }
        throw new Error(`Failed to update row ${rowId} in DataTable ${dataTableId}. Details: ${details}`);
    }
}

export async function deleteDataTableRow(dataTableId: string, rowId: string): Promise<void> {
    await getAuthenticatedClient();
    const architectApi = new platformClient.ArchitectApi();
    try {
        await architectApi.deleteFlowsDatatableRow(dataTableId, rowId);
    } catch (error: any) {
        console.error(`[actions.ts] deleteDataTableRow: Error deleting row ${rowId} from DataTable ${dataTableId}:`, error.body || error.message);
        throw new Error(`Failed to delete row ${rowId} from DataTable ${dataTableId}. Details: ${error.body?.message || error.message}`);
    }
}


// --- Queue Observation Types and Actions ---
export interface QueueObservationData {
  id: string;
  name: string;
  divisionId: string;
  divisionName: string;
  onQueueUserCount: number;
  interactingCount: number;
  waitingCount: number;
}

export async function getQueueObservations(): Promise<QueueObservationData[]> {
  await getAuthenticatedClient();
  const routingApi = new platformClient.RoutingApi();
  const analyticsApi = new platformClient.AnalyticsApi();

  let activeQueues: { id: string; name: string; divisionId: string; divisionName: string }[] = [];

  try {
    const queueResponse = await routingApi.getRoutingQueues({
      pageSize: 100,
      pageNumber: 1,
      state: 'active', // Fetch only active queues
      expand: ['division'], // Expand to get division info
    });

    if (!queueResponse.entities || queueResponse.entities.length === 0) {
      console.log('[actions.ts] getQueueObservations: No queues found with state "active". This could be due to no queues being configured as active, insufficient permissions to list them, or no queues matching other implicit criteria.');
      return [];
    }

    activeQueues = queueResponse.entities.map(q => ({
      id: q.id!,
      name: q.name!,
      divisionId: q.division?.id || 'N/A',
      divisionName: q.division?.name || 'N/A',
    }));
    console.log(`[actions.ts] getQueueObservations: Found ${activeQueues.length} active queues.`);

  } catch (error: any) {
    console.error('[actions.ts] getQueueObservations: Error fetching active queues:', error.body || error.message, error);
    let detailedErrorMessage = 'An unknown error occurred while fetching active queues.';
    if (error.body && error.body.message) {
      detailedErrorMessage = error.body.message;
      if (error.body.contextId) detailedErrorMessage += ` (Trace ID: ${error.body.contextId})`;
    } else if (error.message) {
      detailedErrorMessage = error.message;
    }
    throw new Error(`Failed to retrieve active queues from Genesys Cloud. Details: ${detailedErrorMessage}.`);
  }

  // Initialize with default values
  const activeQueuesWithDefaults: QueueObservationData[] = activeQueues.map(q => ({
    ...q,
    onQueueUserCount: 0,
    interactingCount: 0,
    waitingCount: 0,
  }));

  if (activeQueues.length === 0) {
    // This case is already handled by the check after fetching queues,
    // but included for completeness if the logic were to change.
    return [];
  }

  const observationQuery = {
    filter: {
      type: 'AND' as const,
      clauses: [
        {
          type: 'OR' as const,
          predicates: activeQueues.map(q => ({
            type: 'dimension' as const,
            dimension: 'queueId' as const,
            operator: 'matches' as const,
            value: q.id,
          })),
        },
      ],
    },
    metrics: ['oOnQueueUsers', 'oInteracting', 'oWaiting'] as platformClient.ગેમૉડ્યૂલ.त्मुख्य.QueueObservationMetric[],
  };

  try {
    const observationResults = await analyticsApi.postAnalyticsQueuesObservationsQuery(observationQuery);
    let mappedCount = 0;

    if (observationResults.results && observationResults.results.length > 0) {
      observationResults.results.forEach(result => {
        const queueId = result.group?.queueId;
        if (queueId) {
          const queueIndex = activeQueuesWithDefaults.findIndex(q => q.id === queueId);
          if (queueIndex !== -1) {
            mappedCount++;
            result.data?.forEach(metricData => {
              const metricName = metricData.metric as (typeof observationQuery.metrics)[number];
              const value = metricData.stats?.count ?? 0;

              switch (metricName) {
                case 'oOnQueueUsers':
                  activeQueuesWithDefaults[queueIndex].onQueueUserCount = value;
                  break;
                case 'oInteracting':
                  activeQueuesWithDefaults[queueIndex].interactingCount = value;
                  break;
                case 'oWaiting':
                  activeQueuesWithDefaults[queueIndex].waitingCount = value;
                  break;
              }
            });
          }
        }
      });
      console.log(`[actions.ts] getQueueObservations: Successfully mapped observation data for ${mappedCount} of ${activeQueues.length} active queues.`);
    } else {
      console.log(`[actions.ts] getQueueObservations: Analytics query returned no observation data for the ${activeQueues.length} active queues. They will be shown with default (0) values.`);
    }
    return activeQueuesWithDefaults;

  } catch (metricsError: any) {
    console.warn(`[actions.ts] getQueueObservations: Error fetching queue observation metrics. Queues will be shown with default (0) values. Details:`, metricsError.body?.message || metricsError.message);
    // Proceed to return activeQueuesWithDefaults, which will have 0 for metrics
    return activeQueuesWithDefaults;
  }
}
