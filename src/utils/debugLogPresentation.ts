export type DebugLogKind = 'maafw' | 'agent' | 'software'
export type DebugLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'system'

export interface PresentedDebugLog {
  time: string
  level: DebugLogLevel
  levelLabel: string
  source: string
  message: string
  metadata: string
  raw: string
}

const levelMap: Record<string, DebugLogLevel> = {
  trc: 'trace',
  trace: 'trace',
  dbg: 'debug',
  debug: 'debug',
  inf: 'info',
  info: 'info',
  wrn: 'warn',
  warn: 'warn',
  warning: 'warn',
  err: 'error',
  error: 'error',
  fatal: 'error',
  ftl: 'error',
  system: 'system',
}

const levelLabels: Record<DebugLogLevel, string> = {
  trace: 'TRC',
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
  system: 'SYS',
}

const normalizeLevel = (value: string): DebugLogLevel =>
  levelMap[value.trim().toLowerCase()] || 'info'

const formatTime = (value: string) => {
  const timeMatch = value.match(/(?:T|\s)(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/)
  return timeMatch?.[1] || value
}

const createPresentedLog = (
  raw: string,
  time: string,
  levelValue: string,
  source: string,
  message: string,
  metadata = ''
): PresentedDebugLog => {
  const level = normalizeLevel(levelValue)
  return {
    time: formatTime(time),
    level,
    levelLabel: levelLabels[level],
    source,
    message: message.trim() || raw,
    metadata,
    raw,
  }
}

const parseMaaFwLog = (raw: string) => {
  const match = raw.match(
    /^\[([^\]]+)\]\[([^\]]+)\]\[P[^\]]*\]\[T[^\]]*\]\[([^\]]+)\]\[L([^\]]+)\]\[([^\]]+)\]\s*(.*)$/s
  )
  if (!match) return null
  const [, time, level, file, line, scope, message] = match
  const shortScope = scope.split('::').pop() || scope
  return createPresentedLog(raw, time, level, `${file}:${line}`, message, shortScope)
}

const parseAgentLog = (raw: string) => {
  const match = raw.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s*(.*)$/s)
  if (!match) return null
  const [, outerTime, stream, content] = match
  try {
    const payload = JSON.parse(content) as Record<string, unknown>
    const level = typeof payload.level === 'string' ? payload.level : stream
    const time = typeof payload.time === 'string' ? payload.time : outerTime
    const message = typeof payload.message === 'string' ? payload.message : content
    const metadata = Object.fromEntries(
      Object.entries(payload).filter(([key]) => !['level', 'time', 'message'].includes(key))
    )
    return createPresentedLog(
      raw,
      time,
      level,
      `Agent · ${stream}`,
      message,
      Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : ''
    )
  } catch {
    return createPresentedLog(raw, outerTime, stream, `Agent · ${stream}`, content)
  }
}

const parseSoftwareLog = (raw: string) => {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>
    const time = typeof payload.ts === 'string' ? payload.ts : ''
    const level = typeof payload.level === 'string' ? payload.level : 'info'
    const target = typeof payload.target === 'string' ? payload.target : 'software'
    const message = typeof payload.message === 'string' ? payload.message : raw
    const fields =
      payload.fields && typeof payload.fields === 'object' ? JSON.stringify(payload.fields) : ''
    return createPresentedLog(raw, time, level, target, message, fields)
  } catch {
    // Older log API responses used the formatted bracket representation.
  }
  const match = raw.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]*)\]\s*(.*)$/s)
  if (!match) return null
  const [, time, level, target, message] = match
  return createPresentedLog(raw, time, level, target || 'software', message)
}

export const presentDebugLog = (kind: DebugLogKind, raw: string): PresentedDebugLog => {
  const parsed =
    kind === 'maafw'
      ? parseMaaFwLog(raw)
      : kind === 'agent'
        ? parseAgentLog(raw)
        : parseSoftwareLog(raw)
  return parsed || createPresentedLog(raw, '', 'info', kind, raw)
}
