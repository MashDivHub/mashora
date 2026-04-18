import { useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Skeleton, cn } from '@mashora/design-system'
import { Upload, Paperclip, Download, Trash2, FileText, FileImage, File as FileIcon } from 'lucide-react'
import { toast } from './Toast'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'

export interface AttachmentSectionProps {
  resModel: string
  resId: number | null
  readonly?: boolean
  /** Optional label override for the section title. */
  title?: string
}

interface AttachmentRecord {
  id: number
  name: string
  file_size?: number
  mimetype?: string
  create_date?: string
}

function fmtSize(n?: number): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function iconFor(mimetype?: string) {
  if (!mimetype) return <FileIcon className="h-4 w-4 text-muted-foreground" />
  if (mimetype.startsWith('image/')) return <FileImage className="h-4 w-4 text-violet-400" />
  if (mimetype.includes('pdf') || mimetype.includes('text') || mimetype.includes('word'))
    return <FileText className="h-4 w-4 text-sky-400" />
  return <FileIcon className="h-4 w-4 text-muted-foreground" />
}

export default function AttachmentSection({
  resModel, resId, readonly = false, title = 'Attachments',
}: AttachmentSectionProps) {
  const queryClient = useQueryClient()
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const enabled = !!resId && resId > 0
  const queryKey = ['attachments', resModel, resId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!enabled) return [] as AttachmentRecord[]
      const { data } = await erpClient.raw.post('/model/ir.attachment', {
        domain: [['res_model', '=', resModel], ['res_id', '=', resId]],
        fields: ['id', 'name', 'file_size', 'mimetype', 'create_date'],
        order: 'create_date desc',
        limit: 200,
      })
      return (data?.records || []) as AttachmentRecord[]
    },
    enabled,
    staleTime: 30 * 1000,
  })

  const attachments = data || []

  const uploadOne = useCallback(async (file: File) => {
    if (!resId) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('res_model', resModel)
    fd.append('res_id', String(resId))
    await erpClient.raw.post('/attachments/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }, [resModel, resId])

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!resId) {
      toast.error('Save first', 'Save the record before adding attachments.')
      return
    }
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading(true)
    try {
      for (const f of arr) {
        try { await uploadOne(f) }
        catch (e: unknown) { toast.error('Upload Failed', `${f.name}: ${extractErrorMessage(e, 'unknown')}`) }
      }
      toast.success('Uploaded', `${arr.length} file(s) attached`)
      queryClient.invalidateQueries({ queryKey })
    } finally {
      setUploading(false)
    }
  }, [resId, uploadOne, queryClient, queryKey])

  const onPickFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void handleUpload(e.target.files)
    e.target.value = ''
  }, [handleUpload])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) void handleUpload(e.dataTransfer.files)
  }, [handleUpload])

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await erpClient.raw.delete(`/model/ir.attachment/${id}`)
    },
    onSuccess: () => {
      toast.success('Deleted', 'Attachment removed')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (e: unknown) => toast.error('Delete Failed', extractErrorMessage(e)),
  })

  const downloadHref = (id: number) => `/api/v1/attachments/${id}/download`

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Save this record to enable attachments.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" /> {title}
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({attachments.length})</span>
          )}
        </h3>
        {!readonly && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5 text-xs h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3 w-3" /> {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
      </div>

      {!readonly && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center transition-colors cursor-pointer',
            dragOver ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border',
          )}
        >
          <Upload className={cn('h-5 w-5 mx-auto mb-1.5', dragOver ? 'text-primary' : 'text-muted-foreground/50')} />
          <p className="text-xs text-muted-foreground">
            {dragOver ? 'Drop to upload' : 'Drag & drop files here, or click to browse'}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No attachments yet</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card hover:bg-muted/20 px-3 py-2 transition-colors"
            >
              <div className="shrink-0">{iconFor(att.mimetype)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={att.name}>{att.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {att.file_size ? <span>{fmtSize(att.file_size)}</span> : null}
                  {att.create_date && (
                    <span>{new Date(att.create_date.replace(' ', 'T') + (att.create_date.includes('Z') ? '' : 'Z')).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <a
                href={downloadHref(att.id)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {!readonly && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Delete "${att.name}"?`)) return
                    deleteMut.mutate(att.id)
                  }}
                  disabled={deleteMut.isPending}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
