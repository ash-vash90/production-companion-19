import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { StickyNote, Send, Loader2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface SimpleNote {
  id: string;
  content: string;
  user_id: string;
  step_number: number | null;
  created_at: string;
  user_name?: string;
}

interface SimpleNotesProps {
  workOrderId: string;
  workOrderItemId?: string;
  currentStepNumber?: number;
}

/**
 * SimpleNotes - Quick annotations on work orders
 * For quick notes/annotations only. No threading, no mentions.
 * Use WorkOrderComments for threaded discussions.
 */
export function SimpleNotes({ workOrderId, workOrderItemId, currentStepNumber }: SimpleNotesProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [notes, setNotes] = useState<SimpleNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel(`simple-notes-${workOrderId}`)
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
      // Only fetch notes that are NOT replies (simple notes only)
      let query = supabase
        .from('work_order_notes')
        .select('*')
        .eq('work_order_id', workOrderId)
        .is('reply_to_id', null)
        .order('created_at', { ascending: false });

      if (workOrderItemId) {
        query = query.or(`work_order_item_id.eq.${workOrderItemId},work_order_item_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const userIds = [...new Set((data || []).map(n => n.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      const enrichedNotes = (data || []).map(note => ({
        id: note.id,
        content: note.content,
        user_id: note.user_id,
        step_number: note.step_number,
        created_at: note.created_at,
        user_name: profilesMap[note.user_id] || 'Unknown',
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
          reply_to_id: null,
          mentions: [],
        });

      if (error) throw error;

      setNewNote('');
      toast.success(language === 'nl' ? 'Notitie toegevoegd' : 'Note added');
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          {language === 'nl' ? 'Notities' : 'Notes'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={language === 'nl' ? 'Snelle notitie toevoegen...' : 'Add quick note...'}
            className="min-h-[60px] resize-none text-sm flex-1"
            disabled={submitting}
          />
          <Button
            onClick={handleSubmit}
            disabled={!newNote.trim() || submitting}
            size="icon"
            className="h-[60px] w-10"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Notes list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {language === 'nl' ? 'Nog geen notities' : 'No notes yet'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group bg-muted/50 rounded-lg p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="whitespace-pre-wrap break-words">{note.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">{note.user_name}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(note.created_at), {
                          addSuffix: true,
                          locale: language === 'nl' ? nl : enUS,
                        })}
                      </span>
                      {note.step_number && (
                        <>
                          <span>•</span>
                          <span>{language === 'nl' ? 'Stap' : 'Step'} {note.step_number}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {note.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
