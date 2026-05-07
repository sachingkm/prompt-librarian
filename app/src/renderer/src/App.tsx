import { useCallback, useEffect, useState } from 'react'
import type { CheckRootResult } from '../../shared/ipc'
import Onboarding from './Onboarding'
import MainShell from './MainShell'

type Stage = 'booting' | 'onboarding' | 'main'

function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>('booting')
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<CheckRootResult | null>(null)

  const refreshBoot = useCallback(async () => {
    const result = await window.api.checkRoot()
    setCheckResult(result)
    if (result.ok) {
      setRootPath(result.rootPath)
      setStage('main')
    } else {
      setRootPath(null)
      setStage('onboarding')
    }
  }, [])

  useEffect(() => {
    void refreshBoot()
  }, [refreshBoot])

  const onOnboardingComplete = useCallback((p: string) => {
    setRootPath(p)
    setCheckResult({ ok: true, rootPath: p })
    setStage('main')
  }, [])

  const onRootChangedFromMain = useCallback((p: string) => {
    setRootPath(p)
    setCheckResult({ ok: true, rootPath: p })
  }, [])

  const onRequestOnboarding = useCallback(() => {
    // User explicitly chose to pick a different library from the main shell.
    setCheckResult({ ok: false, rootPath, reason: 'unset' })
    setStage('onboarding')
  }, [rootPath])

  if (stage === 'booting') {
    return (
      <div className="boot-splash">
        <div className="boot-splash-text">Prompt Librarian</div>
        <div className="dim">Loading...</div>
      </div>
    )
  }

  if (stage === 'onboarding' || !rootPath) {
    const ctx: CheckRootResult = checkResult ?? { ok: false, rootPath: null, reason: 'unset' }
    return <Onboarding checkResult={ctx} onComplete={onOnboardingComplete} />
  }

  return (
    <MainShell
      rootPath={rootPath}
      onRootChanged={onRootChangedFromMain}
      onChangeRoot={onRequestOnboarding}
    />
  )
}

export default App
