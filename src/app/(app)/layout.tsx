
'use client';

import type { ReactNode } from 'react';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTodo, Users, Menu, Database } from 'lucide-react'; // Added Database icon

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/', label: 'Status Board', icon: LayoutDashboard },
  { href: '/skills', label: 'Skills Management', icon: ListTodo },
  { href: '/datatables', label: 'DataTables', icon: Database },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2" onClick={() => setIsSheetOpen(false)}>
            <Users className="h-7 w-7 text-primary" />
            <h2 className="text-lg font-semibold">
              CapitalGroup Genesys Configurator
            </h2>
          </Link>

          {/* Mobile Menu */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[340px]">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                   <Users className="h-6 w-6 text-primary" /> CapitalGroup Genesys Configurator
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link href={item.href} legacyBehavior passHref>
                      <Button
                        variant={pathname === item.href ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-2"
                        onClick={() => setIsSheetOpen(false)}
                        asChild={false}
                      >
                        <a>
                          <item.icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </a>
                      </Button>
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} asChild>
                <SidebarMenuButton 
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label, side: 'bottom', align: 'center' }}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            ))}
          </nav>

        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}

// Dummy SidebarMenuButton component used for desktop navigation items.
const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean; tooltip?: any; children: React.ReactNode; }
>(({ children, isActive, tooltip, ...props }, ref) => {
  // Destructure asChild from props and don't pass it to the Button component
  // to prevent the "React does not recognize the `asChild` prop on a DOM element" warning.
  const { asChild, ...restProps } = props; 
  
  // The Tooltip component is not used here for simplicity in the dummy component,
  // but in a real scenario, you might want to wrap the Button with Tooltip logic
  // similar to how it's done in the actual SidebarMenuButton from @/components/ui/sidebar.
  // For now, we ignore the tooltip prop for this dummy version.
  
  return (
    <Button ref={ref} variant={isActive ? 'secondary' : 'ghost'} {...restProps}>
      {children}
    </Button>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";
