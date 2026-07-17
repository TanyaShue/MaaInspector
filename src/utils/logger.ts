import { invoke } from '@tauri-apps/api/core'

type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error'

interface FrontendLogEntry {
  ts: string
  level: LogLevel
  target: string
  message: string
  fields: unknown
}

const BATCH_SIZE = 50
const FLUSH_DELAY_MS = 250
const MAX_QUEUE_SIZE = 500

const originalConsole: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {}
let installed = false
let isFlushing = false
let flushTimer: ReturnType<typeof setTimeout> | null = null
let queue: FrontendLogEntry[] = []

const consoleLevels: LogLevel[] = ['debug', 'info', 'log', 'warn', 'error']

export function installFrontendLogger() {
  if (installed) return
  installed = true

  for (const level of consoleLevels) {
    const original = console[level]?.bind(console) as ((...args: unknown[]) => void) | undefined
    originalConsole[level] = original
    console[level] = (...args: unknown[]) => {
      if (isStaleTauriCallbackWarning(args)) return
      original?.(...args)
      enqueueLog(level, 'console', buildMessage(args), { args: serializeArgs(args) })
    }
  }
}

function isStaleTauriCallbackWarning(args: unknown[]) {
  return args.some(arg =>
    typeof arg === 'string' &&
    arg.includes("[TAURI] Couldn't find callback id") &&
    arg.includes('app is reloaded while Rust is running an asynchronous operation')
  )
}

export function uninstallFrontendLogger() {
  if (!installed) return
  for (const level of consoleLevels) {
    const original = originalConsole[level]
    if (original) console[level] = original as typeof console[typeof level]
  }
  installed = false
  originalConsole.debug = undefined
  originalConsole.info = undefined
  originalConsole.log = undefined
  originalConsole.warn = undefined
  originalConsole.error = undefined
  queue = []
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

export function logDebug(target: string, message: string, fields?: unknown) {
  enqueueLog('debug', target, message, fields)
}

export function logInfo(target: string, message: string, fields?: unknown) {
  enqueueLog('info', target, message, fields)
}

export function logWarn(target: string, message: string, fields?: unknown) {
  enqueueLog('warn', target, message, fields)
}

export function logError(target: string, message: string, fields?: unknown) {
  enqueueLog('error', target, message, fields)
}

export async function flushFrontendLogs() {
  if (isFlushing || queue.length === 0) return
  isFlushing = true
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  const entries = queue.splice(0, BATCH_SIZE)
  try {
    await invoke('log_frontend_batch', { entries })
  } catch {
    // Logging must never affect the app. Drop failed batches silently.
  } finally {
    isFlushing = false
    if (queue.length > 0) scheduleFlush()
  }
}

export function serializeForLog(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
  }

  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (typeof value === 'symbol') return value.toString()
  if (value === undefined) return '[undefined]'

  try {
    const seen = new WeakSet<object>()
    return JSON.parse(JSON.stringify(value, (_key, innerValue: unknown) => {
      if (innerValue instanceof Error) return serializeForLog(innerValue)
      if (typeof innerValue === 'bigint') return innerValue.toString()
      if (typeof innerValue === 'function') return `[Function ${innerValue.name || 'anonymous'}]`
      if (typeof innerValue === 'symbol') return innerValue.toString()
      if (typeof innerValue === 'object' && innerValue !== null) {
        if (seen.has(innerValue)) return '[Circular]'
        seen.add(innerValue)
      }
      return innerValue
    }))
  } catch {
    return String(value)
  }
}

function enqueueLog(level: LogLevel, target: string, message: string, fields?: unknown) {
  queue.push({
    ts: new Date().toISOString(),
    level,
    target,
    message,
    fields: serializeForLog(fields ?? {})
  })

  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE)
  }

  scheduleFlush()
}

function scheduleFlush() {
  if (flushTimer || isFlushing) return
  flushTimer = setTimeout(() => {
    void flushFrontendLogs()
  }, FLUSH_DELAY_MS)
}

function buildMessage(args: unknown[]) {
  return args.map(arg => {
    if (typeof arg === 'string') return arg
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`
    try {
      return JSON.stringify(serializeForLog(arg))
    } catch {
      return String(arg)
    }
  }).join(' ')
}

function serializeArgs(args: unknown[]) {
  return args.map(arg => serializeForLog(arg))
}
