import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Space, message, Upload } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  CodeOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { uploadArticleImage } from '../api/knowledge';

interface ArticleEditorProps {
  value?: unknown | null; // TipTap JSON
  onChange?: (json: unknown) => void;
  placeholder?: string;
}

/**
 * 富文本文章编辑器（TipTap）：
 * - 工具栏：粗体/斜体/删除线/标题/列表/引用/代码/图片/链接
 * - 粘贴自动处理：从网页复制的内容中的图片（base64 / 外站 URL）会自动重新上传到 R2，
 *   保证我们对图片有掌控（外站可能挂掉、防盗链、合规问题）。
 * - 拖拽图片上传：直接把图片文件拖到编辑器即上传。
 *
 * 数据格式：value/onChange 都用 TipTap JSON（{ type: 'doc', content: [...] }），
 * 后端落 KnowledgeCase.contentBlocks，iOS 解析后原生渲染。
 */
export default function ArticleEditor({ value, onChange, placeholder }: ArticleEditorProps) {
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 关闭默认的图片粘贴行为，由我们的 handlePaste 接管以走 R2
        codeBlock: { HTMLAttributes: { class: 'tiptap-codeblock' } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Placeholder.configure({ placeholder: placeholder || '在这里粘贴文章内容，包括图片…' }),
    ],
    content: (value as any) ?? '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
      handlePaste: (view, event) => {
        // 处理直接粘贴的图片二进制（截图、Word 中的图片）
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                uploadAndInsert(view as any, file);
                return true;
              }
            }
          }
        }
        return false; // 让 TipTap 走默认 HTML 粘贴；HTML 中的 <img src=外站> 由 handleDrop 后处理或定时扫描
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imgFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (imgFiles.length === 0) return false;
        event.preventDefault();
        for (const f of imgFiles) {
          uploadAndInsert(view as any, f);
        }
        return true;
      },
    },
  });

  editorRef.current = editor;

  // value 外部受控变更时同步进编辑器（仅在差异显著时，避免光标抖动）
  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    const incoming = value as any;
    if (incoming && JSON.stringify(current) !== JSON.stringify(incoming)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  // 粘贴后扫描一遍 doc，把残留的外站 src=https://... 图片改为 R2（异步替换）
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      void rewriteExternalImages(editor);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="article-editor-wrap" style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <style>{editorCss}</style>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('链接地址', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 8px', background: '#fafafa' }}>
      <Space wrap size={4}>
        <Button size="small" icon={<UndoOutlined />} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <Button size="small" icon={<RedoOutlined />} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
        <span style={{ width: 1, height: 18, background: '#e8e8e8' }} />
        <Button
          size="small"
          type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Button>
        <Button
          size="small"
          type={editor.isActive('heading', { level: 3 }) ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Button>
        <Button
          size="small"
          icon={<BoldOutlined />}
          type={editor.isActive('bold') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Button
          size="small"
          icon={<ItalicOutlined />}
          type={editor.isActive('italic') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Button
          size="small"
          icon={<StrikethroughOutlined />}
          type={editor.isActive('strike') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <span style={{ width: 1, height: 18, background: '#e8e8e8' }} />
        <Button
          size="small"
          icon={<UnorderedListOutlined />}
          type={editor.isActive('bulletList') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <Button
          size="small"
          icon={<OrderedListOutlined />}
          type={editor.isActive('orderedList') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Button
          size="small"
          type={editor.isActive('blockquote') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          引用
        </Button>
        <Button
          size="small"
          icon={<CodeOutlined />}
          type={editor.isActive('codeBlock') ? 'primary' : 'default'}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <span style={{ width: 1, height: 18, background: '#e8e8e8' }} />
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={async (file) => {
            try {
              const url = await uploadArticleImage(file as File, 'article');
              editor.chain().focus().setImage({ src: url, alt: file.name }).run();
            } catch (e: any) {
              message.error(e?.message ?? '图片上传失败');
            }
            return false;
          }}
        >
          <Button size="small" icon={<PictureOutlined />}>图片</Button>
        </Upload>
        <Button size="small" icon={<LinkOutlined />} onClick={setLink} type={editor.isActive('link') ? 'primary' : 'default'} />
      </Space>
    </div>
  );
}

/**
 * 把单个 File 上传到 R2，再用返回的 URL 在当前光标位置插入图片节点。
 * view: TipTap ProseMirror EditorView
 */
async function uploadAndInsert(view: any, file: File) {
  try {
    const url = await uploadArticleImage(file, 'article');
    const { schema } = view.state;
    const node = schema.nodes.image.create({ src: url, alt: file.name });
    const tr = view.state.tr.replaceSelectionWith(node);
    view.dispatch(tr);
  } catch (e: any) {
    message.error(e?.message ?? '图片上传失败');
  }
}

/**
 * 异步扫描编辑器内所有图片节点，若 src 是外站 http(s) 且不是我们自己的 CDN，
 * 则下载 → 上传到 R2 → 替换 src。已带 r2/CDN 域名的图片跳过。
 * 注意：跨域 fetch 可能被拦截（CORS / 防盗链），失败时保留原 src 不阻塞编辑。
 */
async function rewriteExternalImages(editor: Editor) {
  const seenSrcs = new Set<string>();
  const toRewrite: Array<{ pos: number; src: string; node: any }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && typeof node.attrs.src === 'string') {
      const src = node.attrs.src as string;
      if (seenSrcs.has(src)) return;
      seenSrcs.add(src);
      if (!shouldRewrite(src)) return;
      toRewrite.push({ pos, src, node });
    }
  });
  if (toRewrite.length === 0) return;

  for (const item of toRewrite) {
    try {
      const file = await fetchAsFile(item.src);
      if (!file) continue;
      const newUrl = await uploadArticleImage(file, 'article');
      // 重新查找位置（doc 可能在异步等待期间变了）
      let foundPos = -1;
      editor.state.doc.descendants((n, p) => {
        if (foundPos !== -1) return false;
        if (n.type.name === 'image' && n.attrs.src === item.src) {
          foundPos = p;
          return false;
        }
      });
      if (foundPos === -1) continue;
      editor
        .chain()
        .setNodeSelection(foundPos)
        .updateAttributes('image', { src: newUrl })
        .run();
    } catch {
      // 跨域抓不到就保留原链接，不打断用户编辑
    }
  }
}

function shouldRewrite(src: string): boolean {
  if (src.startsWith('data:')) return true; // base64
  if (!/^https?:\/\//i.test(src)) return false;
  // 已经是我们的 CDN，跳过
  const cdn = (import.meta.env.VITE_CDN_DOMAIN as string | undefined) || '';
  if (cdn && src.startsWith(cdn)) return false;
  return true;
}

async function fetchAsFile(src: string): Promise<File | null> {
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    const ext = blob.type.split('/')[1] || 'jpg';
    return new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

const editorCss = `
.tiptap-editor {
  min-height: 320px;
  padding: 14px 16px;
  outline: none;
  font-size: 14px;
  line-height: 1.7;
}
.tiptap-editor h1 { font-size: 22px; font-weight: 700; margin: 12px 0 8px; }
.tiptap-editor h2 { font-size: 18px; font-weight: 700; margin: 10px 0 6px; }
.tiptap-editor h3 { font-size: 16px; font-weight: 600; margin: 8px 0 4px; }
.tiptap-editor p { margin: 0 0 8px; }
.tiptap-editor ul, .tiptap-editor ol { padding-left: 24px; margin: 4px 0 8px; }
.tiptap-editor blockquote { border-left: 3px solid #d9d9d9; padding-left: 12px; color: #595959; margin: 8px 0; }
.tiptap-editor img { max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0; }
.tiptap-editor pre.tiptap-codeblock { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: ui-monospace, monospace; font-size: 13px; }
.tiptap-editor p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #bfbfbf;
  pointer-events: none;
  height: 0;
}
.tiptap-editor a { color: #1677ff; text-decoration: underline; }
`;
