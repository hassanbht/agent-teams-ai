import type { CustomTeamTemplateMemberV1, CustomTeamTemplateV1 } from './template';
import type { CustomTeamTemplateWarning } from './warnings';

/**
 * Deterministic validation codes suitable for later UI localization.
 * Codes never encode prose and never silently truncate input.
 */
export type CustomTeamTemplateValidationIssueCode =
  | 'templateNameRequired'
  | 'templateNameTooLong'
  | 'templateNameInvalidCharacters'
  | 'templateDescriptionTooLong'
  | 'teamPromptTooLong'
  | 'tooManyMembers'
  | 'memberNameRequired'
  | 'memberNameInvalid'
  | 'duplicateMemberName'
  | 'memberRoleTooLong'
  | 'memberWorkflowTooLong'
  /** The requested source team identity is missing or not a valid team identity. */
  | 'sourceTeamNameInvalid'
  /** Confirm-save arrived without a usable preview token. */
  | 'previewTokenRequired'
  /** The preview token does not belong to any live preview (never issued, or already replaced). */
  | 'previewTokenUnknown'
  /** The preview token existed but passed its lifetime, so the confirmed projection is gone. */
  | 'previewTokenExpired';

export interface CustomTeamTemplateValidationIssue {
  code: CustomTeamTemplateValidationIssueCode;
  /** Stable field path, e.g. `name`, `description`, `teamPrompt`, `members[0].role`. */
  field: string;
}

/**
 * Exact content a prepare-preview step produced for a source team.
 *
 * `canonicalContent` is the deterministic serialization of exactly the content
 * that a confirm-save will persist, so the confirmed preview and the saved
 * record cannot drift.
 */
export interface CustomTeamTemplatePreviewContent {
  sourceTeamName: string;
  name: string;
  description?: string;
  teamPrompt: string;
  members: readonly CustomTeamTemplateMemberV1[];
  warnings: readonly CustomTeamTemplateWarning[];
  canonicalContent: string;
}

export interface CustomTeamTemplatePreview extends CustomTeamTemplatePreviewContent {
  /**
   * Opaque token issued by the preview step and echoed by confirm-save.
   * Generation, hashing and storage belong to later phases.
   */
  previewToken: string;
}

export interface PrepareCustomTeamTemplatePreviewRequest {
  /** Existing team whose saved configuration supplies the allowlisted content. */
  sourceTeamName: string;
  name: string;
  description?: string;
}

/**
 * Prepare-preview outcomes.
 *
 * `sourceUnavailable` (no readable team configuration) is distinct from
 * `rosterUnreadable` (configuration exists but member metadata cannot be read)
 * and from `storageUnavailable` (the template store itself is unreachable).
 */
export type PrepareCustomTeamTemplatePreviewResult =
  | { status: 'previewReady'; preview: CustomTeamTemplatePreview }
  | { status: 'sourceUnavailable'; sourceTeamName: string }
  | { status: 'rosterUnreadable'; sourceTeamName: string }
  | { status: 'validationFailed'; issues: readonly CustomTeamTemplateValidationIssue[] }
  | { status: 'nameConflict'; existingTemplateId: string }
  | { status: 'storageUnavailable' };

export interface ConfirmCustomTeamTemplateSaveRequest {
  previewToken: string;
  /**
   * Optional display-name override applied when the user confirms.
   *
   * The reviewed preview already carries a name, so this field exists only so a
   * future UI can let the user edit the name before saving. It is validated by
   * the trusted layer exactly like the prepare-time name, and it can never
   * alter the reviewed team content or rebind the preview to another team.
   *
   * Omitting it (or passing `undefined`) keeps the name the preview reviewed.
   */
  name?: string;
  /**
   * Optional description override applied when the user confirms.
   *
   * An empty or whitespace-only string clears the description; omitting the
   * field keeps the description the preview reviewed.
   */
  description?: string;
}

/**
 * A missing, unknown or expired preview token is reported through the closed
 * validation-code union rather than a dedicated status: the token is an input
 * field of the confirm request, not a workflow outcome.
 */

