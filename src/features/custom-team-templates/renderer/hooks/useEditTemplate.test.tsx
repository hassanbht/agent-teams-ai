import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateTemplate = vi.hoisted(() => vi.fn());

vi.mock('@renderer/api', () => ({
  api: {
    customTeamTemplates: {
      updateTemplate,
    },
  },
}));

import { useEditTemplate, type UseEditTemplateResult } from './useEditTemplate';

import type { CustomTeamTemplateV1 } from '@features/custom-team-templates/contracts';

const sampleTemplate: CustomTeamTemplateV1 = {
  templateId: 'tpl-1',
  name: 'Dev Team',
  description: 'Initial description',
  schemaVersion: 1,
  teamPrompt: 'Build great software.',
  members: [
    { name: 'alice', role: 'Engineer', workflow: 'TDD' },
    { name: 'bob', role: 'QA' },
  ],
  revision: 2,
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let hookResult: UseEditTemplateResult;

const TestComponent = ({
  open,
  template,
  onSaved,
}: {
  open: boolean;
  template: CustomTeamTemplateV1 | null;
  onSaved?: (updated: CustomTeamTemplateV1) => void;
}) => {
  hookResult = useEditTemplate({ open, template, onSaved });
  return null;
};

async function render(
  open = true,
  template: CustomTeamTemplateV1 | null = sampleTemplate,
  onSaved?: (updated: CustomTeamTemplateV1) => void
) {
  await act(async () => {
    root.render(<TestComponent open={open} template={template} onSaved={onSaved} />);
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  updateTemplate.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('useEditTemplate', () => {
  it('initializes draft state from the given template', async () => {
    await render();
    expect(hookResult.name).toBe('Dev Team');
    expect(hookResult.description).toBe('Initial description');
    expect(hookResult.teamPrompt).toBe('Build great software.');
    expect(hookResult.members).toEqual([
      { name: 'alice', role: 'Engineer', workflow: 'TDD' },
      { name: 'bob', role: 'QA' },
    ]);
    expect(hookResult.expectedRevision).toBe(2);
    expect(hookResult.status).toBe('idle');
    expect(hookResult.issues).toEqual([]);
    expect(hookResult.canSave).toBe(true);
  });

  it('updates draft fields locally without persistent mutation', async () => {
    await render();

    act(() => {
      hookResult.setName('Updated Dev Team');
      hookResult.setDescription('New description');
      hookResult.setTeamPrompt('New prompt');
      hookResult.addMember({ name: 'carol', role: 'Designer' });
    });

    expect(hookResult.name).toBe('Updated Dev Team');
    expect(hookResult.description).toBe('New description');
    expect(hookResult.teamPrompt).toBe('New prompt');
    expect(hookResult.members).toHaveLength(3);
    expect(hookResult.members[2]).toEqual({ name: 'carol', role: 'Designer', workflow: '' });

    act(() => {
      hookResult.updateMember(0, { role: 'Lead Engineer' });
      hookResult.removeMember(1);
    });

    expect(hookResult.members).toHaveLength(2);
    expect(hookResult.members[0]).toEqual({
      name: 'alice',
      role: 'Lead Engineer',
      workflow: 'TDD',
    });
    expect(hookResult.members[1].name).toBe('carol');
    expect(updateTemplate).not.toHaveBeenCalled();
  });

  it('saves valid edits, bumps expectedRevision, and calls onSaved', async () => {
    const onSaved = vi.fn();
    const updatedRecord: CustomTeamTemplateV1 = {
      ...sampleTemplate,
      name: 'Renamed Team',
      revision: 3,
    };
    updateTemplate.mockResolvedValueOnce({
      status: 'updated',
      template: updatedRecord,
    });

    await render(true, sampleTemplate, onSaved);

    act(() => {
      hookResult.setName('Renamed Team');
    });

    let success = false;
    await act(async () => {
      success = await hookResult.save();
    });

    expect(success).toBe(true);
    expect(updateTemplate).toHaveBeenCalledWith({
      templateId: 'tpl-1',
      expectedRevision: 2,
      fields: {
        name: 'Renamed Team',
        description: 'Initial description',
        teamPrompt: 'Build great software.',
        members: [
          { name: 'alice', role: 'Engineer', workflow: 'TDD' },
          { name: 'bob', role: 'QA' },
        ],
      },
    });
    expect(hookResult.status).toBe('saved');
    expect(hookResult.expectedRevision).toBe(3);
    expect(onSaved).toHaveBeenCalledWith(updatedRecord);
  });

  it('handles validation failure without discarding the draft', async () => {
    updateTemplate.mockResolvedValueOnce({
      status: 'validationFailed',
      issues: [{ code: 'templateNameTooLong', field: 'name' }],
    });

    await render();

    act(() => {
      hookResult.setName('Super Long Name That Fails Validation');
    });

    let success = true;
    await act(async () => {
      success = await hookResult.save();
    });

    expect(success).toBe(false);
    expect(hookResult.issues).toEqual([{ code: 'templateNameTooLong', field: 'name' }]);
    expect(hookResult.name).toBe('Super Long Name That Fails Validation');
  });

  it('handles name conflict without discarding the draft', async () => {
    updateTemplate.mockResolvedValueOnce({
      status: 'nameConflict',
      existingTemplateId: 'tpl-other',
    });

    await render();

    act(() => {
      hookResult.setName('Existing Name');
    });

    let success = true;
    await act(async () => {
      success = await hookResult.save();
    });

    expect(success).toBe(false);
    expect(hookResult.status).toBe('nameConflict');
    expect(hookResult.name).toBe('Existing Name');
  });

  it('handles revision conflict and offers reload or overwrite options', async () => {
    const serverCurrent: CustomTeamTemplateV1 = {
      ...sampleTemplate,
      name: 'Server Side Name',
      revision: 5,
    };
    updateTemplate.mockResolvedValueOnce({
      status: 'revisionConflict',
      current: serverCurrent,
    });

    await render();

    act(() => {
      hookResult.setName('My Local Name');
    });

    let success = true;
    await act(async () => {
      success = await hookResult.save();
    });

    expect(success).toBe(false);
    expect(hookResult.status).toBe('revisionConflict');
    expect(hookResult.revisionConflict).toEqual(serverCurrent);
    // Draft is preserved
    expect(hookResult.name).toBe('My Local Name');

    // Test overwrite option: keeps draft, updates expectedRevision
    act(() => {
      hookResult.overwriteRevisionConflict();
    });
    expect(hookResult.status).toBe('idle');
    expect(hookResult.expectedRevision).toBe(5);
    expect(hookResult.name).toBe('My Local Name');

    // Set conflict again to test accept option
    updateTemplate.mockResolvedValueOnce({
      status: 'revisionConflict',
      current: serverCurrent,
    });
    await act(async () => {
      await hookResult.save();
    });

    act(() => {
      hookResult.acceptRevisionConflict();
    });
    expect(hookResult.status).toBe('idle');
    expect(hookResult.name).toBe('Server Side Name');
    expect(hookResult.expectedRevision).toBe(5);
  });

  it('handles storageUnavailable and transport errors', async () => {
    updateTemplate.mockResolvedValueOnce({ status: 'storageUnavailable' });
    await render();

    await act(async () => {
      await hookResult.save();
    });
    expect(hookResult.status).toBe('storageUnavailable');

    updateTemplate.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await hookResult.save();
    });
    expect(hookResult.status).toBe('requestFailed');
  });

  it('prevents duplicate submissions while busy', async () => {
    let resolveSave!: (val: unknown) => void;
    updateTemplate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    await render();

    // Start first save
    let p1: Promise<boolean>;
    act(() => {
      p1 = hookResult.save();
    });

    expect(hookResult.busy).toBe(true);
    expect(hookResult.status).toBe('saving');

    // Attempt second save while first is pending
    let p2Result: boolean | undefined;
    await act(async () => {
      p2Result = await hookResult.save();
    });

    expect(p2Result).toBe(false);
    expect(updateTemplate).toHaveBeenCalledTimes(1);

    // Resolve first save
    await act(async () => {
      resolveSave({ status: 'updated', template: { ...sampleTemplate, revision: 3 } });
      await p1;
    });

    expect(hookResult.busy).toBe(false);
    expect(hookResult.status).toBe('saved');
  });

  it('ignores stale asynchronous response if selection changed during save', async () => {
    let resolveSave!: (val: unknown) => void;
    updateTemplate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    await render();

    // Trigger save on tpl-1
    act(() => {
      void hookResult.save();
    });

    // Selection changes to tpl-2 before save resolves
    const template2: CustomTeamTemplateV1 = {
      templateId: 'tpl-2',
      name: 'Template 2',
      schemaVersion: 1,
      teamPrompt: 'P2',
      members: [],
      revision: 1,
    };
    await render(true, template2);

    expect(hookResult.name).toBe('Template 2');

    // Late response arrives for tpl-1
    await act(async () => {
      resolveSave({ status: 'updated', template: { ...sampleTemplate, revision: 3 } });
    });

    // The late response must not overwrite Template 2's state
    expect(hookResult.name).toBe('Template 2');
    expect(hookResult.status).toBe('idle');
  });
});
