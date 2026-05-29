import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Prompt } from '../../../shared/ipc'
import type { BrowserTotals, View } from './types'
import {
  buildFolderTree,
  isArchive,
  isHygiene,
  isUnderFolder,
  recentSort
} from './utils'
import HomeView from './HomeView'
import PromptDetail from './PromptDetail'
import PromptList from './PromptList'
import Sidebar from './Sidebar'

export default function LibraryBrowser(): JSX.Element {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'home' })
  const [selectedRelPath, setSelectedRelPath] = useState<string | null>(null)

  const refresh = useCallback(async (mode: 'initial' | 'manual'): Promise<void> => {
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const result = await window.api.scanLibrary()
      setPrompts(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      if (mode === 'initial') setLoading(false)
      else setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh('initial')
  }, [refresh])

  const folderTree = useMemo(() => buildFolderTree(prompts), [prompts])
  const archiveList = useMemo(() => prompts.filter(isArchive), [prompts])
  const hygieneList = useMemo(() => prompts.filter(isHygiene), [prompts])

  const totals = useMemo<BrowserTotals>(
    () => ({
      all: prompts.length,
      recent: prompts.length,
      archive: archiveList.length,
      hygiene: hygieneList.length
    }),
    [prompts.length, archiveList.length, hygieneList.length]
  )

  const filtered = useMemo<Prompt[]>(() => {
    switch (view.kind) {
      case 'home':
        return []
      case 'all':
        return [...prompts].sort((a, b) => a.relPath.localeCompare(b.relPath))
      case 'recent':
        return [...prompts].sort(recentSort)
      case 'archive':
        return [...archiveList].sort((a, b) => a.relPath.localeCompare(b.relPath))
      case 'hygiene':
        return [...hygieneList].sort((a, b) => a.relPath.localeCompare(b.relPath))
      case 'folder':
        return prompts
          .filter((p) => isUnderFolder(p, view.folder))
          .sort((a, b) => a.relPath.localeCompare(b.relPath))
    }
  }, [view, prompts, archiveList, hygieneList])

  // If the selected prompt is no longer in the current filter (e.g. user
  // switched view, or refresh removed the file), drop selection rather than
  // leave the detail pane lying about an out-of-view file.
  useEffect(() => {
    if (selectedRelPath && !filtered.some((p) => p.relPath === selectedRelPath)) {
      setSelectedRelPath(null)
    }
  }, [filtered, selectedRelPath])

  const selectedPrompt = useMemo<Prompt | null>(
    () => prompts.find((p) => p.relPath === selectedRelPath) ?? null,
    [prompts, selectedRelPath]
  )

  const emptyMessage = useMemo(() => {
    switch (view.kind) {
      case 'home':
        return ''
      case 'all':
      case 'recent':
        return 'No prompts here.'
      case 'archive':
        return 'No archived prompts.'
      case 'hygiene':
        return 'All prompts have complete metadata.'
      case 'folder':
        return 'No prompts in this folder.'
    }
  }, [view])

  if (loading) {
    return (
      <div className="library-loading">
        <p className="dim">Scanning library...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="library-error">
        <h2>Could not load library</h2>
        <pre className="onboarding-error">{error}</pre>
        <button
          type="button"
          onClick={() => void refresh('manual')}
          className="onboarding-primary"
        >
          Try again
        </button>
      </div>
    )
  }

  const onOpen = (relPath: string): void => {
    setSelectedRelPath(relPath)
    if (view.kind === 'home') setView({ kind: 'all' })
  }

  return (
    <div className="library-browser">
      <Sidebar
        view={view}
        totals={totals}
        folderTree={folderTree}
        onView={setView}
        onRefresh={() => void refresh('manual')}
        refreshing={refreshing}
      />

      <main className="library-main">
        {view.kind === 'home' ? (
          <HomeView
            prompts={prompts}
            onOpen={onOpen}
            onView={(k) => setView({ kind: k })}
          />
        ) : prompts.length === 0 ? (
          <div className="library-empty">
            <h2>Your library is empty</h2>
            <p className="dim">
              Phase 4 will let you paste and classify prompts. For now, drop Markdown
              files in your library root and click Refresh.
            </p>
          </div>
        ) : (
          <PromptList
            prompts={filtered}
            selectedRelPath={selectedRelPath}
            onSelect={setSelectedRelPath}
            emptyMessage={emptyMessage}
          />
        )}
      </main>

      {view.kind !== 'home' && (
        <PromptDetail
          prompt={selectedPrompt}
          onSaved={(newRelPath) => {
            // Rescan, then reselect the prompt at its (possibly new) path.
            void refresh('manual').then(() => setSelectedRelPath(newRelPath))
          }}
        />
      )}
    </div>
  )
}
