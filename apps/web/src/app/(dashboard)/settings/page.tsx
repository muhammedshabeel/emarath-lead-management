'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, Plus, Edit, Trash } from 'lucide-react';

interface EmSeries {
  id: string;
  country: string;
  prefix: string;
  nextCounter: number;
  active: boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingSeries, setEditingSeries] = useState<EmSeries | null>(null);
  const [formData, setFormData] = useState({
    country: '',
    prefix: '',
    nextCounter: 1,
    active: true,
  });

  const { data: emSeries, isLoading } = useQuery({
    queryKey: ['em-series'],
    queryFn: () => api.get<EmSeries[]>('/settings/em-series'),
  });

  const createSeries = useMutation({
    mutationFn: (data: typeof formData) => api.post('/settings/em-series', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['em-series'] });
      setShowAdd(false);
      resetForm();
    },
    onError: (err: any) => alert(err.message || 'Failed to create series'),
  });

  const updateSeries = useMutation({
    mutationFn: ({ country, data }: { country: string; data: any }) =>
      api.put(`/settings/em-series/${country}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['em-series'] });
      setEditingSeries(null);
      resetForm();
    },
    onError: (err: any) => alert(err.message || 'Failed to update series'),
  });

  const deleteSeries = useMutation({
    mutationFn: (country: string) => api.delete(`/settings/em-series/${country}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['em-series'] });
    },
    onError: (err: any) => alert(err.message || 'Failed to delete series'),
  });

  const resetForm = () => {
    setFormData({
      country: '',
      prefix: '',
      nextCounter: 1,
      active: true,
    });
  };

  const openEdit = (series: EmSeries) => {
    setEditingSeries(series);
    setFormData({
      country: series.country,
      prefix: series.prefix,
      nextCounter: series.nextCounter,
      active: series.active,
    });
  };

  const handleSubmit = () => {
    if (editingSeries) {
      updateSeries.mutate({
        country: editingSeries.country,
        data: {
          prefix: formData.prefix,
          nextCounter: formData.nextCounter,
          active: formData.active,
        },
      });
    } else {
      createSeries.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure system settings</p>
      </div>

      {/* EM Series Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              EM Number Series
            </CardTitle>
            <CardDescription>
              Configure order number prefixes by country
            </CardDescription>
          </div>
          <Dialog open={showAdd || !!editingSeries} onOpenChange={(open) => {
            if (!open) {
              setShowAdd(false);
              setEditingSeries(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Series
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSeries ? 'Edit EM Series' : 'Add EM Series'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Country</label>
                  <Input
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., UAE, KSA"
                    disabled={!!editingSeries}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prefix</label>
                  <Input
                    value={formData.prefix}
                    onChange={(e) =>
                      setFormData({ ...formData, prefix: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., EMUAE"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: {formData.prefix || 'EMUAE'}{String(formData.nextCounter).padStart(4, '0')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Next Counter</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.nextCounter}
                    onChange={(e) =>
                      setFormData({ ...formData, nextCounter: parseInt(e.target.value) || 1 })
                    }
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
                      setEditingSeries(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      !formData.country ||
                      !formData.prefix ||
                      createSeries.isPending ||
                      updateSeries.isPending
                    }
                  >
                    {editingSeries ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !emSeries || emSeries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No EM series configured
            </div>
          ) : (
            <div className="space-y-2">
              {emSeries.map((series) => (
                <div
                  key={series.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{series.country}</span>
                      {!series.active && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Prefix: {series.prefix} • Next: {series.prefix}{String(series.nextCounter).padStart(4, '0')}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(series)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete EM series for ${series.country}?`)) {
                          deleteSeries.mutate(series.country);
                        }
                      }}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version:</span>
            <span>1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Environment:</span>
            <span>{process.env.NODE_ENV}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">API URL:</span>
            <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
