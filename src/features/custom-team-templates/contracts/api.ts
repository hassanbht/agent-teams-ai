import type {
  ConfirmCustomTeamTemplateSaveRequest,
  ConfirmCustomTeamTemplateSaveResult,
  CopyBuiltinTemplateRequest,
  CopyBuiltinTemplateResult,
  DeleteCustomTeamTemplateRequest,
  DeleteCustomTeamTemplateResult,
  DuplicateCustomTeamTemplateRequest,
  DuplicateCustomTeamTemplateResult,
  ListCustomTeamTemplatesResult,
  PrepareCustomTeamTemplatePreviewRequest,
  PrepareCustomTeamTemplatePreviewResult,
  RecheckCustomTeamTemplateSaveRequest,
  RecheckCustomTeamTemplateSaveResult,
  UpdateCustomTeamTemplateRequest,
  UpdateCustomTeamTemplateResult,
} from './operations';

/**
 * Renderer-facing custom-team-templates API.
 *
 * The renderer calls exactly eight operations, and every one of them answers
 * with a closed typed outcome instead of throwing: prepare a preview, confirm
 * (save) it, list the library, re-check an unresolved save, plus the Phase 2
 * (A3) management operations — update, delete, duplicate and copy-built-in.
 * The source team identity, the reviewed content, the stable template id and
 * the content digest never travel from the renderer for saves: only the
 * preview token, an optional name/description edit, and the re-check token
 * do. Management operations name a stored template id (plus the revision the
 * editor read, or a new display name) — content always comes from trusted
 * server-side state.
 *
 * Both the preload bridge and the browser HTTP adapter implement this type, so
 * a renderer caller cannot tell IPC and HTTP apart.
 */
export interface CustomTeamTemplatesApi {
  preparePreview(
    request: PrepareCustomTeamTemplatePreviewRequest
  ): Promise<PrepareCustomTeamTemplatePreviewResult>;
  saveTemplate(
    request: ConfirmCustomTeamTemplateSaveRequest
  ): Promise<ConfirmCustomTeamTemplateSaveResult>;
  recheckSave(
    request: RecheckCustomTeamTemplateSaveRequest
  ): Promise<RecheckCustomTeamTemplateSaveResult>;
  listTemplates(): Promise<ListCustomTeamTemplatesResult>;
  updateTemplate(request: UpdateCustomTeamTemplateRequest): Promise<UpdateCustomTeamTemplateResult>;
  deleteTemplate(request: DeleteCustomTeamTemplateRequest): Promise<DeleteCustomTeamTemplateResult>;
  duplicateTemplate(
    request: DuplicateCustomTeamTemplateRequest
  ): Promise<DuplicateCustomTeamTemplateResult>;
  copyBuiltinTemplate(request: CopyBuiltinTemplateRequest): Promise<CopyBuiltinTemplateResult>;
}
