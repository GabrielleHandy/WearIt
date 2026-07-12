import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { loadAIEnabled, saveAIEnabled } from '@/utils/storage'

type AIContextValue = {
  aiEnabled: boolean
  setAIEnabled: (enabled: boolean) => Promise<void>
  ready: boolean  // false until storage has been read
}

const AIContext = createContext<AIContextValue>({
  aiEnabled: true,
  setAIEnabled: async () => {},
  ready: false,
})

export function AIProvider({ children }: { children: ReactNode }) {
  const [aiEnabled, setAIEnabledState] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadAIEnabled().then(val => {
      setAIEnabledState(val)
      setReady(true)
    })
  }, [])

  const setAIEnabled = async (enabled: boolean) => {
    setAIEnabledState(enabled)
    await saveAIEnabled(enabled)
  }

  const value = useMemo<AIContextValue>(() => ({
    aiEnabled,
    setAIEnabled,
    ready,
  }), [aiEnabled, ready])

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>
}

export function useAI() {
  return useContext(AIContext)
}
