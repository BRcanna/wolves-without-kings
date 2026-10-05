# Acceptance matrix

| Gate | Evidence | Status |
| --- | --- | --- |
| Canonical state has stable IDs and revisions | `engine.mjs`, contiguous-revision test | PASS |
| Stale proposals fail closed | `StaleRevisionError`, no-mutation test | PASS |
| Events carry causal/provenance metadata | event construction and hash-chain test | PASS |
| World time is transactional | time-advance test | PASS |
| Save/restore preserves history | snapshot/restore equality test | PASS |
| Tampered history is rejected | restore tamper test | PASS |
| One authored district | `district.mjs`, fixture integrity tests | PASS |
| Layered deterministic traversal | traversal path tests for walk/climb/service boundaries | PASS |
| Bounded social relationship projection | `resolveSocialContact`, projection test | PASS |
| Character identity and canonical condition | character creation and condition tests | PASS |
| History-based hidden skill progression | skill threshold test | PASS |
| Familiarity and body-state persistence | bounded-state and restore tests | PASS |
| Deep NPC/relationship simulation | no implementation yet | OPEN |
| Single-player vertical slice | no implementation yet | OPEN |
| Online underworld | explicitly deferred | OPEN |

This matrix is evidence for the current foundation slice, not a claim that the overall docuseries goal is complete.
