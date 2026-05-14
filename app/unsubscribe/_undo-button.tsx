'use client'

import { useState, useEffect } from 'react'

interface UndoButtonProps {
  token: string
}

export function UndoButton({ token }: UndoButtonProps) {
  const [visible, setVisible] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 30000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible || done) return null

  async function handleUndo() {
    await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'undo' }),
    })
    setDone(true)
    setVisible(false)
  }

  return (
    <button
      type="button"
      onClick={handleUndo}
      className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
    >
      Undo →
    </button>
  )
}