/**
 * Confirm-save outcomes.
 *
 * `created`/`alreadySaved` express idempotent creation; `stalePreview` means the
 * source configuration no longer matches what the user confirmed;
 * `templateIdConflict` means a different stored record already owns the
 * identity derived from the confirmed content; `unresolvedWriteOutcome` means
 * the write result is unknown and must be reconciled before retrying.
 *
 * `storageUnavailable` is the opposite guarantee to `unresolvedWriteOutcome`:
 * the store did not accept the write and no record exists for the template id
 * (unreachable worker, exhausted lock contention, or a failed write that a
 * reconciliation read confirmed absent). It never means "the write may have
 * happened", and it is never reported as success.
 */
export type ConfirmCustomTeamTemplateSaveResult =
  | { status: 'created'; template: CustomTeamTemplateV1 }
  | { status: 'alreadySaved'; template: CustomTeamTemplateV1 }
  | { status: 'stalePreview'; sourceTeamName: string }
  | { status: 'sourceUnavailable'; sourceTeamName: string }
  | { status: 'rosterUnreadable'; sourceTeamName: string }
  | { status: 'nameConflict'; existingTemplateId: string }
  | { status: 'templateIdConflict'; templateId: string }
  | { status: 'validationFailed'; issues: readonly CustomTeamTemplateValidationIssue[] }
  | { status: 'storageUnavailable' }
  | { status: 'unresolvedWriteOutcome'; templateId: string };

/**
 * Re-check an earlier confirmed save whose outcome stayed unresolved.
 *
 * The request carries nothing but the opaque operation reference the preview
 * already issued: the stable template id, the immutable request content and the
 * digest all come from retained server-side state, so a caller can never assert
 * content or identity. No write is attempted, so re-checking is always safe.
 */
export interface RecheckCustomTeamTemplateSaveRequest {
  previewToken: string;
}

/**
 * Re-check outcomes.
 *
 * `saved` is a confirmed success (the stored record is equivalent to the
 * operation), `templateIdConflict` means a different record owns the stable id,
 * `notSaved` is confirmed absence (no record exists for that id, so retrying the
 * same operation is safe), and `unresolved` means the store still cannot be
 * read, so the outcome stays honestly unknown. A record that exists but cannot
 * be reconstructed is always `unresolved`, never `notSaved`.
 */
export type RecheckCustomTeamTemplateSaveResult =
  | { status: 'saved'; template: CustomTeamTemplateV1 }
  | { status: 'templateIdConflict'; templateId: string }
  | { status: 'notSaved'; templateId: string }
  | { status: 'unresolved'; templateId: string }
  | { status: 'validationFailed'; issues: readonly CustomTeamTemplateValidationIssue[] }
  | { status: 'storageUnavailable' };

/**
 * Listing takes no parameters.
 */
export type ListCustomTeamTemplatesRequest = Record<string, never>;

export type CustomTeamTemplateUnreadableReason = 'unreadableRecord';

export interface CustomTeamTemplateUnreadableRecord {
  templateId: string;
  reason: CustomTeamTemplateUnreadableReason;
}

/**
 * List outcomes.
 *
 * `empty` is a valid empty library and must never be reported as
 * `storageUnavailable`. `hasUnreadableRecords` still returns every readable
 * template, so a partially unreadable library stays usable.
 */
export type ListCustomTeamTemplatesResult =
  | { status: 'empty' }
  | { status: 'ready'; templates: readonly CustomTeamTemplateV1[] }
  | {
      status: 'hasUnreadableRecords';
      templates: readonly CustomTeamTemplateV1[];
      unreadableRecords: readonly CustomTeamTemplateUnreadableRecord[];
    }
  | { status: 'storageUnavailable' };

/**
 * Editable fields of one custom template (A3).
 *
 * The allowlist mirrors A1 validation: the display name, the optional
 * description, the team prompt and the supported per-member configuration
 * (`name`/`role`/`workflow` only). No runtime, provider, identity,
 * timestamp or revision field is editable — those stay server-side.
 */
export interface UpdateCustomTeamTemplateFields {
  name: string;
  description?: string;
  teamPrompt: string;
  members: readonly CustomTeamTemplateMemberV1[];
}

