import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const duplicateTemplate = vi.hoisted(() => vi.fn());

vi.mock('@renderer/api', () => ({
  api: {
    customTeamTemplates: {
      duplicateTemplate,
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

import { DuplicateCustomTemplateDialog } from './DuplicateCustomTemplateDialog';

import type { CustomTeamTemplateV1 } from '@features/custom-team-templates/contracts';

const sourceTemplate: CustomTeamTemplateV1 = {
  templateId: 'tpl-source',
  name: 'Original Template',
  schemaVersion: 1,
  teamPrompt: 'Prompt',
  members: [{ name: 'member1' }],
  revision: 1,
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onClose: ReturnType<typeof vi.fn>;
let onDuplicated: ReturnType<typeof vi.fn>;

async function render(
  open = true,
  template: CustomTeamTemplateV1 | null = sourceTemplate
): Promise<void> {
  await act(async () => {
    root.render(
      <DuplicateCustomTemplateDialog
        open={open}
        template={template}
        onClose={onClose}
        onDuplicated={onDuplicated}
      />
    );
  });
}

function findInput(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input#duplicate-template-name');
  if (!input) throw new Error('duplicate-template-name input not found');
  return input;
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
  duplicateTemplate.mockReset();
  onClose = vi.fn();
  onDuplicated = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('DuplicateCustomTemplateDialog', () => {
  it('invokes the duplicate operation with the proposed name and closes', async () => {
    const newRecord: CustomTeamTemplateV1 = {
      ...sourceTemplate,
      templateId: 'tpl-copy',
      name: 'Original Template (Copy)',
      revision: 1,
    };
    duplicateTemplate.mockResolvedValueOnce({
      status: 'duplicated',
      template: newRecord,
    });

    await render();

    expect(findInput().value).toBe('customTemplates.duplicate.defaultName|name=Original Template');

    await act(async () => {
      findButton('customTemplates.duplicate.action').click();
    });

    expect(duplicateTemplate).toHaveBeenCalledWith({
      sourceTemplateId: 'tpl-source',
      name: 'customTemplates.duplicate.defaultName|name=Original Template',
    });
    expect(onDuplicated).toHaveBeenCalledWith(newRecord);
    expect(onClose).toHaveBeenCalled();

    // Verify source template remains unchanged
    expect(sourceTemplate.name).toBe('Original Template');
    expect(sourceTemplate.templateId).toBe('tpl-source');
  });

  it('cancels without calling duplicate', async () => {
    await render();

    await act(async () => {
      findButton('actions.cancel').click();
    });

    expect(duplicateTemplate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles name conflicts and storage failures gracefully', async () => {
    duplicateTemplate.mockResolvedValueOnce({
      status: 'nameConflict',
      existingTemplateId: 'existing-id',
    });

    await render();

    await act(async () => {
      findButton('customTemplates.duplicate.action').click();
    });

    expect(host.querySelector('[data-testid="duplicate-template-name-conflict"]')).not.toBeNull();
    expect(onDuplicated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // Test storage unavailable
    duplicateTemplate.mockResolvedValueOnce({
      status: 'storageUnavailable',
    });

    await act(async () => {
      findButton('customTemplates.duplicate.action').click();
    });

    expect(
      host.querySelector('[data-testid="duplicate-template-storage-unavailable"]')
    ).not.toBeNull();
  });
});
