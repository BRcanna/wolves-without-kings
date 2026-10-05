# Cross-System Architecture Map

```text
                        PLAYER / NPC / ONLINE INPUT
                                  |
                                  v
                         intent / proposal layer
                                  |
                  +---------------+---------------+
                  |                               |
                  v                               v
         character capability              social / org policy
        condition + skill + rust          belief + relationship + role
                  |                               |
                  +---------------+---------------+
                                  v
                         authoritative VANTA World
                         revision-bound admission
                                  |
                                  v
                        committed domain event(s)
                                  |
     +-------------+--------------+--------------+--------------+
     |             |              |              |              |
     v             v              v              v              v
 relationships   economy       police/cases    world memory   trophies
 beliefs/rumor   markets/org   evidence        region aging   provenance
     |             |              |              |              |
     +-------------+--------------+--------------+--------------+
                                  |
                                  v
                         scoped presentation/UI
```

## Ownership doctrine

World truth, character state, belief/social state, organization policy, evidence/case state and presentation are separate ownership domains. They communicate through stable IDs, snapshots/projections and committed events. They do not obtain arbitrary cross-write access.

The separation is necessary for both design freedom and online security: an NPC can believe a lie, a police case can be uncertain, and the renderer/UI can present incomplete information while authoritative world state remains coherent.
