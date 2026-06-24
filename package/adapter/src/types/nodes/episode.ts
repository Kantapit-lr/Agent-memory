export interface Episode {
  organizationId: string
  id: string
  timestamp: string
  source: string
  summary: string
}

export interface CheckEpisodeInput {
  organizationId: string
  episodeId: string
}

export interface CheckEpisodesExistInput {
  organizationId: string
  episodeIds: string[]
}