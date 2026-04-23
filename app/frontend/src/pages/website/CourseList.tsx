import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@mashora/design-system'
import { BookOpen, Users, Eye, Film, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface SlideChannel {
  id: number
  name: string
  description: string | false
  website_published: boolean
  total_slides: number
  total_views: number
  nbr_participants: number
  slide_category_data: unknown
}

interface ChannelResponse {
  records: SlideChannel[]
  total: number
}

function StatPill({ icon, value }: { icon: React.ReactNode; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export default function CourseList() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery<ChannelResponse>({
    queryKey: ['elearning-courses'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/slide.channel', {
        fields: [
          'id', 'name', 'description', 'website_published',
          'total_slides', 'total_views', 'nbr_participants', 'slide_category_data',
        ],
        order: 'name asc',
        limit: 50,
      })
      return data
    },
  })

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="eLearning Courses" subtitle="website" />
        <div className="rounded-2xl border border-border/30 bg-card/50 p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-muted-foreground">eLearning module not installed</p>
        </div>
      </div>
    )
  }

  const courses = data?.records ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="eLearning Courses"
        subtitle="website"
        onNew={() => navigate('/admin/model/slide.channel/new')}
        newLabel="New Course"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No courses yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first online course to start publishing learning content.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/slide.channel/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Course
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courses.map((course) => (
            <button
              type="button"
              key={course.id}
              onClick={() => navigate(`/admin/model/slide.channel/${course.id}`)}
              className="rounded-2xl border border-border/30 bg-card/50 p-5 hover:bg-card/80 hover:-translate-y-0.5 transition-all space-y-3 text-left w-full"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2">{course.name}</h3>
                <Badge
                  variant={course.website_published ? 'success' : 'secondary'}
                  className="rounded-full text-xs shrink-0"
                >
                  {course.website_published ? 'Published' : 'Draft'}
                </Badge>
              </div>

              {course.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
              )}

              <div className="flex items-center gap-4 pt-1">
                <StatPill icon={<Film className="h-3.5 w-3.5" />}    value={`${course.total_slides ?? 0} slides`} />
                <StatPill icon={<Users className="h-3.5 w-3.5" />}   value={`${course.nbr_participants ?? 0} enrolled`} />
                <StatPill icon={<Eye className="h-3.5 w-3.5" />}     value={`${course.total_views ?? 0} views`} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
