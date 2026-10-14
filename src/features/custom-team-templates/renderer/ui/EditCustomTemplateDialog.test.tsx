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

vi.mock('@features/localization/renderer', () => ({
  useAppTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values
        ? `${key}|${Object.entries(values)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(';')}`
        : key,
  }),
}));

vi.mock('@renderer/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('p', null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('footer', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('header', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', null, children),
}));

import { EditCustomTemplateDialog } from './EditCustomTemplateDialog';

import type { CustomTeamTemplateV1 } from '@features/custom-team-templates/contracts';

const sampleTemplate: CustomTeamTemplateV1 = {
  templateId: 'tpl-1',
  name: 'Alpha Team',
  description: 'Original description',
  schemaVersion: 1,
  teamPrompt: 'Original prompt',
  members: [
    { name: 'alice', role: 'Dev', workflow: 'Code' },
    { name: 'bob', role: 'Tester' },
  ],
  revision: 2,
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onClose: ReturnType<typeof vi.fn>;
let onSaved: ReturnType<typeof vi.fn>;

async function render(
  open = true,
  template: CustomTeamTemplateV1 | null = sampleTemplate
): Promise<void> {
  await act(async () => {
    root.render(
      <EditCustomTemplateDialog
        open={open}
        template={template}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  });
}

function findInput(id: string): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Input #${id} not found in host`);
  return input;
}

function findTextarea(id: string): HTMLTextAreaElement {
  const textarea = host.querySelector<HTMLTextAreaElement>(`#${id}`);
  if (!textarea) throw new Error(`Textarea #${id} not found in host`);
  return textarea;
}

function setText(selector: string, value: string): void {
  const field = host.querySelector(selector);
  if (!field) throw new Error(`field not found: ${selector}`);
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(text: string): HTMLButtonElement {
  const btn = Array.from(host.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text)
  );
  if (!btn) throw new Error(`Button with text "${text}" not found`);
  return btn;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  updateTemplate.mockReset();
  onClose = vi.fn();
  onSaved = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('EditCustomTemplateDialog', () => {
  it('opens the edit dialog with the correct persisted values', async () => {
    await render();

    expect(findInput('edit-template-name').value).toBe('Alpha Team');
    expect(findTextarea('edit-template-description').value).toBe('Original description');
    expect(findTextarea('edit-template-prompt').value).toBe('Original prompt');
    expect(findInput('member-0-name').value).toBe('alice');
    expect(findInput('member-0-role').value).toBe('Dev');
    expect(findInput('member-0-workflow').value).toBe('Code');
    expect(findInput('member-1-name').value).toBe('bob');
    expect(findInput('member-1-role').value).toBe('Tester');
  });

  it('saves a valid edit, refreshes the template, and closes', async () => {
    const updated: CustomTeamTemplateV1 = {
      ...sampleTemplate,
      name: 'Alpha v2',
      description: 'Updated description',
      revision: 3,
    };
    updateTemplate.mockResolvedValueOnce({
      status: 'updated',
      template: updated,
    });

    await render();

    await act(async () => {
      setText('#edit-template-name', 'Alpha v2');
      setText('#edit-template-description', 'Updated description');
    });

    await act(async () => {
      findButton('customTemplates.edit.save').click();
    });

    expect(updateTemplate).toHaveBeenCalledWith({
      templateId: 'tpl-1',
      expectedRevision: 2,
      fields: {
        name: 'Alpha v2',
        description: 'Updated description',
        teamPrompt: 'Original prompt',
        members: [
          { name: 'alice', role: 'Dev', workflow: 'Code' },
          { name: 'bob', role: 'Tester' },
        ],
      },
    });

    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels without calling the update operation', async () => {
    await render();

    await act(async () => {
      setText('#edit-template-name', 'Unsaved Name');
    });

    await act(async () => {
      findButton('actions.cancel').click();
    });

    expect(updateTemplate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows validation and name-conflict errors while keeping user edits', async () => {
    updateTemplate.mockResolvedValueOnce({
      status: 'nameConflict',
      existingTemplateId: 'tpl-99',
    });

    await render();

    await act(async () => {
      setText('#edit-template-name', 'Conflicting Name');
    });

    await act(async () => {
      findButton('customTemplates.edit.save').click();
    });

    expect(host.querySelector('[data-testid="edit-template-name-conflict"]')).not.toBeNull();
    expect(findInput('edit-template-name').value).toBe('Conflicting Name');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles stale revision conflicts without discarding user draft', async () => {
    const serverCurrent: CustomTeamTemplateV1 = {
      ...sampleTemplate,
      name: 'Server Modified Name',
      revision: 4,
    };
    updateTemplate.mockResolvedValueOnce({
      status: 'revisionConflict',
      current: serverCurrent,
    });

    await render();

    await act(async () => {
      setText('#edit-template-name', 'My Draft Name');
    });

    await act(async () => {
      findButton('customTemplates.edit.save').click();
    });

    expect(host.querySelector('[data-testid="edit-template-revision-conflict"]')).not.toBeNull();
    expect(findInput('edit-template-name').value).toBe('My Draft Name');

    // Overwrite conflict choice updates expectedRevision and clears conflict warning
    await act(async () => {
      findButton('customTemplates.edit.conflictOverwrite').click();
    });
    expect(host.querySelector('[data-testid="edit-template-revision-conflict"]')).toBeNull();
    expect(findInput('edit-template-name').value).toBe('My Draft Name');
  });

  it('prevents duplicate submissions while save is in flight', async () => {
    let resolveSave!: (val: unknown) => void;
    updateTemplate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    await render();

    const saveBtn = findButton('customTemplates.edit.save');
    await act(async () => {
      saveBtn.click();
    });

    expect(updateTemplate).toHaveBeenCalledTimes(1);

    // Save button should be disabled while saving
    expect(findButton('customTemplates.edit.saving').disabled).toBe(true);

    await act(async () => {
      resolveSave({
        status: 'updated',
        template: { ...sampleTemplate, revision: 3 },
      });
    });

    expect(onClose).toHaveBeenCalled();
  });
});
