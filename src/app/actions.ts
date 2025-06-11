'use server';

export interface UserStatus {
  id: string;
  name: string;
  status: 'Available' | 'Busy' | 'Offline' | 'On Queue' | 'Away' | 'Meeting';
}

// Simulate API latency
const MOCK_API_DELAY = 1000;

const initialMockUsers: UserStatus[] = [
  { id: '1', name: 'Alice Wonderland', status: 'Available' },
  { id: '2', name: 'Bob The Builder', status: 'Busy' },
  { id: '3', name: 'Charlie Chaplin', status: 'Offline' },
  { id: '4', name: 'Diana Prince', status: 'On Queue' },
  { id: '5', name: 'Edward Scissorhands', status: 'Away' },
  { id: '6', name: 'Fiona Gallagher', status: 'Meeting' },
  { id: '7', name: 'George Jetson', status: 'Available' },
  { id: '8', name: 'Hannah Montana', status: 'Busy' },
];

export async function getGenesysUsers(): Promise<UserStatus[]> {
  // Simulate API call to Genesys Cloud
  await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY));

  // In a real app, you'd use OAuth client credentials here
  // and make an API request to Genesys Cloud.

  // Simulate potential random changes in status for refresh effect
  const updatedUsers = initialMockUsers.map(user => {
    const statuses: UserStatus['status'][] = ['Available', 'Busy', 'Offline', 'On Queue', 'Away', 'Meeting'];
    // Make "Offline" and "Available" more probable for some users to simulate real-world scenarios
    let randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    if (user.id === '3' && Math.random() < 0.7) randomStatus = 'Offline'; // Charlie often offline
    if (user.id === '1' && Math.random() < 0.6) randomStatus = 'Available'; // Alice often available

    return { ...user, status: randomStatus };
  });

  return updatedUsers;
}
