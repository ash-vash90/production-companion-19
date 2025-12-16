import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, Trash2, Reply, X, CornerDownRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { createNotification } from '@/services/notificationService';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  step_number: number | null;
  created_at: string;
  reply_to_id: string | null;
  mentions: string[];
  user_name?: string;
  avatar_url?: string;
}

interface WorkOrderCommentsProps {
  workOrderId: string;
  workOrderItemId?: string;
  currentStepNumber?: number;
}

export function WorkOrderComments({ workOrderId, workOrderItemId, currentStepNumber }: WorkOrderCommentsProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${workOrderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_order_notes', filter: `work_order_id=eq.${workOrderId}` },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workOrderId, workOrderItemId]);

  const fetchComments = async () => {
    try {
      let query = supabase
        .from('work_order_notes')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('type', 'comment')
        .order('created_at', { ascending: true });

      if (workOrderItemId) {
        query = query.or(`work_order_item_id.eq.${workOrderItemId},work_order_item_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data || []).map(n => n.user_id).filter(Boolean))];
      let profilesMap: Record<string, { name: string; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = { name: p.full_name, avatar_url: p.avatar_url };
          return acc;
        }, {} as Record<string, { name: string; avatar_url: string | null }>);
      }

      const enriched = (data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        user_id: c.user_id,
        step_number: c.step_number,
        created_at: c.created_at,
        reply_to_id: c.reply_to_id,
        mentions: c.mentions || [],
        user_name: profilesMap[c.user_id]?.name || 'Unknown',
        avatar_url: profilesMap[c.user_id]?.avatar_url || undefined,
      }));

      setComments(enriched);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('work_order_notes')
        .insert({
          work_order_id: workOrderId,
          work_order_item_id: workOrderItemId || null,
          step_number: currentStepNumber || null,
          user_id: user.id,
          content: newComment.trim(),
          reply_to_id: replyingTo?.id || null,
          mentions: [],
          type: 'comment',
        });

      if (error) throw error;

      setNewComment('');
      setReplyingTo(null);
      
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('work_order_notes')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      toast.success(language === 'nl' ? 'Verwijderd' : 'Deleted');
    } catch (error: any) {
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleReply = (comment: Comment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Group comments: parent comments with their replies
  const parentComments = comments.filter(c => !c.reply_to_id);
  const getReplies = (id: string) => comments.filter(c => c.reply_to_id === id);

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = !isReply ? getReplies(comment.id) : [];
    const isOwn = comment.user_id === user?.id;
    
    return (
      <div key={comment.id} className={cn("group", isReply && "ml-8 md:ml-10")}>
        <div className="flex gap-2.5 md:gap-3">
          <Avatar className={cn("shrink-0", isReply ? "h-6 w-6" : "h-8 w-8")}>
            <AvatarImage src={comment.avatar_url} />
            <AvatarFallback className={cn("text-xs bg-muted", isReply && "text-[10px]")}>
              {getInitials(comment.user_name || '')}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            {/* Bubble */}
            <div className={cn(
              "rounded-2xl px-3 py-2 inline-block max-w-full",
              isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                <span className={cn("font-medium text-xs", isOwn ? "text-primary-foreground/90" : "text-foreground")}>
                  {comment.user_name}
                </span>
                <span className={cn("text-[10px]", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
                  {formatDistanceToNow(new Date(comment.created_at), {
                    addSuffix: true,
                    locale: language === 'nl' ? nl : enUS,
                  })}
                </span>
              </div>
              <p className={cn("text-sm break-words whitespace-pre-wrap", isOwn ? "text-primary-foreground" : "text-foreground")}>
                {comment.content}
              </p>
            </div>
            
            {/* Actions - always visible on mobile, hover on desktop */}
            <div className="flex items-center gap-1 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground"
                  onClick={() => handleReply(comment)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  {language === 'nl' ? 'Reageer' : 'Reply'}
                </Button>
              )}
              {isOwn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {/* Replies */}
            {replies.length > 0 && (
              <div className="mt-2 space-y-2">
                {replies.map(reply => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {language === 'nl' ? 'Opmerkingen' : 'Comments'}
          {parentComments.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {parentComments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-2 space-y-4">
        {/* Comments list */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : parentComments.length > 0 ? (
            <>
              {parentComments.map(comment => renderComment(comment))}
              <div ref={commentsEndRef} />
            </>
          ) : (
            <div className="py-6 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                {language === 'nl' ? 'Nog geen opmerkingen' : 'No comments yet'}
              </p>
            </div>
          )}
        </div>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs">
            <CornerDownRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground truncate flex-1">
              {language === 'nl' ? 'Reageren op' : 'Replying to'}{' '}
              <span className="font-medium text-foreground">{replyingTo.user_name}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={language === 'nl' ? 'Schrijf een opmerking...' : 'Write a comment...'}
            className="flex-1 h-10 text-sm"
            disabled={submitting}
          />
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
