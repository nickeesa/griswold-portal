'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Header account menu (FR-1.6 / AC-10). Wraps the existing logout flow: POST
// /api/logout clears the httpOnly cookie, then back to login. `label` is the
// trigger text; the portal has no server-side user name available without a
// users/me call (deliberately avoided, DD-15), so it defaults to "Account".
export default function UserMenu({ label = 'Account' }: { label?: string }) {
  const router = useRouter();

  async function onLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-hotel-gray-dark hover:text-foreground"
        >
          <User className="h-4 w-4" />
          <span className="text-sm">{label}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Signed in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
