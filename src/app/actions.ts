
'use server';

import platformClient from 'purecloud-platform-client-v2';
import type { ApiClient } from 'purecloud-platform-client-v2';


export interface UserStatus {
  id: string;
  name: string;
  status: 'Available' | 'Busy' | 'Offline' | 'On Queue' | 'Away' | 'Meeting';
  divisionId: string;
  divisionName: string;
  email?: string;
  department?: string;
  title?: string;
  extension?: string;
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
  division?: { id:string; name: string; };
  email?: string;
  department?: string;
  title?: string;
  primaryContactInfo?: { address: string; mediaType: string; type: string; extension?: string; display?: string }[];
  version?: number; // Add version for updates
}

async function getAuthenticatedClient(): Promise<ApiClient> {
  const clientId = process.env.GENESYS_CLIENT_ID;
  const clientSecret = process.env.GENESYS_CLIENT_SECRET;
  const region = process.env.GENESYS_REGION;

  if (!clientId || !clientSecret || !region) {
    console.error('[actions.ts] getAuthenticatedClient: Genesys Cloud API credentials or region not configured in the deployment environment.');
    throw new Error('Genesys Cloud API credentials or region not configured. Ensure GENESYS_CLIENT_ID, GENESYS_CLIENT_SECRET, and GENESYS_REGION are correctly set as environment variables in your deployment environment (e.g., Firebase App Hosting).');
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
      expand: ['presence', 'division', 'primaryContactInfo'],
    });

    if (!userResponse.entities || userResponse.entities.length === 0) {
      console.warn('[actions.ts] getGenesysUsers: No users found or an issue with the API response.');
      return [];
    }

    const mappedUsers = (userResponse.entities as GenesysUser[]).map((user) => {
      let extension: string | undefined = undefined;
      if (user.primaryContactInfo) {
        const primaryPhoneContact = user.primaryContactInfo.find(
          (contact) => contact.mediaType === 'PHONE' && contact.type === 'PRIMARY' && contact.extension
        );
        if (primaryPhoneContact) {
          extension = primaryPhoneContact.extension;
        } else {
          const anyPhoneContactWithExt = user.primaryContactInfo.find(
            (contact) => contact.mediaType === 'PHONE' && contact.extension
          );
          if (anyPhoneContactWithExt) {
            extension = anyPhoneContactWithExt.extension;
          }
        }
      }

      return {
        id: user.id,
        name: user.name || 'Unknown User',
        status: mapGenesysToUserStatus(user.presence?.presenceDefinition?.systemPresence),
        divisionId: user.division?.id || 'N/A',
        divisionName: user.division?.name || 'N/A',
        email: user.email,
        department: user.department,
        title: user.title,
        extension: extension,
      };
    });

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

export interface Division {
  id: string;
  name: string;
}

