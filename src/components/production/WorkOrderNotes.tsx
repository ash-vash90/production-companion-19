import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, Trash2, Reply, AtSign, Check, Pencil, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { createNotification } from '@/services/notificationService';

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

interface WorkOrderNotesProps {
  workOrderId: string;
  workOrderItemId?: string;
  currentStepNumber?: number;
}

export function WorkOrderNotes({ workOrderId, workOrderItemId, currentStepNumber }: WorkOrderNotesProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Note | null>(null);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const notesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchNotes();
    fetchUsers();

    // Real-time subscription for new notes
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

      // Fetch user profiles
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
      const { data: insertedNote, error } = await supabase
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

      // Send notifications to mentioned users
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
      toast.success(language === 'nl' ? 'Notitie toegevoegd' : 'Note added');
      
      setTimeout(() => {
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

      toast.success(language === 'nl' ? 'Notitie verwijderd' : 'Note deleted');
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
      toast.success(language === 'nl' ? 'Notitie bijgewerkt' : 'Note updated');
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

  // Get parent notes (no reply_to_id)
  const parentNotes = notes.filter(n => !n.reply_to_id);
  
  // Get replies for a note
  const getReplies = (noteId: string) => notes.filter(n => n.reply_to_id === noteId);

  const renderNote = (note: Note, isReply = false) => (
    <div
      key={note.id}
      className={`flex gap-2 p-2 rounded-lg border ${
        note.user_id === user?.id ? 'bg-accent/50 border-border' : 'bg-muted/30 border-border/50'
      } ${isReply ? 'ml-6 border-l-2 border-l-muted-foreground/30' : ''}`}
    >
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={note.avatar_url} />
        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
          {getInitials(note.user_name || '')}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-medium text-xs">{note.user_name}</span>
          <div className="flex items-center gap-1.5">
            {note.step_number && (
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {language === 'nl' ? 'Stap' : 'Step'} {note.step_number}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(note.created_at), {
                addSuffix: true,
                locale: language === 'nl' ? nl : enUS,
              })}
            </span>
            {!isReply && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => setReplyingTo(note)}
              >
                <Reply className="h-3 w-3" />
              </Button>
            )}
            {note.user_id === user?.id && editingNoteId !== note.id && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={() => handleStartEdit(note)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(note.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        {editingNoteId === note.id ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] resize-none text-xs"
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleCancelEdit}
              >
                <X className="h-3 w-3 mr-1" />
                {language === 'nl' ? 'Annuleren' : 'Cancel'}
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => handleSaveEdit(note.id)}
                disabled={!editContent.trim()}
              >
                <Check className="h-3 w-3 mr-1" />
                {language === 'nl' ? 'Opslaan' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs mt-0.5 whitespace-pre-wrap break-words">{note.content}</p>
        )}
        {/* Render replies */}
        {!isReply && getReplies(note.id).length > 0 && (
          <div className="mt-2 space-y-2">
            {getReplies(note.id).map(reply => renderNote(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" />
          {language === 'nl' ? 'Notities & Opmerkingen' : 'Notes & Comments'}
          {notes.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {notes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Notes list */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {parentNotes.length > 0 ? (
                parentNotes.map((note) => renderNote(note))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {language === 'nl' ? 'Nog geen notities' : 'No notes yet'}
                </div>
              )}
              <div ref={notesEndRef} />
            </div>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                <Reply className="h-3 w-3" />
                <span className="text-muted-foreground">
                  {language === 'nl' ? 'Antwoord op' : 'Replying to'} {replyingTo.user_name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-auto"
                  onClick={() => setReplyingTo(null)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* New note input */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={language === 'nl' ? 'Schrijf een notitie... (@ om te taggen)' : 'Write a note... (@ to tag)'}
                  className="min-h-[60px] resize-none text-xs pr-8"
                  disabled={submitting}
                />
                <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-6 w-6 text-muted-foreground"
                    >
                      <AtSign className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="end">
                    <Command>
                      <CommandInput 
                        placeholder={language === 'nl' ? 'Zoek collega...' : 'Search colleague...'} 
                        className="h-8 text-xs"
                      />
                      <CommandList>
                        <CommandEmpty className="text-xs py-2">
                          {language === 'nl' ? 'Geen resultaten' : 'No results'}
                        </CommandEmpty>
                        <CommandGroup>
                          {allUsers
                            .filter(u => u.id !== user?.id)
                            .map((u) => (
                              <CommandItem
                                key={u.id}
                                onSelect={() => handleMentionSelect(u.id, u.full_name)}
                                className="text-xs"
                              >
                                <Avatar className="h-5 w-5 mr-2">
                                  <AvatarImage src={u.avatar_url || undefined} />
                                  <AvatarFallback className="text-[8px]">
                                    {getInitials(u.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                {u.full_name}
                                {selectedMentions.includes(u.id) && (
                                  <Check className="h-3 w-3 ml-auto" />
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
                size="icon"
                className="shrink-0 h-8 w-8"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}