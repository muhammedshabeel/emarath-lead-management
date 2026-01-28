'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/lib/utils';
import { AlertTriangle, Plus } from 'lucide-react';

interface Complaint {
  id: string;
  orderKey: string;
  complaint: string;
  department: string;
  notes1?: string;
  notes2?: string;
  createdAt: string;
  csStaff?: { id: string; name: string };
  order?: { emNumber?: string; customer?: { name: string } };
}

const departments = ['Sales', 'Delivery', 'Product', 'Support', 'Other'];

export default function ComplaintsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newComplaint, setNewComplaint] = useState({
    orderKey: '',
    complaint: '',
    department: 'Support',
    notes1: '',
  });

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => api.get<Complaint[]>('/complaints'),
  });

  const createComplaint = useMutation({
    mutationFn: (data: typeof newComplaint) => api.post('/complaints', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      setShowAdd(false);
      setNewComplaint({ orderKey: '', complaint: '', department: 'Support', notes1: '' });
    },
    onError: (err: any) => alert(err.message || 'Failed to create complaint'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Complaints</h1>
          <p className="text-muted-foreground">Manage customer complaints</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Complaint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Complaint</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Order Key / EM Number</label>
                <Input
                  value={newComplaint.orderKey}
                  onChange={(e) =>
                    setNewComplaint({ ...newComplaint, orderKey: e.target.value })
                  }
                  placeholder="e.g., EMUAE001"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Select
                  value={newComplaint.department}
                  onValueChange={(value) =>
                    setNewComplaint({ ...newComplaint, department: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Complaint</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newComplaint.complaint}
                  onChange={(e) =>
                    setNewComplaint({ ...newComplaint, complaint: e.target.value })
                  }
                  placeholder="Describe the complaint..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={newComplaint.notes1}
                  onChange={(e) =>
                    setNewComplaint({ ...newComplaint, notes1: e.target.value })
                  }
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createComplaint.mutate(newComplaint)}
                  disabled={!newComplaint.orderKey || !newComplaint.complaint || createComplaint.isPending}
                >
                  Submit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-red-500" />
            All Complaints ({complaints?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !complaints || complaints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No complaints found
            </div>
          ) : (
            <div className="space-y-2">
              {complaints.map((complaint) => (
                <div
                  key={complaint.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {complaint.order?.emNumber || complaint.orderKey}
                        </span>
                        <span className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                          {complaint.department}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {complaint.order?.customer?.name || 'Unknown Customer'}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(complaint.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm border-t pt-2">{complaint.complaint}</p>
                  {complaint.notes1 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Notes: {complaint.notes1}
                    </p>
                  )}
                  {complaint.csStaff && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Logged by: {complaint.csStaff.name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
