import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Badge,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@mashora/design-system'
import { Paperclip, Upload, Download, Trash2, Image, FileText, File as FileIcon } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { toast } from '@/components/shared'
import { extractErrorMessage } from '@/lib/errors'

interface AttachmentRecord {
  id: number
  name: string
  mimetype?: string | false
  file_size?: number | false
  create_date?: string | false
  create_uid?: [number, string] | false
}

interface AttachmentPanelProps {
  model: string
  resId: number
  className?: string
}

function getFileIcon(mimetype: string) {
  if (mimetype?.startsWith('image/')) return Image
  if (mimetype?.includes('pdf')) return FileText
  return FileIcon
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function AttachmentPanel({ model, resId, className }: AttachmentPanelProps) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['attachments', model, resId],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/attachments/${model}/${resId}`)
      return data
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (attachmentId: number) => {
      await erpClient.raw.delete(`/attachments/${attachmentId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', model, resId] }),
  })

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        await erpClient.raw.post(`/attachments/${model}/${resId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      queryClient.invalidateQueries({ queryKey: ['attachments', model, resId] })
    } catch (e: unknown) {
      toast.error('Upload Failed', extractErrorMessage(e, 'Could not upload attachment'))
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = (attachmentId: number, _name: string) => {
    window.open(`/api/v1/attachments/${attachmentId}/download`, '_blank')
  }

  const handlePreview = (attachment: AttachmentRecord) => {
    const mimetype = attachment.mimetype || ''
    if (mimetype.startsWith('image/') || mimetype.includes('pdf')) {
      setPreview({
        url: `/api/v1/attachments/${attachment.id}/download`,
        name: attachment.name,
        type: mimetype,
      })
    }
  }

  const attachments = data?.records || []

  return (
    <div className={cn('rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Attachments</span>
          {attachments.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-[10px]">{attachments.length}</Badge>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3 w-3" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="px-6 py-4"
        onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
      >
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading attachments...</div>
        ) : attachments.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Drop files here or click Upload
          </div>
        ) : (
          <div className="space-y-1.5">
            {(attachments as AttachmentRecord[]).map((att) => {
              const mt = typeof att.mimetype === 'string' ? att.mimetype : ''
              const Icon = getFileIcon(mt)
              const canPreview = mt.startsWith('image/') || mt.includes('pdf')
              return (
                <div key={att.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/30 transition-colors group">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <button
                    className={cn('flex-1 text-left text-sm truncate', canPreview && 'hover:text-primary cursor-pointer')}
                    onClick={() => canPreview ? handlePreview(att) : handleDownload(att.id, att.name)}
                  >
                    {att.name}
                  </button>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(typeof att.file_size === 'number' ? att.file_size : 0)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleDownload(att.id, att.name)}
                      className="rounded-lg p-1 hover:bg-accent transition-colors"
                      title="Download"
                      aria-label={`Download ${att.name}`}
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('Delete this attachment?')) deleteMut.mutate(att.id) }}
                      className="rounded-lg p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                      aria-label={`Delete ${att.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null) }}>
        <DialogContent className="max-w-[90vw] w-auto p-0 overflow-hidden">
          <DialogHeader className="px-4 py-2 border-b border-border/70 pr-10">
            <DialogTitle className="text-sm font-medium truncate text-left">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (preview.type.startsWith('image/') ? (
            <img src={preview.url} alt={preview.name} className="max-h-[80vh] object-contain" />
          ) : (
            <iframe src={preview.url} className="h-[80vh] w-[70vw]" title={preview.name} />
          ))}
        </DialogContent>
      </Dialog>
    </div>
  )
}
