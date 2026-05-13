import { createClient } from '@supabase/supabase-js'
import { renderRecapImage, renderPrivatePlaceholder } from '@/lib/og/RecapImage'
import type { RecapHighlights } from '@/lib/og/RecapImage'

export const runtime = 'edge'

export async function GET(
  _req: Request,
  { params }: { params: { recap_id: string } },
) {
  const { recap_id } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: recap, error } = await supabase
    .from('weekly_recaps')
    .select('id, user_id, week_start, highlights')
    .eq('id', recap_id)
    .maybeSingle()

  if (error || !recap) {
    return renderPrivatePlaceholder()
  }

  const { data: user } = await supabase
    .from('users_public_view')
    .select('display_username, avatar_url')
    .eq('id', recap.user_id)
    .maybeSingle()

  if (!user) {
    return renderPrivatePlaceholder()
  }

  const imageResponse = renderRecapImage({
    displayUsername: user.display_username,
    avatarUrl: user.avatar_url,
    weekStart: recap.week_start,
    highlights: recap.highlights as RecapHighlights,
  })

  // Recap IDs are immutable — cache indefinitely
  return new Response(imageResponse.body, {
    status: imageResponse.status,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
