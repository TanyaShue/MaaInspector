import { describe, expect, it } from 'vitest'
import { presentDebugLog } from '@/utils/debugLogPresentation'

describe('debugLogPresentation', () => {
  it('parses MaaFramework log components', () => {
    const log = presentDebugLog(
      'maafw',
      '[2026-07-20 09:53:22.631][WRN][Px23768][Tx37958][ControllerAgent.cpp][L493][MaaNS::ControllerNS::ControllerAgent::handle_swipe] touch not supported'
    )

    expect(log).toMatchObject({
      time: '09:53:22.631',
      level: 'warn',
      levelLabel: 'WRN',
      source: 'ControllerAgent.cpp:493',
      message: 'touch not supported',
      metadata: 'handle_swipe',
    })
  })

  it('parses the nested JSON written by an Agent process', () => {
    const log = presentDebugLog(
      'agent',
      '[2026-07-20T09:52:18.268+08:00] [stderr] {"level":"info","socketID":"demo","time":"2026-07-20T09:52:18+08:00","message":"Starting agent server"}'
    )

    expect(log).toMatchObject({
      time: '09:52:18',
      level: 'info',
      source: 'Agent · stderr',
      message: 'Starting agent server',
      metadata: '{"socketID":"demo"}',
    })
  })

  it('keeps software log fields as structured metadata', () => {
    const log = presentDebugLog(
      'software',
      '{"fields":{"command":"agent_start","duration":7.3},"level":"warn","message":"Invoke failed","target":"api","ts":"2026-07-20T01:52:16.693Z"}'
    )

    expect(log).toMatchObject({
      time: '01:52:16.693',
      level: 'warn',
      source: 'api',
      message: 'Invoke failed',
      metadata: '{"command":"agent_start","duration":7.3}',
    })
  })
})
