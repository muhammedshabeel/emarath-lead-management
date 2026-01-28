'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
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
import { formatDateTime, statusColors, formatPhone } from '@/lib/utils';
import { ArrowLeft, Package, User, MapPin, Truck } from 'lucide-react';
import { useState } from 'react';

interface Order {
  orderKey: string;
  orderDate: string;
  emNumber?: string;
  orderStatus: string;
  country?: string;
  value?: number;
  trackingNumber?: string;
  rto: boolean;
  cancellationReason?: string;
  paymentMethod?: string;
  notes?: string;
  customer?: { id: string; name: string; phoneKey: string; city?: string; address1?: string };
  salesStaff?: { id: string; name: string };
  deliveryStaff?: { id: string; name: string };
  sourceLead?: { id: string; status: string };
  orderItems: Array<{
    id: string;
    productCode: string;
    quantity: number;
    lineValue?: number;
    product?: { productName: string };
  }>;
}

export default function OrderDetailPage() {
  const { orderKey } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderKey],
    queryFn: () => api.get<Order>(`/orders/${orderKey}`),
  });

  const updateOrder = useMutation({
    mutationFn: (data: any) => api.put(`/orders/${orderKey}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', orderKey] }),
    onError: (err: any) => alert(err.message || 'Update failed'),
  });

  if (isLoading || !order) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              Order {order.emNumber || order.orderKey}
            </h1>
            <p className="text-muted-foreground">
              {formatDateTime(order.orderDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={statusColors[order.orderStatus as keyof typeof statusColors] || ''}>
            {order.orderStatus}
          </Badge>
          {order.rto && <Badge variant="destructive">RTO</Badge>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Order Items ({order.orderItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {item.product?.productName || item.productCode}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Code: {item.productCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">Qty: {item.quantity}</p>
                      {item.lineValue && (
                        <p className="text-sm text-muted-foreground">
                          AED {item.lineValue.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between">
                <span className="font-medium">Total Value</span>
                <span className="font-bold text-lg">
                  AED {order.value?.toFixed(2) || '0.00'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Status Update */}
          <Card>
            <CardHeader>
              <CardTitle>Update Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={order.orderStatus}
                  onValueChange={(value) => {
                    if (value === 'CANCELLED' && !cancellationReason) {
                      alert('Please enter a cancellation reason');
                      return;
                    }
                    updateOrder.mutate({
                      orderStatus: value,
                      cancellationReason: value === 'CANCELLED' ? cancellationReason : undefined,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONGOING">Ongoing</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {order.orderStatus !== 'CANCELLED' && (
                <div>
                  <label className="text-sm font-medium">Cancellation Reason (if cancelling)</label>
                  <Input
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Required if cancelling..."
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Tracking Number</label>
                <div className="flex space-x-2">
                  <Input
                    value={trackingNumber || order.trackingNumber || ''}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                  />
                  <Button
                    onClick={() => updateOrder.mutate({ trackingNumber })}
                    disabled={updateOrder.isPending}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rto"
                  checked={order.rto}
                  onChange={(e) => updateOrder.mutate({ rto: e.target.checked })}
                />
                <label htmlFor="rto" className="text-sm font-medium">
                  Mark as RTO (Return to Origin)
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Customer & Staff Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{order.customer?.name || 'Unknown'}</p>
              <p>{formatPhone(order.customer?.phoneKey || '')}</p>
              {order.customer?.address1 && <p>{order.customer.address1}</p>}
              {order.customer?.city && <p>{order.customer.city}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="mr-2 h-5 w-5" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sales:</span>
                <span>{order.salesStaff?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery:</span>
                <span>{order.deliveryStaff?.name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment:</span>
                <span>{order.paymentMethod || '-'}</span>
              </div>
            </CardContent>
          </Card>

          {order.sourceLead && (
            <Card>
              <CardHeader>
                <CardTitle>Source Lead</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/leads/${order.sourceLead!.id}`)}
                >
                  View Lead
                </Button>
              </CardContent>
            </Card>
          )}

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {order.cancellationReason && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Cancellation Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.cancellationReason}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
