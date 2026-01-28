'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatDateTime, statusColors, formatPhone } from '@/lib/utils';
import { Phone, MessageSquare, ArrowLeft, Plus, Trash, Check } from 'lucide-react';

interface Lead {
  id: string;
  leadDate: string;
  phoneKey: string;
  status: string;
  country?: string;
  source?: string;
  adSource?: string;
  language?: string;
  notes?: string;
  csRemarks?: string;
  paymentMethod?: string;
  assignedAgent?: { id: string; name: string };
  customer?: { id: string; name: string; phoneKey: string };
  intakeForm?: {
    customerName?: string;
    altPhone?: string;
    shippingCountry?: string;
    shippingCity?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    googleMapsLink?: string;
    preferredDeliveryTime?: string;
    specialInstructions?: string;
  };
  leadProducts: Array<{
    id: string;
    productCode: string;
    quantity: number;
    product?: { productName: string };
  }>;
}

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text: string;
  timestamp: string;
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Fetch lead
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<Lead>(`/leads/${id}`),
  });

  // Fetch WhatsApp messages
  const { data: conversation } = useQuery({
    queryKey: ['conversation', lead?.phoneKey],
    queryFn: () => api.get<{ messages: Message[] }>(`/whatsapp/conversation/${lead?.phoneKey}`),
    enabled: !!lead?.phoneKey,
  });

  // Fetch products for picker
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<any[]>('/products'),
  });

  // Update lead status
  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/leads/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  });

  // Initiate call
  const initiateCall = useMutation({
    mutationFn: () => api.post('/calls/initiate', { leadId: id }),
    onSuccess: () => alert('Call initiated!'),
    onError: (err: any) => alert(err.message || 'Failed to initiate call'),
  });

  // Send WhatsApp message
  const sendMessage = useMutation({
    mutationFn: (text: string) =>
      api.post('/whatsapp/send', { phoneKey: lead?.phoneKey, text }),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['conversation', lead?.phoneKey] });
    },
  });

  // Convert lead
  const convertLead = useMutation({
    mutationFn: () => api.post(`/leads/${id}/convert`),
    onSuccess: (data: any) => {
      alert(`Order created: ${data.emNumber || data.orderKey}`);
      router.push(`/orders/${data.orderKey}`);
    },
    onError: (err: any) => alert(err.message || 'Failed to convert lead'),
  });

  if (isLoading || !lead) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const messages = conversation?.messages || [];

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
              {lead.customer?.name || 'Lead Details'}
            </h1>
            <p className="text-muted-foreground">{formatPhone(lead.phoneKey)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={statusColors[lead.status as keyof typeof statusColors] || ''}>
            {lead.status.replace('_', ' ')}
          </Badge>
          <Button onClick={() => initiateCall.mutate()} disabled={initiateCall.isPending}>
            <Phone className="mr-2 h-4 w-4" />
            Call
          </Button>
          {lead.status !== 'WON' && lead.status !== 'LOST' && (
            <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
              <DialogTrigger asChild>
                <Button variant="default">
                  <Check className="mr-2 h-4 w-4" />
                  Convert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convert Lead to Order</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p>This will:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    <li>Create an order with {lead.leadProducts.length} product(s)</li>
                    <li>Set lead status to WON</li>
                    <li>Generate EM number</li>
                  </ul>
                  {lead.leadProducts.length === 0 && (
                    <p className="text-red-500 text-sm">⚠ Add at least one product first</p>
                  )}
                  {!lead.intakeForm?.shippingCountry && (
                    <p className="text-red-500 text-sm">⚠ Add shipping address first</p>
                  )}
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => convertLead.mutate()}
                      disabled={
                        convertLead.isPending ||
                        lead.leadProducts.length === 0 ||
                        !lead.intakeForm?.shippingCountry
                      }
                    >
                      Convert
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: WhatsApp Thread */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-2">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No messages yet</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 ${
                        msg.direction === 'OUTBOUND'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatDateTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMessage.trim()) {
                      sendMessage.mutate(newMessage);
                    }
                  }}
                />
                <Button
                  onClick={() => sendMessage.mutate(newMessage)}
                  disabled={!newMessage.trim() || sendMessage.isPending}
                >
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Lead Info */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={lead.status}
                onValueChange={(value) => updateStatus.mutate(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="CONTACTED">Contacted</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                  <SelectItem value="WON">Won</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Lead Info */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{formatDateTime(lead.leadDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country:</span>
                <span>{lead.country || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source:</span>
                <span>{lead.source || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ad Source:</span>
                <span>{lead.adSource || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent:</span>
                <span>{lead.assignedAgent?.name || 'Unassigned'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Info */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.intakeForm ? (
                <>
                  <p>{lead.intakeForm.shippingAddressLine1}</p>
                  <p>{lead.intakeForm.shippingAddressLine2}</p>
                  <p>
                    {lead.intakeForm.shippingCity}, {lead.intakeForm.shippingCountry}
                  </p>
                  {lead.intakeForm.googleMapsLink && (
                    <a
                      href={lead.intakeForm.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      View on Maps
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No shipping info</p>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Products ({lead.leadProducts.length})</CardTitle>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {lead.leadProducts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No products added</p>
              ) : (
                <div className="space-y-2">
                  {lead.leadProducts.map((lp) => (
                    <div
                      key={lp.id}
                      className="flex items-center justify-between rounded border p-2"
                    >
                      <div>
                        <p className="font-medium">{lp.product?.productName || lp.productCode}</p>
                        <p className="text-sm text-muted-foreground">Qty: {lp.quantity}</p>
                      </div>
                      <Button size="icon" variant="ghost">
                        <Trash className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
