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
import { Search, Plus, Phone, User } from 'lucide-react';

const statuses = ['ALL', 'NEW', 'CONTACTED', 'FOLLOW_UP', 'WON', 'LOST'] as const;

interface Lead {
  id: string;
  leadDate: string;
  phoneKey: string;
  status: string;
  country?: string;
  source?: string;
  notes?: string;
  assignedAgent?: { id: string; name: string };
  customer?: { id: string; name: string };
  _count?: { leadProducts: number };
}

export default function LeadsPage() {
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', status, search, page],
    queryFn: () =>
      api.get<{ data: Lead[]; meta: any }>(
        `/leads?status=${status === 'ALL' ? '' : status}&search=${search}&page=${page}&limit=20`
      ),
  });

  const leads = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Manage your sales pipeline</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by phone, name..."
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
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Status Pipeline */}
      <div className="grid grid-cols-5 gap-4">
        {statuses.slice(1).map((s) => {
          const count = leads.filter((l) => l.status === s).length;
          return (
            <Card
              key={s}
              className={`cursor-pointer transition-colors ${
                status === s ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setStatus(s)}
            >
              <CardContent className="pt-4 pb-4 text-center">
                <div className={`inline-block rounded-full px-3 py-1 text-sm ${statusColors[s as keyof typeof statusColors] || ''}`}>
                  {s.replace('_', ' ')}
                </div>
                <div className="mt-2 text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Leads List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Leads ({meta.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No leads found</div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            {lead.customer?.name || 'Unknown'}
                          </span>
                          <Badge
                            className={statusColors[lead.status as keyof typeof statusColors] || ''}
                          >
                            {lead.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="mr-1 h-3 w-3" />
                          {lead.phoneKey}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(lead.leadDate)}
                      </div>
                      {lead.assignedAgent && (
                        <div className="text-sm">
                          Assigned: {lead.assignedAgent.name}
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
