import { act } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deleteTemplateMock = vi.hoisted(() => vi.fn());
const duplicateTemplateMock = vi.hoisted(() => vi.fn());
const copyBuiltinTemplateMock = vi.hoisted(() => vi.fn());

vi.mock('@renderer/api', () => ({
  api: {
    customTeamTemplates: {
      deleteTemplate: deleteTemplateMock,
      duplicateTemplate: duplicateTemplateMock,
      copyBuiltinTemplate: copyBuiltinTemplateMock,
    },
  },
}));

import { useTemplateManagement, type UseTemplateManagementResult } from './useTemplateManagement';

import type {
  CopyBuiltinTemplateResult,
  CustomTeamTemplateV1,
  DeleteCustomTeamTemplateResult,
  DuplicateCustomTeamTemplateResult,
} from '@features/custom-team-templates/contracts';

const sampleTemplate: CustomTeamTemplateV1 = {
  templateId: 'tpl-10',
  name: 'Sample',
  schemaVersion: 1,
  teamPrompt: '',
  members: [],
  revision: 3,
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let hookResult: UseTemplateManagementResult;

const TestComponent = ({ onSuccess }: { onSuccess?: () => void }) => {
  hookResult = useTemplateManagement({ onSuccess });
  return null;
};

async function render(onSuccess?: () => void) {
  await act(async () => {
    root.render(<TestComponent onSuccess={onSuccess} />);
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  deleteTemplateMock.mockReset();
  duplicateTemplateMock.mockReset();
  copyBuiltinTemplateMock.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('useTemplateManagement', () => {
  describe('deleteTemplate', () => {
    it('calls delete with expectedRevision and triggers onSuccess on success', async () => {
      const onSuccess = vi.fn();
      deleteTemplateMock.mockResolvedValueOnce({ status: 'deleted', templateId: 'tpl-10' });

      await render(onSuccess);

      let result: DeleteCustomTeamTemplateResult | undefined;
      await act(async () => {
        result = await hookResult.deleteTemplate(sampleTemplate);
      });

      expect(deleteTemplateMock).toHaveBeenCalledWith({
        templateId: 'tpl-10',
        expectedRevision: 3,
      });
      expect(result).toEqual({ status: 'deleted', templateId: 'tpl-10' });
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('returns revisionConflict without triggering onSuccess', async () => {
      const onSuccess = vi.fn();
      deleteTemplateMock.mockResolvedValueOnce({
        status: 'revisionConflict',
        current: { ...sampleTemplate, revision: 4 },
      });

      await render(onSuccess);

      let result: DeleteCustomTeamTemplateResult | undefined;
      await act(async () => {
        result = await hookResult.deleteTemplate(sampleTemplate);
      });

      expect(result?.status).toBe('revisionConflict');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('handles transport failure safely without crashing', async () => {
      deleteTemplateMock.mockRejectedValueOnce(new Error('fail'));
      await render();

      let result: DeleteCustomTeamTemplateResult | undefined;
      await act(async () => {
        result = await hookResult.deleteTemplate(sampleTemplate);
      });

      expect(result).toEqual({ status: 'storageUnavailable' });
    });
  });

  describe('duplicateTemplate', () => {
    it('calls duplicate with sourceId and new name and triggers onSuccess', async () => {
      const onSuccess = vi.fn();
      const duplicated: CustomTeamTemplateV1 = {
        ...sampleTemplate,
        templateId: 'tpl-new',
        name: 'Sample Copy',
        revision: 1,
      };
      duplicateTemplateMock.mockResolvedValueOnce({
        status: 'duplicated',
        template: duplicated,
      });

      await render(onSuccess);

      let result: DuplicateCustomTeamTemplateResult | undefined;
      await act(async () => {
        result = await hookResult.duplicateTemplate('tpl-10', 'Sample Copy');
      });

      expect(duplicateTemplateMock).toHaveBeenCalledWith({
        sourceTemplateId: 'tpl-10',
        name: 'Sample Copy',
      });
      expect(result).toEqual({ status: 'duplicated', template: duplicated });
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('handles nameConflict without triggering onSuccess', async () => {
      const onSuccess = vi.fn();
      duplicateTemplateMock.mockResolvedValueOnce({
        status: 'nameConflict',
        existingTemplateId: 'other-id',
      });

      await render(onSuccess);

      let result: DuplicateCustomTeamTemplateResult | undefined;
      await act(async () => {
        result = await hookResult.duplicateTemplate('tpl-10', 'Existing');
      });

      expect(result?.status).toBe('nameConflict');
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('copyBuiltinTemplate', () => {
    it('calls copyBuiltin with closed BuiltinTeamTemplateId and triggers onSuccess', async () => {
      const onSuccess = vi.fn();
      const created: CustomTeamTemplateV1 = {
        templateId: 'tpl-custom',
        name: 'Software Team Copy',
        schemaVersion: 1,
        teamPrompt: 'prompt',
        members: [],
        revision: 1,
      };
      copyBuiltinTemplateMock.mockResolvedValueOnce({
        status: 'copied',
        template: created,
      });

      await render(onSuccess);

      let result: CopyBuiltinTemplateResult | undefined;
      await act(async () => {
        result = await hookResult.copyBuiltinTemplate('software-product', 'Software Team Copy');
      });

      expect(copyBuiltinTemplateMock).toHaveBeenCalledWith({
        builtinTemplateId: 'software-product',
        name: 'Software Team Copy',
      });
      expect(result).toEqual({ status: 'copied', template: created });
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('handles failure safely without calling onSuccess', async () => {
      const onSuccess = vi.fn();
      copyBuiltinTemplateMock.mockRejectedValueOnce(new Error('fail'));

      await render(onSuccess);

      let result: CopyBuiltinTemplateResult | undefined;
      await act(async () => {
        result = await hookResult.copyBuiltinTemplate('marketing', 'Marketing Copy');
      });

      expect(result).toEqual({ status: 'storageUnavailable' });
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
