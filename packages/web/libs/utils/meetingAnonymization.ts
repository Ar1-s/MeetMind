import type { ActionItem, Meeting, MindmapData, Participant, Summary, TranscriptSegment } from '@/interfaces'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getAliasEntries = (meeting?: Meeting | null) => {
  if (!meeting?.anonymize_participants || !meeting.participant_aliases) {
    return []
  }

  return Object.entries(meeting.participant_aliases)
    .filter(([source, target]) => Boolean(source) && Boolean(target))
    .sort((a, b) => b[0].length - a[0].length)
}

export const replaceParticipantNames = (text: string | undefined, meeting?: Meeting | null) => {
  if (!text) {
    return text
  }

  return getAliasEntries(meeting).reduce((result, [source, target]) => {
    return result.replace(new RegExp(escapeRegExp(source), 'g'), target)
  }, text)
}

export const getDisplayParticipants = (meeting?: Meeting | null): Participant[] => {
  if (!meeting?.participants?.length) {
    return []
  }

  return meeting.participants.map((participant) => ({
    ...participant,
    name: replaceParticipantNames(participant.name, meeting) || participant.name,
    email: meeting.anonymize_participants ? undefined : participant.email,
  }))
}

const anonymizeActionItem = (item: ActionItem, meeting?: Meeting | null): ActionItem => ({
  ...item,
  title: replaceParticipantNames(item.title, meeting) || item.title,
  assignee: replaceParticipantNames(item.assignee, meeting),
})

const anonymizeTranscriptSegment = (
  segment: TranscriptSegment,
  meeting?: Meeting | null,
): TranscriptSegment => ({
  ...segment,
  speaker: replaceParticipantNames(segment.speaker, meeting) || segment.speaker,
  text: replaceParticipantNames(segment.text, meeting) || segment.text,
})

const anonymizeMindmap = (mindmap: MindmapData | undefined, meeting?: Meeting | null) => {
  if (!mindmap) {
    return mindmap
  }

  return {
    ...mindmap,
    nodes: mindmap.nodes.map((node) => ({
      ...node,
      label: replaceParticipantNames(node.label, meeting) || node.label,
      description: replaceParticipantNames(node.description, meeting),
    })),
  }
}

export const getDisplaySummary = (summary: Summary | null, meeting?: Meeting | null): Summary | null => {
  if (!summary) {
    return null
  }

  if (!meeting?.anonymize_participants) {
    return summary
  }

  return {
    ...summary,
    abstract: replaceParticipantNames(summary.abstract, meeting),
    decisions: (summary.decisions || []).map(
      (decision) => replaceParticipantNames(decision, meeting) || decision,
    ),
    risks: (summary.risks || []).map((risk) => replaceParticipantNames(risk, meeting) || risk),
    action_items: (summary.action_items || []).map((item) => anonymizeActionItem(item, meeting)),
    transcript: summary.transcript?.map((segment) => anonymizeTranscriptSegment(segment, meeting)),
    mindmap: anonymizeMindmap(summary.mindmap, meeting),
  }
}
