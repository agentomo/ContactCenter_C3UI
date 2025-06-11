
// This file now acts as the entry point for the root path '/'
// and explicitly uses the AppLayout to ensure the sidebar is present.

import AppLayout from './(app)/layout';
import HomePage from './(app)/page'; // This is the Status Board component

export default function RootPage() {
  return (
    <AppLayout>
      <HomePage />
    </AppLayout>
  );
}
