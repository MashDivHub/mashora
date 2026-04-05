import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Badge, cn } from '@mashora/design-system'
import { Paperclip, Upload, Download, Trash2, Image, FileText, File as FileIcon, X } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

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
    } catch (e) {
      console.error('Upload failed:', e)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = (attachmentId: number, _name: string) => {
    window.open(`/api/v1/attachments/${attachmentId}/download`, '_blank')
  }

  const handlePreview = (attachment: any) => {
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
    <div className={cn('rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden', className)}>
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
            {attachments.map((att: any) => {
              const Icon = getFileIcon(att.mimetype)
              const canPreview = att.mimetype?.startsWith('image/') || att.mimetype?.includes('pdf')
              return (
                <div key={att.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/30 transition-colors group">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <button
                    className={cn('flex-1 text-left text-sm truncate', canPreview && 'hover:text-primary cursor-pointer')}
                    onClick={() => canPreview ? handlePreview(att) : handleDownload(att.id, att.name)}
                  >
                    {att.name}
                  </button>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(att.file_size)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(att.id, att.name)}
                      className="rounded-lg p-1 hover:bg-accent transition-colors"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Delete this attachment?')) deleteMut.mutate(att.id) }}
                      className="rounded-lg p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
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
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-card overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-2">
              <span className="text-sm font-medium truncate">{preview.name}</span>
              <button onClick={() => setPreview(null)} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            {preview.type.startsWith('image/') ? (
              <img src={preview.url} alt={preview.name} className="max-h-[80vh] object-contain" />
            ) : (
              <iframe src={preview.url} className="h-[80vh] w-[70vw]" title={preview.name} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
