'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Users,
  Package,
  MessageSquare,
  Truck,
  AlertTriangle,
  Settings,
  LogOut,
  LayoutDashboard,
  Star,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'AGENT', 'CS', 'DELIVERY'] },
  { name: 'Leads', href: '/leads', icon: Users, roles: ['ADMIN', 'AGENT'] },
  { name: 'Inbox', href: '/inbox', icon: MessageSquare, roles: ['ADMIN', 'AGENT'] },
  { name: 'Orders', href: '/orders', icon: Package, roles: ['ADMIN', 'AGENT', 'CS', 'DELIVERY'] },
  { name: 'Delivery', href: '/delivery', icon: Truck, roles: ['ADMIN', 'DELIVERY'] },
  { name: 'Complaints', href: '/complaints', icon: AlertTriangle, roles: ['ADMIN', 'CS'] },
  { name: 'Feedback', href: '/feedback', icon: Star, roles: ['ADMIN', 'CS'] },
  { name: 'Staff', href: '/staff', icon: Users, roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const filteredNav = navigation.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-gray-900 text-white transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {sidebarOpen && <span className="text-xl font-bold">Emarath</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-gray-800"
          >
            <ChevronDown
              className={cn(
                'h-5 w-5 transition-transform',
                !sidebarOpen && '-rotate-90'
              )}
            />
          </Button>
        </div>

        <nav className="mt-4 space-y-1 px-2">
          {filteredNav.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {sidebarOpen && item.name}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4">
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="mr-3 h-5 w-5" />
            {sidebarOpen && 'Sign out'}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="text-lg font-semibold">
            Welcome, {user.name}
          </div>
          <div className="flex items-center space-x-4">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              {user.role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
