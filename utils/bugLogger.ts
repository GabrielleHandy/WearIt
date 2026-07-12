// Lightweight in-memory log buffer for bug reports. Captures recent
// console.error/console.warn calls plus anything logged manually via
// logError(), and formats it into a text block for an email body.
// No backend, no persistence across restarts — this catches "what just
// happened," it's not a crash-analytics pipeline.

import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

type LogEntry = {
  level: 'error' | 'warn' | 'manual'
  message: string
  timestamp: string
}

const MAX_ENTRIES = 25
const buffer: LogEntry[] = []

function push(level: LogEntry['level'], args: unknown[]) {
  const message = args
    .map(a => (typeof a === 'string' ? a : safeStringify(a)))
    .join(' ')

  buffer.push({ level, message, timestamp: new Date().toISOString() })
  if (buffer.length > MAX_ENTRIES) buffer.shift()
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

let installed = false

/**
 * Call once, near app startup (top of app/_layout.tsx), to start capturing
 * console.error / console.warn into the buffer. Every existing console.error
 * and console.warn call already in the codebase (Lambda failures, Claude
 * errors, model adapter failures, etc.) gets picked up automatically.
 */
export function installBugLogger() {
  if (installed) return
  installed = true

  const originalError = console.error
  const originalWarn = console.warn

  console.error = (...args: unknown[]) => {
    push('error', args)
    originalError(...args)
  }

  console.warn = (...args: unknown[]) => {
    push('warn', args)
    originalWarn(...args)
  }
}

/** Manually log something into the bug report buffer (e.g. inside a catch block). */
export function logError(message: string, error?: unknown) {
  const detail = error instanceof Error ? `${message}: ${error.message}` : message
  push('manual', [detail])
}

/** Clears the buffer — call after a report is successfully sent for a clean slate. */
export function clearBugLog() {
  buffer.length = 0
}

function deviceInfoBlock(): string {
  return [
    `App version: ${Constants.expoConfig?.version ?? 'unknown'}`,
    `Platform: ${Platform.OS} ${Platform.Version}`,
    `Device: ${Device.modelName ?? 'unknown'}`,
  ].join('\n')
}

/**
 * Builds the full report body: device info + recent captured logs.
 * Combine this with the user's typed description before sending.
 */
export function buildLogReport(): string {
  const logsText = buffer.length
    ? buffer
        .map(e => `[${e.timestamp}] (${e.level.toUpperCase()}) ${e.message}`)
        .join('\n')
    : '(no errors/warnings captured this session)'

  return `--- Device Info ---\n${deviceInfoBlock()}\n\n--- Recent Logs (last ${MAX_ENTRIES}) ---\n${logsText}`
}