export async function getAllDivisions(): Promise<Division[]> {
  await getAuthenticatedClient();
  const authorizationApi = new platformClient.AuthorizationApi();
  try {
    // Note: This fetches all divisions the client has permission to see.
    // For very large orgs, pagination would be needed here.
    const result = await authorizationApi.getAuthorizationDivisions({ pageSize: 200 });
    return (result.entities || [])
      .map(div => ({ id: div.id!, name: div.name! }))
      .sort((a,b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error('[actions.ts] getAllDivisions: Error fetching divisions:', error.body || error.message);
    throw new Error(`Failed to fetch divisions from Genesys Cloud. Details: ${error.body?.message || error.message}. Ensure OAuth client has 'directory:division:view' permission.`);
  }
}

export async function updateUserDivision(userId: string, divisionId: string): Promise<UserStatus> {
  await getAuthenticatedClient();
  const usersApi = new platformClient.UsersApi();
  try {
    // First, get the current user object to get their version number
    const currentUser = await usersApi.getUser(userId) as GenesysUser;
    if (currentUser.version === undefined) {
      throw new Error(`Could not retrieve user version for user ID ${userId}. Update failed.`);
    }

    const updateBody = {
      divisionId: divisionId,
      version: currentUser.version
    };

    console.log(`[actions.ts] updateUserDivision: Patching user ${userId} with body:`, JSON.stringify(updateBody, null, 2));

    const updatedUser = await usersApi.patchUser(userId, updateBody);

    // Return a mapped UserStatus object
    return {
      id: updatedUser.id!,
      name: updatedUser.name!,
      status: mapGenesysToUserStatus(updatedUser.presence?.presenceDefinition?.systemPresence),
      divisionId: updatedUser.division?.id || 'N/A',
      divisionName: updatedUser.division?.name || 'N/A',
    };

  } catch (error: any) {
    let details = error.message;
    if (error.body && error.body.message) {
        details = error.body.message;
        if (error.body.contextId) {
            details += ` (Trace ID: ${error.body.contextId})`;
        }
    }
    console.error(`[actions.ts] updateUserDivision: Error updating division for user ${userId}:`, details);
    throw new Error(`Failed to update division for user. Details: ${details}. Ensure the OAuth client has 'directory:user:edit' permission.`);
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
  } catch (error: any)
{
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
      if (Object.prototype.hasOwnProperty.call(dtSchema, 'key') && typeof dtSchema.key === 'string' && dtSchema.key.trim().length > 0) {
        determinedPrimaryKeyField = dtSchema.key.trim();
        console.log(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - Primary key FOUND via schema.key: '${determinedPrimaryKeyField}'`);
      } else {
        if (Object.prototype.hasOwnProperty.call(dtSchema, 'key')) {
            console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - schema.key is present but invalid (empty or not string). Value: `, dtSchema.key);
        } else {
            console.warn(`[actions.ts] getDataTableDetails: DataTable ${dataTableId} - schema.key property is MISSING from API response.`);
        }

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
        primaryKey: determinedPrimaryKeyField ? [determinedPrimaryKeyField] : [],
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

    const bodyForApi = JSON.parse(JSON.stringify(rowData));

    console.log(`[actions.ts] updateDataTableRow: Updating row ${rowId} in table ${dataTableId}. Received rowData:`, JSON.stringify(rowData, null, 2));
    console.log(`[actions.ts] updateDataTableRow: Sending API body (direct rowData):`, JSON.stringify(bodyForApi, null, 2));

    try {
        const updatedRow = await architectApi.putFlowsDatatableRow(dataTableId, rowId, bodyForApi);
        return updatedRow as DataTableRow;
    } catch (error: any) {
        console.error(`[actions.ts] updateDataTableRow: Error updating row ${rowId} in DataTable ${dataTableId}:`, error.body || error.message, error);
        let details = error.body?.message || error.message;
        if (error.body?.details?.[0]?.errorMessage) {
            details += ` (${error.body.details[0].errorMessage})`;
        } else if (error.body?.code === 'flows.datatables.syntax.error' && error.status === 400) {
            details = `Syntax error with the provided data. The API rejected the row item. (Original msg: ${error.body?.message || 'N/A'})`;
        }
        throw new Error(`Failed to update row ${rowId} in DataTable ${dataTableId}. Details: ${details}`);
    }
}

export async function deleteDataTableRow(dataTableId: string, rowId: string): Promise<void> {
    await getAuthenticatedClient();
    const architectApi = new platformClient.ArchitectApi();
    console.log(`[actions.ts] deleteDataTableRow: Deleting row ${rowId} from table ${dataTableId}.`);
    try {
        await architectApi.deleteFlowsDatatableRow(dataTableId, rowId);
    } catch (error: any) {
        console.error(`[actions.ts] deleteDataTableRow: Error deleting row ${rowId} from DataTable ${dataTableId}:`, error.body || error.message);
        throw new Error(`Failed to delete row ${rowId} from DataTable. Details: ${error.body?.message || error.message}`);
    }
}

// --- Queue Basic Info Types and Actions ---
export interface QueueBasicData {
  id: string;
  name: string;
  divisionId?: string;
  divisionName?: string;
  // Metrics
  interactionsWaiting?: number;
  interactionsActive?: number;
  availableMembers?: number;
}

export async function getActiveQueues(): Promise<QueueBasicData[]> {
  const apiClient = await getAuthenticatedClient();
  const routingApi = new platformClient.RoutingApi(apiClient);
  const analyticsApi = new platformClient.AnalyticsApi(apiClient);

  const apiOptions = {};
  console.log('[actions.ts] getActiveQueues: API call parameters for routing/queues:', JSON.stringify(apiOptions, null, 2));

  let basicQueues: any[] = [];
  try {
    const queuesResponse = await routingApi.getRoutingQueues(apiOptions);
    basicQueues = queuesResponse.entities || [];
    console.log(`[actions.ts] getActiveQueues: Initial fetch found ${basicQueues.length} queues from API.`);
  } catch (error: any) {
    console.error('[actions.ts] getActiveQueues: Error fetching basic queue list:', error.body || error.message);
    throw new Error(`Failed to retrieve basic queue list from Genesys Cloud. Details: ${error.body?.message || error.message}.`);
  }

  if (basicQueues.length === 0) {
    console.warn('[actions.ts] getActiveQueues: No queues found. Returning empty array.');
    return [];
  }

  let mappedQueues: QueueBasicData[] = basicQueues.map(q => ({
    id: q.id!,
    name: q.name!,
    divisionId: q.division?.id,
    divisionName: q.division?.name,
    interactionsWaiting: undefined,
    interactionsActive: undefined,
    availableMembers: undefined,
  }));

  const queueIds = mappedQueues.map(q => q.id);
  if (queueIds.length > 0) {
    try {
      const observationQuery = {
        filter: {
          type: "or",
          clauses: queueIds.map(id => ({
            type: "dimension",
            dimension: "queueId",
            operator: "matches",
            value: id,
          }))
        } as platformClient.Models.QueueObservationQueryFilter,
        metrics: ["oWaiting", "oInteracting", "oAvailableUsers"]
      };

      console.log('[actions.ts] getActiveQueues: Analytics observation query body:', JSON.stringify(observationQuery, null, 2));

      const observationResponse = await analyticsApi.postAnalyticsQueuesObservationsQuery(observationQuery as any);

      if (observationResponse.results) {
        const metricsMap = new Map<string, Partial<QueueBasicData>>();
        observationResponse.results.forEach(result => {
          const queueId = result.group?.['queueId'];
          if (queueId && result.data) {
            const queueMetrics: Partial<QueueBasicData> = {};
            result.data.forEach(metricPoint => {
              if (metricPoint.metric === 'oWaiting') {
                queueMetrics.interactionsWaiting = metricPoint.stats?.count ?? 0;
              } else if (metricPoint.metric === 'oInteracting') {
                queueMetrics.interactionsActive = metricPoint.stats?.count ?? 0;
              } else if (metricPoint.metric === 'oAvailableUsers') {
                queueMetrics.availableMembers = metricPoint.stats?.count ?? 0;
              }
            });
            metricsMap.set(queueId, queueMetrics);
          }
        });

        mappedQueues = mappedQueues.map(queue => ({
          ...queue,
          ...(metricsMap.get(queue.id) || {}),
        }));
      }
    } catch (error: any) {
      console.error('[actions.ts] getActiveQueues: Error fetching queue observation data:', error.body || error.message, error);
      // We don't throw here, so the page can still load basic queue info even if metrics fail.
    }
  }

  return mappedQueues.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Telephony Infrastructure Health Types and Actions ---
export type EdgeOperationalStatus = 'Online' | 'Offline' | 'Degraded' | 'Unknown';

export interface EdgeBasic {
  id: string;
  name: string;
  description?: string;
  status: EdgeOperationalStatus;
  edgeGroup?: { id: string; name: string };
  apiVersion?: string;
  make?: string;
  model?: string;
}

function mapEdgeApiStatus(
  apiState: string | undefined,
  apiOnlineStatus: string | undefined
): EdgeOperationalStatus {
  const state = apiState?.toUpperCase();
  const onlineStatus = apiOnlineStatus?.toUpperCase();

  if (state === 'ACTIVE') {
    if (onlineStatus === 'ONLINE') return 'Online';
    if (onlineStatus === 'DEGRADED') return 'Degraded';
    if (onlineStatus === 'OFFLINE') return 'Offline';
  }
  if (state === 'INACTIVE') return 'Offline';
  // For 'DELETED' state, they will be filtered out, but if they weren't:
  // if (state === 'DELETED') return 'Offline'; 

  console.warn(`[actions.ts] mapEdgeApiStatus: Unknown Edge state/onlineStatus combination: state=${apiState}, onlineStatus=${apiOnlineStatus}`);
  return 'Unknown';
}

export async function getEdgesBasicInfo(): Promise<EdgeBasic[]> {
  await getAuthenticatedClient();
  const telephonyApi = new platformClient.TelephonyProvidersEdgeApi();

  try {
    const edgesResponse = await telephonyApi.getTelephonyProvidersEdges({
      pageSize: 100, 
    });

    if (!edgesResponse.entities || edgesResponse.entities.length === 0) {
      console.warn('[actions.ts] getEdgesBasicInfo: No Edges found or API returned empty list.');
      return [];
    }
    
    const mappedEdges = edgesResponse.entities
      .filter(edge => edge.state?.toUpperCase() !== 'DELETED') 
      .map(edge => ({
        id: edge.id!,
        name: edge.name!,
        description: edge.description,
        status: mapEdgeApiStatus(edge.state, edge.onlineStatus),
        edgeGroup: edge.edgeGroup ? { id: edge.edgeGroup.id!, name: edge.edgeGroup.name! } : undefined,
        apiVersion: edge.apiVersion,
        make: edge.make,
        model: edge.model,
      }));

    return mappedEdges.sort((a,b) => a.name.localeCompare(b.name));

  } catch (error: any) {
    console.error('[actions.ts] getEdgesBasicInfo: Error fetching Genesys Cloud Edges:', error.body || error.message);
    let detailedErrorMessage = 'An unknown error occurred while fetching Edge data.';
     if (error.body && error.body.message) {
        detailedErrorMessage = error.body.message;
        if (error.body.contextId) detailedErrorMessage += ` (Trace ID: ${error.body.contextId})`;
    } else if (error.message) {
        detailedErrorMessage = error.message;
    }
    throw new Error(`Failed to retrieve Edge information from Genesys Cloud. Details: ${detailedErrorMessage}. Check server logs and ensure the OAuth client has 'telephony:providers:edge:view' permission.`);
  }
}

// --- Edge Details ---
export interface ProcessedEdgeMetrics {
  latestCpuUsage?: { value: number; timestamp: string };
  latestMemoryUsage?: { value: number; timestamp: string };
  latestNetworkRtt?: { value: number; timestamp: string; qualifier?: string };
}

export interface EdgeDetail extends EdgeBasic {
  processors?: { activeCoreCount?: number; type?: string; }[];
  memory?: { type?: string; totalMemoryBytes?: number; }[];
  site?: { id: string; name: string; };
  processedMetrics?: ProcessedEdgeMetrics;
}


interface RawMetricPoint {
  metric?: string;
  timestamp?: string; 
  value?: number;
  qualifier?: string;
}

export async function getEdgeDetails(edgeId: string): Promise<EdgeDetail> {
  await getAuthenticatedClient();
  const telephonyApi = new platformClient.TelephonyProvidersEdgeApi();

  try {
    const edgeDataPromise = telephonyApi.getTelephonyProvidersEdge(edgeId, {expand: ['site']});
    const metricsDataPromise = telephonyApi.getTelephonyProvidersEdgeMetrics(edgeId);

    const [edgeData, metricsResponse] = await Promise.all([edgeDataPromise, metricsDataPromise]);

    const processedMetrics: ProcessedEdgeMetrics = {};
    const rawMetrics: RawMetricPoint[] = metricsResponse.metrics || [];

    const findLatestMetric = (metricName: string): RawMetricPoint | undefined => {
      return rawMetrics
        .filter(m => m.metric === metricName && m.timestamp && m.value !== undefined)
        .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())[0];
    };
    
    const latestCpu = findLatestMetric('edge.cpu.usage');
    if (latestCpu) {
      processedMetrics.latestCpuUsage = { value: latestCpu.value!, timestamp: latestCpu.timestamp! };
    }

    const latestMemory = findLatestMetric('edge.memory.usage');
    if (latestMemory) {
      processedMetrics.latestMemoryUsage = { value: latestMemory.value!, timestamp: latestMemory.timestamp! };
    }
    
    const latestRtt = findLatestMetric('edge.network.rtt'); 
    if (latestRtt) {
      processedMetrics.latestNetworkRtt = { value: latestRtt.value!, timestamp: latestRtt.timestamp!, qualifier: latestRtt.qualifier };
    }

    return {
      id: edgeData.id!,
      name: edgeData.name!,
      description: edgeData.description,
      status: mapEdgeApiStatus(edgeData.state, edgeData.onlineStatus),
      edgeGroup: edgeData.edgeGroup ? { id: edgeData.edgeGroup.id!, name: edgeData.edgeGroup.name! } : undefined,
      apiVersion: edgeData.apiVersion,
      make: edgeData.make,
      model: edgeData.model,
      processors: edgeData.processors as EdgeDetail['processors'],
      memory: edgeData.memory as EdgeDetail['memory'],
      site: edgeData.site ? { id: edgeData.site.id!, name: edgeData.site.name! } : undefined,
      processedMetrics: processedMetrics,
    };

  } catch (error: any) {
    console.error(`[actions.ts] getEdgeDetails: Error fetching details for Edge ${edgeId}:`, error.body || error.message);
    let detailedErrorMessage = `An unknown error occurred while fetching details for Edge ${edgeId}.`;
     if (error.body && error.body.message) {
        detailedErrorMessage = error.body.message;
        if (error.body.contextId) detailedErrorMessage += ` (Trace ID: ${error.body.contextId})`;
    } else if (error.message) {
        detailedErrorMessage = error.message;
    }
    throw new Error(`Failed to retrieve details for Edge ${edgeId} from Genesys Cloud. Details: ${detailedErrorMessage}.`);
  }
}

// --- Audit Trail Viewer Types and Actions ---
export interface AuditLogQueryFilters {
  interval: string; 
  serviceName?: string;
  userId?: string; 
  action?: string; 
  entityType?: string; 
  queryPhrase?: string; 
  pageNumber?: number;
  pageSize?: number;
}

export interface AuditLogUser {
  id?: string;
  name?: string;
}

export interface AuditLogEntity {
  id?: string;
  name?: string;
  type?: string;
  selfUri?: string;
}

export interface AuditLogChange {
  property?: string;
  entity?: AuditLogEntity;
  oldValues?: string[];
  newValues?: string[];
}

export interface AuditLogEntry {
  id: string;
  userHomeOrgId?: string;
  user?: AuditLogUser;
  client?: { id: string, type: string };
  remoteIp?: string[];
  serviceName: string;
  eventDate: string; 
  message?: { message: string, messageWithParams: string, messageParams: Record<string, any> };
  action?: string;
  entity?: AuditLogEntity;
  entityType?: string;
  status?: string; 
  application?: string;
  initiatingAction?: { id: string, transactionId: string };
  transactionInitiator?: boolean;
  propertyChanges?: AuditLogChange[];
  context?: Record<string, string>;
  changes?: AuditLogChange[]; 
}

export interface AuditQueryExecutionResults {
  id?: string;
  cursor?: string;
  entities?: AuditLogEntry[];
}


export async function queryAuditLogs(filters: AuditLogQueryFilters): Promise<AuditLogEntry[]> {
  await getAuthenticatedClient();
  const auditApi = new platformClient.AuditApi();

  const queryBody: platformClient.Models.AuditQueryRequest = {
    interval: filters.interval,
    serviceName: filters.serviceName,
    filters: [],
    sort: [{ name: 'Timestamp', sortOrder: 'DESC' }], 
    pageNumber: filters.pageNumber || 1,
    pageSize: filters.pageSize || 25,
  };

  if (filters.userId) {
    queryBody.filters!.push({
      type: 'User',
      clauses: [{
        type: 'Value',
        predicates: [{
          type: 'Dimension',
          dimension: 'userId',
          operator: 'Matches',
          value: filters.userId,
        }]
      }]
    });
  }
  if (filters.action) {
    queryBody.filters!.push({
      type: 'Value',
      predicates: [{
        type: 'Dimension',
        dimension: 'action',
        operator: 'Matches',
        value: filters.action,
      }]
    });
  }
  if (filters.entityType) {
    queryBody.filters!.push({
      type: 'Value',
      predicates: [{
        type: 'Dimension',
        dimension: 'entityType',
        operator: 'Matches',
        value: filters.entityType,
      }]
    });
  }
  if (filters.queryPhrase) {
    console.warn('[actions.ts] queryAuditLogs: General queryPhrase filtering is not directly implemented in this basic version. Use specific filters.');
  }

  try {
    console.log('[actions.ts] queryAuditLogs: Sending audit query:', JSON.stringify(queryBody, null, 2));
    const result: AuditQueryExecutionResults = await auditApi.postAuditsQuery(queryBody);
    console.log('[actions.ts] queryAuditLogs: Received audit query results:', result.entities?.length);
    return result.entities || [];
  } catch (error: any) {
    console.error('[actions.ts] queryAuditLogs: Error querying audit logs:', error.body || error.message);
    let detailedErrorMessage = 'An unknown error occurred while querying audit logs.';
    if (error.body && error.body.message) {
        detailedErrorMessage = error.body.message;
        if (error.body.contextId) detailedErrorMessage += ` (Trace ID: ${error.body.contextId})`;
    } else if (error.message) {
        detailedErrorMessage = error.message;
    }
    throw new Error(`Failed to query audit logs from Genesys Cloud. Details: ${detailedErrorMessage}. Ensure the OAuth client has 'audit:log:view' permission.`);
  }
}

// --- Conversation Diagnostics Types and Actions ---
export interface ConversationSearchFilters {
  interval: string; // ISO-8601 format, e.g., "2023-01-01T00:00:00Z/2023-01-02T00:00:00Z"
  conversationId?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface ConversationParticipantSummary {
  participantId: string;
  participantName?: string;
  purpose?: string; 
  mediaType?: string; 
}
export interface ConversationSearchResult {
  conversationId: string;
  conversationStart: string; // ISO-8601
  conversationEnd?: string; // ISO-8601
  durationMillis?: number;
  participants: ConversationParticipantSummary[];
  primaryMediaType?: string; // Derived: e.g., 'voice', 'chat'
  divisionIds?: string[];
}

// Internal type mirroring parts of the SDK's request for POST /api/v2/analytics/conversations/details/query
interface ConversationDetailQueryRequest {
  interval: string;
  conversationFilters?: Array<{
    type: 'and' | 'or';
    predicates: Array<{
      type: 'dimension';
      dimension: 'conversationId';
      operator: 'matches';
      value: string;
    }>;
  }>;
  order?: 'asc' | 'desc';
  orderBy?: 'conversationStart' | 'conversationEnd';
  paging: {
    pageSize: number;
    pageNumber: number;
  };
}

// Internal type mirroring parts of the SDK's AnalyticsConversation
interface AnalyticsConversation {
  conversationId?: string;
  conversationStart?: string;
  conversationEnd?: string;
  divisionIds?: string[];
  participants?: Array<{
    participantId?: string;
    participantName?: string;
    purpose?: string;
    sessions?: Array<{
      mediaType?: string;
      sessionId?: string;
      segments?: Array<{
        segmentStart?: string;
        segmentEnd?: string;
        segmentType?: string;
      }>;
      // ... other session properties
    }>;
    // ... other participant properties
  }>;
  // ... other conversation properties
}

interface ConversationQueryExecutionResults {
  conversations?: AnalyticsConversation[];
  // aggregations, cursor, etc.
}

export async function searchConversations(filters: ConversationSearchFilters): Promise<ConversationSearchResult[]> {
  await getAuthenticatedClient();
  const analyticsApi = new platformClient.AnalyticsApi();

  const queryBody: ConversationDetailQueryRequest = {
    interval: filters.interval,
    orderBy: 'conversationStart',
    order: 'desc',
    paging: {
      pageNumber: filters.pageNumber || 1,
      pageSize: filters.pageSize || 25,
    },
  };

  if (filters.conversationId) {
    queryBody.conversationFilters = [{
      type: 'and',
      predicates: [{
        type: 'dimension',
        dimension: 'conversationId',
        operator: 'matches',
        value: filters.conversationId,
      }],
    }];
  }

  try {
    console.log('[actions.ts] searchConversations: Sending conversation query:', JSON.stringify(queryBody, null, 2));
    const result: ConversationQueryExecutionResults = await analyticsApi.postAnalyticsConversationsDetailsQuery(queryBody as any);
    console.log('[actions.ts] searchConversations: Received conversation query results:', result.conversations?.length);

    return (result.conversations || []).map(conv => {
      let durationMillis: number | undefined = undefined;
      if (conv.conversationStart && conv.conversationEnd) {
        durationMillis = new Date(conv.conversationEnd).getTime() - new Date(conv.conversationStart).getTime();
      }
      
      const participants: ConversationParticipantSummary[] = (conv.participants || []).map(p => ({
          participantId: p.participantId!,
          participantName: p.participantName,
          purpose: p.purpose,
          mediaType: p.sessions?.[0]?.mediaType,
      }));

      // Try to determine a primary media type for the conversation
      let primaryMediaType: string | undefined;
      if (participants.length > 0 && participants[0].mediaType) {
        primaryMediaType = participants[0].mediaType;
      } else if (conv.participants && conv.participants.length > 0) {
         // Fallback if first participant summary didn't have it, check raw data
        primaryMediaType = conv.participants[0].sessions?.[0]?.mediaType;
      }


      return {
        conversationId: conv.conversationId!,
        conversationStart: conv.conversationStart!,
        conversationEnd: conv.conversationEnd,
        durationMillis,
        participants,
        primaryMediaType,
        divisionIds: conv.divisionIds,
      };
    });

  } catch (error: any) {
    console.error('[actions.ts] searchConversations: Error querying conversations:', error.body || error.message);
    let detailedErrorMessage = 'An unknown error occurred while querying conversations.';
    if (error.body && error.body.message) {
        detailedErrorMessage = error.body.message;
        if (error.body.contextId) detailedErrorMessage += ` (Trace ID: ${error.body.contextId})`;
    } else if (error.message) {
        detailedErrorMessage = error.message;
    }
    throw new Error(`Failed to query conversations from Genesys Cloud. Details: ${detailedErrorMessage}. Ensure the OAuth client has 'analytics:conversationDetail:view' permission.`);
  }
}
    
// Placeholder for future getConversationDetails action
// export async function getConversationDetails(conversationId: string): Promise<any> {
//   // To be implemented: GET /api/v2/conversations/{conversationId}
//   // Requires 'conversation:conversation:view' permission
// }
