import 'server-only'

import { Resend } from 'resend'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!)
  }
  return _resend
}

// Named export for direct use; instantiates lazily at call time
export const resend = {
  get emails() {
    return getResend().emails
  },
}
