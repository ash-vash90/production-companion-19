import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, Trash2, Reply, AtSign, Check, Pencil, X, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { createNotification } from '@/services/notificationService';
import { cn } from '@/lib/utils';

interface Note {
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

interface UserOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface WorkOrderCommentsProps {
  workOrderId: string;
  workOrderItemId?: string;
  currentStepNumber?: number;
}

export function WorkOrderComments({ workOrderId, workOrderItemId, currentStepNumber }: WorkOrderCommentsProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Note | null>(null);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const notesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchNotes();
    fetchUsers();

    const channel = supabase
      .channel(`notes-${workOrderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_order_notes',
          filter: `work_order_id=eq.${workOrderId}`,
        },
        () => {
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workOrderId, workOrderItemId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .order('full_name');
    
    if (data) {
      setAllUsers(data);
    }
  };

  const fetchNotes = async () => {
    try {
      let query = supabase
        .from('work_order_notes')
        .select('*')
        .eq('work_order_id', workOrderId)
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

      const enrichedNotes = (data || []).map(note => ({
        id: note.id,
        content: note.content,
        user_id: note.user_id,
        step_number: note.step_number,
        created_at: note.created_at,
        reply_to_id: note.reply_to_id,
        mentions: note.mentions || [],
        user_name: profilesMap[note.user_id]?.name || 'Unknown',
        avatar_url: profilesMap[note.user_id]?.avatar_url || undefined,
      }));

      setNotes(enrichedNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMentionSelect = (userId: string, userName: string) => {
    const mention = `@${userName}`;
    setNewNote(prev => prev + mention + ' ');
    setSelectedMentions(prev => [...prev, userId]);
    setMentionOpen(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!newNote.trim() || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('work_order_notes')
        .insert({
          work_order_id: workOrderId,
          work_order_item_id: workOrderItemId || null,
          step_number: currentStepNumber || null,
          user_id: user.id,
          content: newNote.trim(),
          reply_to_id: replyingTo?.id || null,
          mentions: selectedMentions,
        })
        .select()
        .single();

      if (error) throw error;

      for (const mentionedUserId of selectedMentions) {
        if (mentionedUserId !== user.id) {
          await createNotification({
            userId: mentionedUserId,
            type: 'user_mentioned',
            title: language === 'nl' ? 'Je bent genoemd' : 'You were mentioned',
            message: language === 'nl'
              ? `${allUsers.find(u => u.id === user.id)?.full_name || 'Iemand'} heeft je genoemd in een opmerking`
              : `${allUsers.find(u => u.id === user.id)?.full_name || 'Someone'} mentioned you in a comment`,
            entityType: 'work_order',
            entityId: workOrderId,
          });
        }
      }

      setNewNote('');
      setReplyingTo(null);
      setSelectedMentions([]);
      toast.success(language === 'nl' ? 'Opmerking toegevoegd' : 'Comment added');
      
      scrollTimeoutRef.current = setTimeout(() => {
        notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('work_order_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success(language === 'nl' ? 'Opmerking verwijderd' : 'Comment deleted');
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return;

    try {
      const { error } = await supabase
        .from('work_order_notes')
        .update({ content: editContent.trim() })
        .eq('id', noteId);

      if (error) throw error;

      setEditingNoteId(null);
      setEditContent('');
      toast.success(language === 'nl' ? 'Opmerking bijgewerkt' : 'Comment updated');
    } catch (error: any) {
      console.error('Error updating note:', error);
      toast.error(t('error'), { description: error.message });
    }
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
    if (e.key === '@') {
      setMentionOpen(true);
    }
  };

  const parentNotes = notes.filter(n => !n.reply_to_id);
  const getReplies = (noteId: string) => notes.filter(n => n.reply_to_id === noteId);

  const sortedParentNotes = [...parentNotes].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const renderNote = (note: Note, isReply = false) => {
    const replies = getReplies(note.id);
    
    return (
      <div key={note.id} className={cn("group", isReply && "ml-10 mt-3")}>
        <div className="flex gap-3">
          {/* Avatar with thread line for parent notes */}
          <div className="relative flex flex-col items-center">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={note.avatar_url} />
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                {getInitials(note.user_name || '')}
              </AvatarFallback>
            </Avatar>
            {/* Thread line connecting to replies */}
            {!isReply && replies.length > 0 && (
              <div className="w-0.5 flex-1 bg-border mt-2" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{note.user_name}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(note.created_at), {
                  addSuffix: true,
                  locale: language === 'nl' ? nl : enUS,
                })}
              </span>
              {note.step_number && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {language === 'nl' ? 'Stap' : 'Step'} {note.step_number}
                </Badge>
              )}
            </div>
            
            {/* Content or Edit form */}
            {editingNoteId === note.id ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px] resize-none text-sm"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {language === 'nl' ? 'Annuleren' : 'Cancel'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(note.id)}
                    disabled={!editContent.trim()}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {language === 'nl' ? 'Opslaan' : 'Save'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words text-foreground">{note.content}</p>
                
                {/* Actions */}
                <div className="flex items-center gap-1 mt-2">
                  {!isReply && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyingTo(note)}
                    >
                      <Reply className="h-3.5 w-3.5 mr-1" />
                      {language === 'nl' ? 'Reageer' : 'Reply'}
                    </Button>
                  )}
                  
                  {note.user_id === user?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleStartEdit(note)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          {language === 'nl' ? 'Bewerken' : 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(note.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          {language === 'nl' ? 'Verwijderen' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </>
            )}
            
            {/* Replies */}
            {!isReply && replies.length > 0 && (
              <div className="mt-3 space-y-3">
                {replies.map(reply => renderNote(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {language === 'nl' ? 'Discussie' : 'Comments'}
        </CardTitle>
      </CardHeader>
      {/* Input Area - Top */}
      <CardContent className="pt-0 pb-6">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={language === 'nl' ? 'Voeg notitie toe...' : 'Add note...'}
              className="min-h-[80px] resize-none text-sm bg-background border-0 focus-visible:ring-1 pr-10"
              disabled={submitting}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1">
                <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <AtSign className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder={language === 'nl' ? 'Zoek collega...' : 'Search colleague...'} 
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty className="py-2 text-center text-sm">
                          {language === 'nl' ? 'Geen resultaten' : 'No results'}
                        </CommandEmpty>
                        <CommandGroup>
                          {allUsers
                            .filter(u => u.id !== user?.id)
                            .map((u) => (
                              <CommandItem
                                key={u.id}
                                onSelect={() => handleMentionSelect(u.id, u.full_name)}
                              >
                                <Avatar className="h-6 w-6 mr-2">
                                  <AvatarImage src={u.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {getInitials(u.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                {u.full_name}
                                {selectedMentions.includes(u.id) && (
                                  <Check className="h-4 w-4 ml-auto" />
                                )}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button
                onClick={handleSubmit}
                disabled={!newNote.trim() || submitting}
                size="sm"
                className="rounded-full px-4"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  language === 'nl' ? 'Verstuur' : 'Submit'
                )}
              </Button>
            </div>
          </div>
          
          {/* Reply indicator */}
          {replyingTo && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-background rounded text-sm border-l-2 border-primary">
              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {language === 'nl' ? 'Reageren op' : 'Replying to'} <span className="font-medium text-foreground">{replyingTo.user_name}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-auto"
                onClick={() => setReplyingTo(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {/* Divider */}
      <div className="border-t mb-4" />

      {/* Header */}
      <CardHeader className="px-0 pt-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {language === 'nl' ? 'Opmerkingen' : 'Comments'}
            {notes.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">
                {parentNotes.length}
              </Badge>
            )}
          </CardTitle>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-muted-foreground"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          >
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            {sortOrder === 'newest' 
              ? (language === 'nl' ? 'Nieuwste eerst' : 'Most recent')
              : (language === 'nl' ? 'Oudste eerst' : 'Oldest first')
            }
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="px-0 space-y-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedParentNotes.length > 0 ? (
          <div className="space-y-6">
            {sortedParentNotes.map((note) => renderNote(note))}
            <div ref={notesEndRef} />
          </div>
        ) : (
          <div className="py-12 text-center">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {language === 'nl' ? 'Nog geen opmerkingen' : 'No comments yet'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {language === 'nl' ? 'Wees de eerste die reageert' : 'Be the first to comment'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}