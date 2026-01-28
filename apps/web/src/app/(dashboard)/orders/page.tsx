'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime, statusColors } from '@/lib/utils';
import { Search, Package, Truck, CheckCircle, XCircle } from 'lucide-react';

const orderStatuses = ['ALL', 'ONGOING', 'DELIVERED', 'CANCELLED'] as const;

interface Order {
  orderKey: string;
  orderDate: string;
  emNumber?: string;
  orderStatus: string;
  country?: string;
  value?: number;
  trackingNumber?: string;
  rto: boolean;
  customer?: { id: string; name: string; phoneKey: string };
  salesStaff?: { id: string; name: string };
  deliveryStaff?: { id: string; name: string };
  _count?: { orderItems: number };
}

export default function OrdersPage() {
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', status, search, page],
    queryFn: () =>
      api.get<{ data: Order[]; meta: any }>(
        `/orders?status=${status === 'ALL' ? '' : status}&search=${search}&page=${page}&limit=20`
      ),
  });

  const orders = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };

  const getStatusIcon = (orderStatus: string) => {
    switch (orderStatus) {
      case 'ONGOING':
        return <Truck className="h-5 w-5 text-blue-500" />;
      case 'DELIVERED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage order pipeline and deliveries</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by EM number, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {orderStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'ALL' ? 'All Statuses' : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Status Pipeline */}
      <div className="grid grid-cols-3 gap-4">
        {orderStatuses.slice(1).map((s) => {
          const count = orders.filter((o) => o.orderStatus === s).length;
          return (
            <Card
              key={s}
              className={`cursor-pointer transition-colors ${
                status === s ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setStatus(s)}
            >
              <CardContent className="pt-4 pb-4 text-center">
                <div className="flex justify-center mb-2">
                  {getStatusIcon(s)}
                </div>
                <div className={`inline-block rounded-full px-3 py-1 text-sm ${statusColors[s as keyof typeof statusColors] || ''}`}>
                  {s}
                </div>
                <div className="mt-2 text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Orders ({meta.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link key={order.orderKey} href={`/orders/${order.orderKey}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted cursor-pointer">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(order.orderStatus)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            {order.emNumber || order.orderKey}
                          </span>
                          <Badge
                            className={statusColors[order.orderStatus as keyof typeof statusColors] || ''}
                          >
                            {order.orderStatus}
                          </Badge>
                          {order.rto && (
                            <Badge variant="destructive">RTO</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer?.name || 'Unknown Customer'} • {order._count?.orderItems || 0} items
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {order.value ? `AED ${order.value.toFixed(2)}` : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(order.orderDate)}
                      </div>
                      {order.trackingNumber && (
                        <div className="text-xs text-blue-500">
                          #{order.trackingNumber}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm">
                Page {page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
