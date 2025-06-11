
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
      console.warn('[actions.ts] getGenesysUsers: No users found or an issue with the API response.');
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
    console.error('[actions.ts] getGenesysUsers: Error fetching or processing Genesys Cloud user data:', error.body || error.message);
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
    const updatedSkillsData = await usersApi.putUserRoutingskills(userId, apiFormattedSkills);
    
    return (updatedSkillsData.entities || [])
      .filter(skill => skill.id && skill.name && skill.proficiency !== undefined)
      .map(skill => ({
        id: skill.id!,
        name: skill.name!,
        proficiency: skill.proficiency!,
      })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
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
    console.error(`[actions.ts] updateUserSkills: Error updating skills for user ${userId}:`, details);
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
  required?: string[]; 
  key?: string; 
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
    const dtSchema = dt.schema as DataTableSchema | undefined; 

    if (dtSchema) {
      // Try to get PK from schema.key
      if (Object.prototype.hasOwnProperty.call(dtSchema, 'key') && typeof dtSchema.key === 'string' && dtSchema.key.trim().length > 0) {
        determinedPrimaryKeyField = dtSchema.key.trim();
        console.log(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - Primary key FOUND via schema.key: '${determinedPrimaryKeyField}'`);
      } else {
        if (Object.prototype.hasOwnProperty.call(dtSchema, 'key')) {
            console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - schema.key is present but invalid (empty or not string). Value: `, dtSchema.key);
        } else {
            console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - schema.key property is MISSING from API response.`);
        }

        // Fallback: if schema.key is not usable, check schema.required (if it's a single string and a valid property)
        if (Array.isArray(dtSchema.required) && 
            dtSchema.required.length === 1 &&
            typeof dtSchema.required[0] === 'string' &&
            dtSchema.required[0].trim().length > 0) {
          
          const potentialPkFromRequired = dtSchema.required[0].trim();
          if (dtSchema.properties && Object.prototype.hasOwnProperty.call(dtSchema.properties, potentialPkFromRequired)) {
            determinedPrimaryKeyField = potentialPkFromRequired;
            console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - Primary key FALLBACK to schema.required (single entry): '${determinedPrimaryKeyField}'. This is a guess; prefer schema.key if available.`);
          } else {
            console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - schema.required contains '${potentialPkFromRequired}', but it's NOT a defined property. Cannot use as PK.`);
          }
        } else {
          if (Object.prototype.hasOwnProperty.call(dtSchema, 'required')) {
            console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - schema.required exists but is not usable for PK fallback (not single entry or not string). Value: `, dtSchema.required);
          } else {
             console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - schema.required property is missing. Cannot use for PK fallback.`);
          }
        }
      }

      if (!determinedPrimaryKeyField) {
        console.error(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - FAILED to determine primary key using schema.key or schema.required fallback. Editing/Creation will be disabled.`);
      }
    } else {
      console.error(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - NO SCHEMA information returned by the API. Cannot determine primary key.`);
    }
        
    if (dtSchema?.properties) {
        for (const [colName, colDefinitionUntyped] of Object.entries(dtSchema.properties)) {
            const colDefinition = colDefinitionUntyped as {type: string | {type: string}}; 
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
        primaryKey: determinedPrimaryKeyField ? [determinedPrimaryKeyField] : [], // Reflects the determined PK
        key: dtSchema?.key, 
        required: dtSchema?.required,
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

export async function addDataTableRow(dataTableId: string, rowData: DataTableRow): Promise<DataTableRow> {
    await getAuthenticatedClient();
    const architectApi = new platformClient.ArchitectApi();
    const dtDetails = await getDataTableDetails(dataTableId); 
    if (!dtDetails.primaryKeyField) {
      throw new Error(`Cannot add row: Primary key for DataTable ${dataTableId} is not defined or could not be determined.`);
    }
    const rowKey = rowData[dtDetails.primaryKeyField];
    if (rowKey === undefined || rowKey === null || String(rowKey).trim() === '') {
        throw new Error(`Cannot add row: Primary key field "${dtDetails.primaryKeyField}" must have a value.`);
    }
    const body = { ...rowData };
    console.log(`[actions.ts] addDataTableRow: Adding row to table ${dataTableId} with key ${String(rowKey)} and data:`, JSON.stringify(body, null, 2));
    try {
        const newRow = await architectApi.postFlowsDatatableRows(dataTableId, body);
        return newRow as DataTableRow; 
    } catch (error: any) {
        console.error(`[actions.ts] addDataTableRow: Error adding row to DataTable ${dataTableId}:`, error.body || error.message);
        let details = error.body?.message || error.message;
        if (error.body?.details?.[0]?.errorMessage) {
            details += ` (${error.body.details[0].errorMessage})`;
        } else if (error.body?.code === 'architect.datatables.key.conflict') {
            details = `A row with the key "${String(rowKey)}" already exists in DataTable ${dtDetails.name}.`;
        }
        throw new Error(`Failed to add row to DataTable ${dtDetails.name}. Details: ${details}`);
    }
}

export async function updateDataTableRow(dataTableId: string, rowId: string, rowData: DataTableRow): Promise<DataTableRow> {
    await getAuthenticatedClient();
    const architectApi = new platformClient.ArchitectApi();
    
    // Experimental: Wrap rowData in an "item" object based on error message
    const body = { item: rowData }; 
    console.log(`[actions.ts] updateDataTableRow: Updating row ${rowId} in table ${dataTableId}. Original rowData:`, JSON.stringify(rowData, null, 2));
    console.log(`[actions.ts] updateDataTableRow: Sending API body:`, JSON.stringify(body, null, 2));

    try {
        const updatedRow = await architectApi.putFlowsDatatableRow(dataTableId, rowId, body);
        return updatedRow as DataTableRow;
    } catch (error: any) {
        console.error(`[actions.ts] updateDataTableRow: Error updating row ${rowId} in DataTable ${dataTableId}:`, error.body || error.message, error);
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

// --- Queue Basic Info Types and Actions ---
export interface QueueBasicData {
  id: string;
  name: string;
  divisionId?: string;
  divisionName?: string;
}

export async function getActiveQueues(): Promise<QueueBasicData[]> {
  await getAuthenticatedClient();
  const routingApi = new platformClient.RoutingApi();

  let activeQueuesEntities: any[] = [];
  try {
    const queuesResponse = await routingApi.getRoutingQueues({
      pageSize: 200,
      pageNumber: 1,
      state: 'active',
      name: '%', 
      expand: ['division'], 
    });
    activeQueuesEntities = queuesResponse.entities || [];
    console.log(`[actions.ts] getActiveQueues: Initial fetch found ${activeQueuesEntities.length} queues from API. Details: ${JSON.stringify(activeQueuesEntities.map(q => ({id: q.id, name: q.name, division: q.division?.name})))}`);

  } catch (error: any) {
    console.error('[actions.ts] getActiveQueues: Error fetching active queues:', error.body || error.message);
    throw new Error(`Failed to retrieve active queues from Genesys Cloud. Details: ${error.body?.message || error.message}.`);
  }

  if (activeQueuesEntities.length === 0) {
    console.warn('[actions.ts] getActiveQueues: No queues found with state "active" (or visible to OAuth client). This could be due to no queues being configured as active, insufficient permissions to list them, or no queues matching other implicit criteria.');
    return [];
  }

  const mappedQueues = activeQueuesEntities.map(q => ({
    id: q.id!,
    name: q.name!,
    divisionId: q.division?.id,
    divisionName: q.division?.name,
  }));
  
  return mappedQueues.sort((a, b) => a.name.localeCompare(b.name));
}
    
