
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
                        asChild={false} // Ensure Button renders as a button, not a Slot here
                      >
                        <a> {/* Inner <a> for legacyBehavior + passHref */}
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
// This local version specifically handles the 'asChild' prop from <Link asChild>.
const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean; tooltip?: any; children: React.ReactNode; }
>(({ children, isActive, tooltip, ...allOtherPropsFromParent }, ref) => {

  // allOtherPropsFromParent includes href, onClick, and asChild (from Link).
  // Destructure 'asChild' out, so it's not passed to the ShadCN Button.
  const { asChild: _asChildFromLink, ...propsToPassToShadCNButton } = allOtherPropsFromParent;
  // Now, propsToPassToShadCNButton contains props like href, onClick, but NOT _asChildFromLink.

  // The 'tooltip' prop is destructured but not actively used by this simplified local component.
  // It's kept for signature consistency with other potential SidebarMenuButton versions.
  // Actual tooltip rendering would require TooltipProvider, Tooltip, TooltipTrigger, TooltipContent.

  return (
    <Button
      ref={ref}
      variant={isActive ? 'secondary' : 'ghost'}
      {...propsToPassToShadCNButton} // Spread props that explicitly exclude 'asChild'
    >
      {children}
    </Button>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";
