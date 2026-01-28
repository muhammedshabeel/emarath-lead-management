'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Package, CheckCircle, AlertCircle, MessageSquare, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<any>('/settings/dashboard-stats'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leads?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.leads?.new || 0} new leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leads?.won || 0}</div>
            <p className="text-xs text-muted-foreground">Converted to orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ongoing Orders</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.orders?.ongoing || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.orders?.total || 0} total orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.orders?.delivered || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions by Role */}
      <div className="grid gap-6 md:grid-cols-2">
        {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <a
                href="/leads?status=NEW"
                className="flex items-center rounded-lg border p-4 hover:bg-muted"
              >
                <AlertCircle className="h-5 w-5 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium">New Leads</p>
                  <p className="text-sm text-muted-foreground">Review and assign new leads</p>
                </div>
              </a>
              <a
                href="/inbox"
                className="flex items-center rounded-lg border p-4 hover:bg-muted"
              >
                <MessageSquare className="h-5 w-5 text-green-500 mr-3" />
                <div>
                  <p className="font-medium">WhatsApp Inbox</p>
                  <p className="text-sm text-muted-foreground">Check messages from customers</p>
                </div>
              </a>
            </CardContent>
          </Card>
        )}

        {(user?.role === 'ADMIN' || user?.role === 'CS') && (
          <Card>
            <CardHeader>
              <CardTitle>Customer Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <a
                href="/complaints"
                className="flex items-center rounded-lg border p-4 hover:bg-muted"
              >
                <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                <div>
                  <p className="font-medium">Complaints</p>
                  <p className="text-sm text-muted-foreground">Manage customer complaints</p>
                </div>
              </a>
              <a
                href="/feedback"
                className="flex items-center rounded-lg border p-4 hover:bg-muted"
              >
                <CheckCircle className="h-5 w-5 text-yellow-500 mr-3" />
                <div>
                  <p className="font-medium">Feedback</p>
                  <p className="text-sm text-muted-foreground">View customer feedback</p>
                </div>
              </a>
            </CardContent>
          </Card>
        )}

        {user?.role === 'DELIVERY' && (
          <Card>
            <CardHeader>
              <CardTitle>Delivery Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <a
                href="/delivery"
                className="flex items-center rounded-lg border p-4 hover:bg-muted"
              >
                <Package className="h-5 w-5 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium">My Deliveries</p>
                  <p className="text-sm text-muted-foreground">View assigned deliveries</p>
                </div>
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
