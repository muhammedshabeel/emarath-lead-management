'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import { Truck, CheckCircle, Package } from 'lucide-react';

interface DeliveryFollowup {
  id: string;
  orderId: string;
  salesInstructions?: string;
  csUpdate?: string;
  deliveredCancelledDate?: string;
  deliveryStaff?: { id: string; name: string };
  salesStaff?: { id: string; name: string };
  order?: {
    orderKey: string;
    emNumber?: string;
    orderStatus: string;
    customer?: { name: string; phoneKey: string };
  };
}

export default function DeliveryPage() {
  const queryClient = useQueryClient();
  const [selectedFollowup, setSelectedFollowup] = useState<DeliveryFollowup | null>(null);
  const [csUpdate, setCsUpdate] = useState('');

  const { data: followups, isLoading } = useQuery({
    queryKey: ['delivery-followups'],
    queryFn: () => api.get<DeliveryFollowup[]>('/delivery'),
  });

  const updateFollowup = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/delivery/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-followups'] });
      setSelectedFollowup(null);
      setCsUpdate('');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Delivery Followups</h1>
        <p className="text-muted-foreground">Track and update delivery status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Truck className="mr-2 h-5 w-5" />
            Pending Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !followups || followups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No delivery followups found
            </div>
          ) : (
            <div className="space-y-2">
              {followups.map((followup) => (
                <div
                  key={followup.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted cursor-pointer"
                  onClick={() => setSelectedFollowup(followup)}
                >
                  <div className="flex items-center space-x-4">
                    <Package className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {followup.order?.emNumber || followup.order?.orderKey || followup.orderId}
                        </span>
                        <Badge>{followup.order?.orderStatus}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {followup.order?.customer?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {followup.deliveredCancelledDate ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="mr-1 h-4 w-4" />
                        <span className="text-sm">
                          {formatDateTime(followup.deliveredCancelledDate)}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Modal */}
      {selectedFollowup && (
        <Card>
          <CardHeader>
            <CardTitle>
              Update Followup: {selectedFollowup.order?.emNumber || selectedFollowup.orderId}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sales Instructions</label>
              <p className="text-sm text-muted-foreground border rounded p-2">
                {selectedFollowup.salesInstructions || 'No instructions'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">CS Update</label>
              <Input
                value={csUpdate}
                onChange={(e) => setCsUpdate(e.target.value)}
                placeholder="Add CS update..."
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() =>
                  updateFollowup.mutate({
                    id: selectedFollowup.id,
                    data: {
                      csUpdate,
                      deliveredCancelledDate: new Date().toISOString(),
                    },
                  })
                }
                disabled={updateFollowup.isPending}
              >
                Mark Delivered
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedFollowup(null)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
