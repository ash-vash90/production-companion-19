/**
 * Rich Text Editor Component
 *
 * TipTap-based editor with support for:
 * - Basic formatting (bold, italic, underline, headings, lists)
 * - Images (upload + URL)
 * - Videos (YouTube/Vimeo embeds)
 * - Links
 * - Text alignment
 */

import { useCallback, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Highlighter,
  Undo,
  Redo,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
  minHeight?: string;
}

// Toolbar Button Component
function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-muted text-primary'
      )}
    >
      {children}
    </Button>
  );
}

// Toolbar Divider
function ToolbarDivider() {
  return <div className="w-px h-6 bg-border mx-1" />;
}

// Editor Toolbar
function EditorToolbar({
  editor,
  onImageUpload,
  disabled,
}: {
  editor: Editor | null;
  onImageUpload?: (file: File) => Promise<string>;
  disabled?: boolean;
}) {
  const { t, language } = useLanguage();
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!editor) return null;

  const handleSetLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
    setShowLinkDialog(false);
  };

  const handleAddImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
    }
    setImageUrl('');
    setShowImageDialog(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;

    setUploading(true);
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
      setShowImageDialog(false);
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleAddVideo = () => {
    if (videoUrl) {
      // Parse YouTube/Vimeo URLs
      const youtubeMatch = videoUrl.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
      );
      const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);

      if (youtubeMatch) {
        editor.chain().focus().setYoutubeVideo({ src: videoUrl }).run();
      } else if (vimeoMatch) {
        // Insert Vimeo as iframe HTML
        const vimeoId = vimeoMatch[1];
        editor.chain().focus().insertContent(`
          <div class="video-embed vimeo-embed">
            <iframe
              src="https://player.vimeo.com/video/${vimeoId}"
              width="640"
              height="360"
              frameborder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowfullscreen>
            </iframe>
          </div>
        `).run();
      }
    }
    setVideoUrl('');
    setShowVideoDialog(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
          title={language === 'nl' ? 'Ongedaan maken' : 'Undo'}
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
          title={language === 'nl' ? 'Opnieuw' : 'Redo'}
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          disabled={disabled}
          title={language === 'nl' ? 'Vet' : 'Bold'}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          disabled={disabled}
          title={language === 'nl' ? 'Cursief' : 'Italic'}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          disabled={disabled}
          title={language === 'nl' ? 'Onderstrepen' : 'Underline'}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          disabled={disabled}
          title={language === 'nl' ? 'Doorhalen' : 'Strikethrough'}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive('highlight')}
          disabled={disabled}
          title={language === 'nl' ? 'Markeren' : 'Highlight'}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          disabled={disabled}
          title={language === 'nl' ? 'Kop 1' : 'Heading 1'}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          title={language === 'nl' ? 'Kop 2' : 'Heading 2'}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          disabled={disabled}
          title={language === 'nl' ? 'Kop 3' : 'Heading 3'}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          disabled={disabled}
          title={language === 'nl' ? 'Opsommingslijst' : 'Bullet List'}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          disabled={disabled}
          title={language === 'nl' ? 'Genummerde lijst' : 'Numbered List'}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          disabled={disabled}
          title={language === 'nl' ? 'Links uitlijnen' : 'Align Left'}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          disabled={disabled}
          title={language === 'nl' ? 'Centreren' : 'Align Center'}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          disabled={disabled}
          title={language === 'nl' ? 'Rechts uitlijnen' : 'Align Right'}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          onClick={() => {
            const currentUrl = editor.getAttributes('link').href || '';
            setLinkUrl(currentUrl);
            setShowLinkDialog(true);
          }}
          isActive={editor.isActive('link')}
          disabled={disabled}
          title={language === 'nl' ? 'Link' : 'Link'}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Image */}
        <ToolbarButton
          onClick={() => setShowImageDialog(true)}
          disabled={disabled}
          title={language === 'nl' ? 'Afbeelding' : 'Image'}
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Video */}
        <ToolbarButton
          onClick={() => setShowVideoDialog(true)}
          disabled={disabled}
          title={language === 'nl' ? 'Video' : 'Video'}
        >
          <YoutubeIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'nl' ? 'Link toevoegen' : 'Add Link'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              {language === 'nl' ? 'Annuleren' : 'Cancel'}
            </Button>
            <Button onClick={handleSetLink}>
              {language === 'nl' ? 'Toevoegen' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'nl' ? 'Afbeelding toevoegen' : 'Add Image'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {onImageUpload && (
              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Uploaden' : 'Upload'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </div>
                {uploading && (
                  <p className="text-sm text-muted-foreground">
                    {language === 'nl' ? 'Uploaden...' : 'Uploading...'}
                  </p>
                )}
              </div>
            )}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {language === 'nl' ? 'Of' : 'Or'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === 'nl' ? 'URL' : 'URL'}</Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>
              {language === 'nl' ? 'Annuleren' : 'Cancel'}
            </Button>
            <Button onClick={handleAddImage} disabled={!imageUrl}>
              {language === 'nl' ? 'Toevoegen' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'nl' ? 'Video toevoegen' : 'Add Video'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>YouTube / Vimeo URL</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="text-xs text-muted-foreground">
                {language === 'nl'
                  ? 'Plak een YouTube of Vimeo link'
                  : 'Paste a YouTube or Vimeo link'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoDialog(false)}>
              {language === 'nl' ? 'Annuleren' : 'Cancel'}
            </Button>
            <Button onClick={handleAddVideo} disabled={!videoUrl}>
              {language === 'nl' ? 'Toevoegen' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  disabled = false,
  onImageUpload,
  minHeight = '200px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: {
          class: 'youtube-embed',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing...',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: false,
      }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden bg-background',
      disabled && 'opacity-60'
    )}>
      <EditorToolbar
        editor={editor}
        onImageUpload={onImageUpload}
        disabled={disabled}
      />
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none p-4 focus-within:outline-none',
          '[&_.ProseMirror]:min-h-[var(--min-height)] [&_.ProseMirror]:outline-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg',
          '[&_.ProseMirror_iframe]:max-w-full [&_.ProseMirror_iframe]:rounded-lg',
          '[&_.ProseMirror_mark]:bg-yellow-200 [&_.ProseMirror_mark]:dark:bg-yellow-800',
        )}
        style={{ '--min-height': minHeight } as React.CSSProperties}
      />
    </div>
  );
}

// Read-only renderer for displaying rich content
export function RichTextContent({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none',
        '[&_img]:max-w-full [&_img]:rounded-lg',
        '[&_iframe]:max-w-full [&_iframe]:rounded-lg [&_iframe]:aspect-video',
        '[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800',
        '[&_a]:text-primary [&_a]:underline',
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

export default RichTextEditor;
