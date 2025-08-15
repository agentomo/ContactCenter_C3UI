
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, LogIn } from 'lucide-react';
import { handleLogin } from '@/app/actions';

export default function LoginPage() {
  const onLoginClick = async () => {
    try {
      const redirectUrl = await handleLogin();
      // Redirect the user to the Genesys Cloud login page
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Login initiation failed:', error);
      // You might want to show a toast notification here
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">CapitalGroup Genesys Configurator</CardTitle>
          <CardDescription>Please log in with your Genesys Cloud account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onLoginClick}>
            <Button type="submit" className="w-full" size="lg">
              <LogIn className="mr-2 h-5 w-5" />
              Login with Genesys
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
