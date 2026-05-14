'use server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { submitMisclassificationFeedback as submit } from './misclassification'

const inputSchema = z.object({
  tech_key: z.string().min(1).max(60),
  territory_type: z.enum([
    'frontend_land',
    'backend_fortress',
    'data_pipeline_zone',
    'testing_lab',
    'devops_harbor',
    'docs_library',
  ]),
  related_repo_id: z.string().uuid().nullable(),
  category: z.enum(['wrong_category', 'shouldnt_be_lit', 'not_mine', 'other']),
  note: z.string().max(2000).nullable(),
})

export async function submitMisclassificationFeedback(
  input: z.infer<typeof inputSchema>,
) {
  const user = await requireUser()
  const parsed = inputSchema.parse(input)
  return submit({ userId: user.id, ...parsed })
}
