'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateTime, formatPhone } from '@/lib/utils';
import { MessageSquare, Search, User } from 'lucide-react';

interface Conversation {
  id: string;
  phoneKey: string;
  lastMessageAt: string;
  unreadCount: number;
  assignedAgent?: { id: string; name: string };
  customer?: { id: string; name: string };
  activeLead?: { id: string; status: string };
}

export default function InboxPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/whatsapp/conversations'),
  });

  // Setup WebSocket connection
  useEffect(() => {
    if (!token || !user) return;

    const ws = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      auth: { token },
    });

    ws.on('connect', () => {
      console.log('WebSocket connected');
    });

    ws.on('new_message', (data) => {
      console.log('New message:', data);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    ws.on('conversation_assigned', (data) => {
      console.log('Conversation assigned:', data);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    setSocket(ws);

    return () => {
      ws.disconnect();
    };
  }, [token, user, queryClient]);

  // Filter conversations
  const filteredConversations = (conversations || []).filter((conv) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      conv.phoneKey.includes(search) ||
      conv.customer?.name?.toLowerCase().includes(searchLower)
    );
  });

  // Sort by last message (most recent first), unread first
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inbox</h1>
        <p className="text-muted-foreground">WhatsApp conversations assigned to you</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by phone or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="mr-2 h-5 w-5" />
            Conversations ({sortedConversations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : sortedConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No conversations found
            </div>
          ) : (
            <div className="space-y-2">
              {sortedConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted cursor-pointer"
                  onClick={() => {
                    if (conv.activeLead) {
                      router.push(`/leads/${conv.activeLead.id}`);
                    }
                  }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                        <User className="h-6 w-6 text-green-600" />
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {conv.customer?.name || formatPhone(conv.phoneKey)}
                        </span>
                        {conv.activeLead && (
                          <Badge variant="outline" className="text-xs">
                            {conv.activeLead.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatPhone(conv.phoneKey)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(conv.lastMessageAt)}
                    </p>
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="mt-1">
                        {conv.unreadCount} new
                      </Badge>
                    )}
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
