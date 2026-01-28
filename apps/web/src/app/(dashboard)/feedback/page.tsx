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
import { formatDateTime } from '@/lib/utils';
import { Star, Plus, ExternalLink } from 'lucide-react';

interface Feedback {
  id: string;
  orderKey: string;
  feedback?: string;
  googleReviewLink?: string;
  recommendedProduct?: string;
  notes?: string;
  createdAt: string;
  order?: { emNumber?: string; customer?: { name: string } };
}

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    orderKey: '',
    feedback: '',
    googleReviewLink: '',
    recommendedProduct: '',
    notes: '',
  });

  const { data: feedbacks, isLoading } = useQuery({
    queryKey: ['feedbacks'],
    queryFn: () => api.get<Feedback[]>('/feedback'),
  });

  const createFeedback = useMutation({
    mutationFn: (data: typeof newFeedback) => api.post('/feedback', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      setShowAdd(false);
      setNewFeedback({ orderKey: '', feedback: '', googleReviewLink: '', recommendedProduct: '', notes: '' });
    },
    onError: (err: any) => alert(err.message || 'Failed to create feedback'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Feedback</h1>
          <p className="text-muted-foreground">Capture customer feedback and reviews</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Feedback
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Feedback</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Order Key / EM Number</label>
                <Input
                  value={newFeedback.orderKey}
                  onChange={(e) =>
                    setNewFeedback({ ...newFeedback, orderKey: e.target.value })
                  }
                  placeholder="e.g., EMUAE001"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Feedback</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newFeedback.feedback}
                  onChange={(e) =>
                    setNewFeedback({ ...newFeedback, feedback: e.target.value })
                  }
                  placeholder="Customer feedback..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Google Review Link</label>
                <Input
                  value={newFeedback.googleReviewLink}
                  onChange={(e) =>
                    setNewFeedback({ ...newFeedback, googleReviewLink: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Recommended Product</label>
                <Input
                  value={newFeedback.recommendedProduct}
                  onChange={(e) =>
                    setNewFeedback({ ...newFeedback, recommendedProduct: e.target.value })
                  }
                  placeholder="Product code or name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={newFeedback.notes}
                  onChange={(e) =>
                    setNewFeedback({ ...newFeedback, notes: e.target.value })
                  }
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createFeedback.mutate(newFeedback)}
                  disabled={!newFeedback.orderKey || createFeedback.isPending}
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
            <Star className="mr-2 h-5 w-5 text-yellow-500" />
            All Feedback ({feedbacks?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !feedbacks || feedbacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No feedback found
            </div>
          ) : (
            <div className="space-y-2">
              {feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {fb.order?.emNumber || fb.orderKey}
                        </span>
                        {fb.googleReviewLink && (
                          <a
                            href={fb.googleReviewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center text-sm"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Review
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {fb.order?.customer?.name || 'Unknown Customer'}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(fb.createdAt)}
                    </span>
                  </div>
                  {fb.feedback && (
                    <p className="mt-2 text-sm border-t pt-2">{fb.feedback}</p>
                  )}
                  {fb.recommendedProduct && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recommended: {fb.recommendedProduct}
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
