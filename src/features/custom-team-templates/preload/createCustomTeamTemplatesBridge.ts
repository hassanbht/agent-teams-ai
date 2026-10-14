import { CUSTOM_TEAM_TEMPLATE_CHANNELS } from '@features/custom-team-templates/contracts';
import { ipcRenderer } from 'electron';

import type { CustomTeamTemplatesApi } from '@features/custom-team-templates/contracts';

/**
 * Preload bridge for the custom-team-templates feature.
 *
 * The renderer only ever reaches these eight operations through `window.electronAPI`;
 * there is no broader surface, and every call forwards just the request payload
 * (the preview token, an optional name/description edit, the re-check token, a
 * stored template id plus its expected revision, or a new display name).
 * Results are the use cases' typed outcomes, including validation failures, so no
 * error envelope is needed and no renderer input can name a source team, a
 * digest or a timestamp.
 */
export function createCustomTeamTemplatesBridge(): CustomTeamTemplatesApi {
  return {
    preparePreview: (request) =>
      ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.preparePreview, request),
    saveTemplate: (request) =>
      ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.saveTemplate, request),
    recheckSave: (request) =>
      ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.recheckSave, request),
    listTemplates: () => ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.listTemplates),
    updateTemplate: (request) =>
      ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.updateTemplate, request),
    deleteTemplate: (request) =>
      ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.deleteTemplate, request),
    duplicateTemplate: (request) =>
      ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.duplicateTemplate, request),
    copyBuiltinTemplate: (request) =>
      ipcRenderer.invoke(CUSTOM_TEAM_TEMPLATE_CHANNELS.copyBuiltinTemplate, request),
  };
}
