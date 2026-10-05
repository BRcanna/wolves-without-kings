import {
  StaleRevisionError,
  recordEvent,
} from "./engine.mjs";

export const ATOMIC_BATCH_SCHEMA_VERSION = 1;

export class AtomicBatchValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AtomicBatchValidationError";
  }
}

export class AtomicBatchStaleRevisionError extends AtomicBatchValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale atomic batch: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "AtomicBatchStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AtomicBatchValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new AtomicBatchValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function validateProposal(proposal, index) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) throw new AtomicBatchValidationError(`proposals[${index}] must be an object`);
  assertNonEmpty(proposal.eventType, `proposals[${index}].eventType`);
  for (const field of ["actors", "subjects"]) {
    if (proposal[field] !== undefined && (!Array.isArray(proposal[field]) || proposal[field].some((value) => typeof value !== "string" || value.trim() === ""))) {
      throw new AtomicBatchValidationError(`proposals[${index}].${field} must be string IDs`);
    }
  }
  if (proposal.payload !== undefined && (!proposal.payload || typeof proposal.payload !== "object" || Array.isArray(proposal.payload))) {
    throw new AtomicBatchValidationError(`proposals[${index}].payload must be an object`);
  }
}

export function executeAtomicEventBatch(world, { expectedRevision, actorId = "system:batch", proposals }) {
  assertInteger(expectedRevision, "expectedRevision");
  assertNonEmpty(actorId, "actorId");
  if (expectedRevision !== world.revision) throw new AtomicBatchStaleRevisionError(expectedRevision, world.revision);
  if (!Array.isArray(proposals) || proposals.length === 0 || proposals.length > 32) throw new AtomicBatchValidationError("proposals must contain 1 to 32 entries");
  proposals.forEach(validateProposal);

  const batchId = `batch:${world.worldId}:${String(world.nextEventId).padStart(6, "0")}`;
  let next = world;
  try {
    proposals.forEach((proposal, index) => {
      next = recordEvent(next, {
        expectedRevision: next.revision,
        eventType: proposal.eventType,
        actors: proposal.actors ?? [actorId],
        subjects: proposal.subjects ?? [],
        location: proposal.location ?? null,
        cause: proposal.cause ?? batchId,
        visibility: proposal.visibility ?? "local",
        payload: { ...clone(proposal.payload ?? {}), batchId, batchIndex: index },
      });
    });
  } catch (error) {
    if (error instanceof StaleRevisionError) throw new AtomicBatchStaleRevisionError(error.expectedRevision, error.actualRevision);
    throw new AtomicBatchValidationError(`atomic batch rejected: ${error.message}`);
  }
  return next;
}
