import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface Note {
  id: string;
  content: string;
  user_id: string;
  step_number: number | null;
  created_at: string;
  user_name?: string;
  avatar_url?: string;
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
  const notesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotes();

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

  const fetchNotes = async () => {
    try {
      let query = supabase
        .from('work_order_notes')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: true });

      // If we have a specific item, also filter by that
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
        });

      if (error) throw error;

      setNewNote('');
      toast.success(language === 'nl' ? 'Notitie toegevoegd' : 'Note added');
      
      // Scroll to bottom after adding
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          {language === 'nl' ? 'Notities & Opmerkingen' : 'Notes & Comments'}
          {notes.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {notes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Notes list */}
            <div className="max-h-64 overflow-y-auto space-y-3">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`flex gap-3 p-3 rounded-lg border ${
                      note.user_id === user?.id ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={note.avatar_url} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(note.user_name || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{note.user_name}</span>
                        <div className="flex items-center gap-2">
                          {note.step_number && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              {language === 'nl' ? 'Stap' : 'Step'} {note.step_number}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(note.created_at), {
                              addSuffix: true,
                              locale: language === 'nl' ? nl : enUS,
                            })}
                          </span>
                          {note.user_id === user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(note.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{note.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {language === 'nl' ? 'Nog geen notities' : 'No notes yet'}
                </div>
              )}
              <div ref={notesEndRef} />
            </div>

            {/* New note input */}
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={language === 'nl' ? 'Schrijf een notitie...' : 'Write a note...'}
                className="min-h-[80px] resize-none"
                disabled={submitting}
              />
              <Button
                onClick={handleSubmit}
                disabled={!newNote.trim() || submitting}
                size="icon"
                className="shrink-0 h-10 w-10"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
