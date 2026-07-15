"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CharacterCount from "@tiptap/extension-character-count";
import { common, createLowlight } from "lowlight";
import { useEffect, useCallback, useRef } from "react";
import { EditorToolbar } from "./EditorToolbar";
import { debounce } from "@/lib/utils";

const lowlight = createLowlight(common);

interface BlockEditorProps {
  content: Record<string, unknown> | null;
  onSave: (content: Record<string, unknown>) => Promise<void>;
  onContentChange?: (content: Record<string, unknown>) => void;
  placeholder?: string;
  editable?: boolean;
}

export function BlockEditor({
  content,
  onSave,
  onContentChange,
  placeholder = "Comece a escrever ou digite / para comandos...",
  editable = true,
}: BlockEditorProps) {
  const isSaving = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false }),
      Typography,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CharacterCount,
    ],
    content: content ?? undefined,
    editable,
    editorProps: {
      attributes: {
        class: "prose-dark",
        "aria-label": "Editor de conteúdo",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as Record<string, unknown>;
      onContentChange?.(json);
      debouncedSave(json);
    },
  });

  const debouncedSave = useCallback(
    debounce(async (json: Record<string, unknown>) => {
      if (isSaving.current) return;
      isSaving.current = true;
      try {
        await onSave(json);
      } finally {
        isSaving.current = false;
      }
    }, 2000),
    [onSave]
  );

  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content);
    }
  }, []);

  if (!editor) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {editable && <EditorToolbar editor={editor} />}
      <div className="flex-1 px-4 sm:px-8 lg:px-16 py-6 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="max-w-3xl mx-auto"
        />
        {editable && (
          <div className="max-w-3xl mx-auto mt-4 text-xs text-muted-foreground text-right">
            {editor.storage.characterCount?.characters()} caracteres
          </div>
        )}
      </div>
    </div>
  );
}