export interface UpdateCustomTeamTemplateRequest {
  /** Stable identity of the template to update. The renderer never invents it. */
  templateId: string;
  /**
   * Optimistic-concurrency guard: the revision the editor read.
   * The worker compare-and-swaps against it in one transaction; a stale
   * value yields `revisionConflict` with the current state instead of
   * overwriting a newer edit.
   */
  expectedRevision: number;
  fields: UpdateCustomTeamTemplateFields;
}

/**
 * Update outcomes (A3 edit).
 *
 * `updated` carries the stored record (with the bumped revision).
 * `revisionConflict` carries the current stored state so the editor can
 * rebase without losing its typed input. `notFound` and
 * `storageUnavailable` keep their A1 meanings; `validationFailed` and
 * `nameConflict` reuse the established codes/policies.
 */
export type UpdateCustomTeamTemplateResult =
  | { status: 'updated'; template: CustomTeamTemplateV1 }
  | { status: 'revisionConflict'; current: CustomTeamTemplateV1 }
  | { status: 'notFound'; templateId: string }
  | { status: 'nameConflict'; existingTemplateId: string }
  | { status: 'validationFailed'; issues: readonly CustomTeamTemplateValidationIssue[] }
  | { status: 'unreadableRecord'; templateId: string }
  | { status: 'storageUnavailable' };

export interface DeleteCustomTeamTemplateRequest {
  /** Stable identity of the template to delete. */
  templateId: string;
  /**
   * Optimistic-concurrency guard, same semantics as update.
   * Guards against deleting a newer edit from a stale selection.
   */
  expectedRevision: number;
}

/**
 * Delete outcomes (A3).
 *
 * `deleted` removes exactly one template record; teams created from it are
 * untouched (there is no cascade). `revisionConflict` carries the current
 * state so the UI can ask for a renewed confirmation.
 */
export type DeleteCustomTeamTemplateResult =
  | { status: 'deleted'; templateId: string }
  | { status: 'revisionConflict'; current: CustomTeamTemplateV1 }
  | { status: 'notFound'; templateId: string }
  | { status: 'unreadableRecord'; templateId: string }
  | { status: 'storageUnavailable' };

export interface DuplicateCustomTeamTemplateRequest {
  /** Stable identity of the source custom template. */
  sourceTemplateId: string;
  /** Display name for the new copy; uniqueness is enforced case-insensitively. */
  name: string;
}

/**
 * Duplicate outcomes (A3).
 *
 * Creates a brand-new record with a fresh stable id, copying only the
 * approved template fields (name/description/prompt/members). The source
 * record is never modified. `sourceNotFound` is distinct from a generic
 * `notFound` so the UI can name the missing source.
 */
export type DuplicateCustomTeamTemplateResult =
  | { status: 'duplicated'; template: CustomTeamTemplateV1 }
  | { status: 'sourceNotFound'; sourceTemplateId: string }
  | { status: 'sourceUnreadable'; sourceTemplateId: string }
  | { status: 'nameConflict'; existingTemplateId: string }
  | { status: 'templateIdConflict'; templateId: string }
  | { status: 'validationFailed'; issues: readonly CustomTeamTemplateValidationIssue[] }
  | { status: 'storageUnavailable' };

/** Built-in template ids stay a closed union (never widened to strings). */
export type BuiltinTeamTemplateId =
  | 'software-product'
  | 'marketing'
  | 'content'
  | 'research'
  | 'sales'
  | 'customer-support'
  | 'operations'
  | 'learning';

export interface CopyBuiltinTemplateRequest {
  /** Which built-in template to copy; the catalogue itself stays read-only. */
  builtinTemplateId: BuiltinTeamTemplateId;
  /** Display name for the new custom copy; uniqueness is enforced. */
  name: string;
}

/**
 * Built-in-copy outcomes (A3).
 *
 * Persists the built-in configuration as a new custom template with a fresh
 * local id. Never modifies the built-in catalogue, its ids, or translations.
 */
export type CopyBuiltinTemplateResult =
  | { status: 'copied'; template: CustomTeamTemplateV1 }
  | { status: 'builtinNotFound'; builtinTemplateId: string }
  | { status: 'nameConflict'; existingTemplateId: string }
  | { status: 'templateIdConflict'; templateId: string }
  | { status: 'validationFailed'; issues: readonly CustomTeamTemplateValidationIssue[] }
  | { status: 'storageUnavailable' };
