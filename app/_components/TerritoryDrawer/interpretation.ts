import type { TerritoryDrawerData } from '../TerritoryDrawer'

export function deriveInterpretation(data: TerritoryDrawerData): string {
  if (data.growth30d === 0) {
    return 'Steady territory — no new activity in 30 days'
  }
  if (data.topRepos.length === 1) {
    return `Recent focus: ${data.topRepos[0].owner}/${data.topRepos[0].name}`
  }
  return `Active across ${data.topRepos.length} repos this month`
}
