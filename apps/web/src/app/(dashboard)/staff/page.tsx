'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Users, Plus, Edit } from 'lucide-react';

interface Staff {
  id: string;
  email: string;
  name: string;
  role: string;
  country?: string;
  active: boolean;
  cx3Extension?: string;
}

const roles = ['ADMIN', 'AGENT', 'CS', 'DELIVERY'];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'AGENT',
    country: '',
    cx3Extension: '',
    active: true,
  });

  const { data: staffList, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<Staff[]>('/staff'),
  });

  const createStaff = useMutation({
    mutationFn: (data: typeof formData) => api.post('/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setShowAdd(false);
      resetForm();
    },
    onError: (err: any) => alert(err.message || 'Failed to create staff'),
  });

  const updateStaff = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/staff/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setEditingStaff(null);
      resetForm();
    },
    onError: (err: any) => alert(err.message || 'Failed to update staff'),
  });

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      role: 'AGENT',
      country: '',
      cx3Extension: '',
      active: true,
    });
  };

  const openEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setFormData({
      email: staff.email,
      name: staff.name,
      role: staff.role,
      country: staff.country || '',
      cx3Extension: staff.cx3Extension || '',
      active: staff.active,
    });
  };

  const handleSubmit = () => {
    if (editingStaff) {
      updateStaff.mutate({ id: editingStaff.id, data: formData });
    } else {
      createStaff.mutate(formData);
    }
  };

  const roleColors = {
    ADMIN: 'bg-purple-100 text-purple-800',
    AGENT: 'bg-blue-100 text-blue-800',
    CS: 'bg-green-100 text-green-800',
    DELIVERY: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage team members and roles</p>
        </div>
        <Dialog open={showAdd || !!editingStaff} onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditingStaff(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStaff ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@example.com"
                  disabled={!!editingStaff}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Country</label>
                <Input
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  placeholder="UAE, KSA, etc."
                />
              </div>
              <div>
                <label className="text-sm font-medium">3CX Extension</label>
                <Input
                  value={formData.cx3Extension}
                  onChange={(e) =>
                    setFormData({ ...formData, cx3Extension: e.target.value })
                  }
                  placeholder="e.g., 101"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                />
                <label htmlFor="active" className="text-sm font-medium">
                  Active
                </label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAdd(false);
                    setEditingStaff(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !formData.email ||
                    !formData.name ||
                    createStaff.isPending ||
                    updateStaff.isPending
                  }
                >
                  {editingStaff ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Team ({staffList?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !staffList || staffList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No staff found
            </div>
          ) : (
            <div className="space-y-2">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                      {staff.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{staff.name}</span>
                        <Badge
                          className={roleColors[staff.role as keyof typeof roleColors] || ''}
                        >
                          {staff.role}
                        </Badge>
                        {!staff.active && (
                          <Badge variant="outline" className="text-gray-500">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{staff.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right text-sm text-muted-foreground">
                      {staff.country && <p>{staff.country}</p>}
                      {staff.cx3Extension && <p>Ext: {staff.cx3Extension}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(staff)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
