# SpaceGuard Agent Design

The agent is advisory. It receives redacted real scan context, route readiness, runtime capability state, and proof status. It returns structured advice for the next review step.

The OpenAI integration is advisory, not an executor.

## Boundaries

- The agent cannot execute cleanup.
- The agent cannot approve consent.
- The agent cannot unlock executor flags.
- The agent cannot receive raw local paths unless they have been redacted by the renderer or native command.

## Workflow

1. Native scan measures known cleanup roots and manual-review findings.
2. Renderer builds a real cleanup queue from native findings only.
3. User selects one ready route.
4. App checks native runtime capability, single scoped feature flag state, current scan evidence, and consent.
5. Native executor runs the selected route.
6. User runs a post-run rescan.
7. App exports selected-route and workflow proof packets.
8. Verifiers decide whether the proof is acceptable for the next route.

## OpenAI Context

The OpenAI request uses `spaceguard-openai-agent-context/v1`. It includes route IDs, byte counts, statuses, feature-flag readiness, consent state, and redacted path hints. It does not include direct filesystem authority.

## Product Rule

If the desktop bridge is missing, the app renders setup instructions only. Real scanning and cleanup happen only inside the Windows desktop app.
