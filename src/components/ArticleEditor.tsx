'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Link as LinkIcon, Image as ImageIcon, Undo, Redo, Code
} from 'lucide-react'

type Props = {
  content: Record<string, unknown> | null
  onChange: (json: Record<string, unknown>) => void
  onInsertImage: () => void
}

export default function ArticleEditor({ content, onChange, onInsertImage }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ImageExtension.configure({ inline: false }),
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Begynn å skrive artikkelen din...' }),
    ],
    content: content || undefined,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as Record<string, unknown>)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none min-h-[400px] focus:outline-none px-6 py-4',
      },
    },
  })

  if (!editor) return null

  const addLink = () => {
    const url = window.prompt('URL:')
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void
    active?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50/50">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Fet"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Kursiv"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Overskrift 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Overskrift 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Overskrift 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Punktliste"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Nummerert liste"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Sitat"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Kodeblokk"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Lenke">
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={onInsertImage} title="Sett inn bilde">
          <ImageIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Angre">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Gjør om">
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
