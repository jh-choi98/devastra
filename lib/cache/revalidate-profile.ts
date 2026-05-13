import 'server-only'

import { revalidatePath } from 'next/cache'

export function revalidatePublicProfile(username: string): void {
  revalidatePath('/' + username)
}
