
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SetupPage() {
  // In a real application, these values would be saved to a secure backend
  // or managed via environment variables on the server. This is a mock form for demonstration.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    console.log('Configuration submitted (for demo):', data);
    alert('In a real application, these values would be securely saved on the server. For this demo, please set them as environment variables in your deployment environment.');
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-2xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <Settings className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Application Setup
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-3xl mx-auto">
          Configure your Genesys Cloud credentials to connect the application.
        </p>
      </header>

      <Alert className="max-w-2xl w-full mb-8 border-accent">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-accent">Environment Variables Required</AlertTitle>
        <AlertDescription>
          For this application to function, you must set the following as
          <a href="https://firebase.google.com/docs/app-hosting/configure#set-env-vars" target="_blank" rel="noopener noreferrer" className="underline font-semibold ml-1">
             environment variables
          </a>
           in your Firebase App Hosting backend configuration. This page is a guide to the required values.
        </AlertDescription>
      </Alert>

      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Genesys Cloud OAuth Credentials</CardTitle>
          <CardDescription>
            These credentials are required to communicate with the Genesys Cloud API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="clientId">GENESYS_CLIENT_ID</Label>
              <Input id="clientId" name="clientId" placeholder="Enter your Genesys Cloud Client ID" required />
              <p className="text-xs text-muted-foreground">The Client ID of your OAuth Client in Genesys Cloud.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">GENESYS_CLIENT_SECRET</Label>
              <Input id="clientSecret" name="clientSecret" type="password" placeholder="Enter your Genesys Cloud Client Secret" required />
              <p className="text-xs text-muted-foreground">The Client Secret of your OAuth Client. This is treated as a secret.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">GENESYS_REGION</Label>
              <Input id="region" name="region" placeholder="e.g., us-east-1, mypurecloud.de" required />
              <p className="text-xs text-muted-foreground">The region your Genesys Cloud organization is in (e.g., `us-east-1`).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="redirectUri">GENESYS_REDIRECT_URI</Label>
              <Input id="redirectUri" name="redirectUri" placeholder="Enter your application's redirect URI" required />
              <p className="text-xs text-muted-foreground">
                The redirect URI configured in your Genesys Cloud OAuth client. This should be the full URL to this application's `/login/callback` page.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled>
              Save Configuration (Disabled)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
