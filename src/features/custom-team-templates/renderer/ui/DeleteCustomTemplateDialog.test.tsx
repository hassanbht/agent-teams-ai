import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deleteTemplate = vi.hoisted(() => vi.fn());

vi.mock('@renderer/api', () => ({
  api: {
    customTeamTemplates: {
      deleteTemplate,
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

import { DeleteCustomTemplateDialog } from './DeleteCustomTemplateDialog';

import type { CustomTeamTemplateV1 } from '@features/custom-team-templates/contracts';

const sampleTemplate: CustomTeamTemplateV1 = {
  templateId: 'tpl-to-delete',
  name: 'Target Template',
  schemaVersion: 1,
  teamPrompt: '',
  members: [],
  revision: 2,
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onClose: ReturnType<typeof vi.fn>;
let onDeleted: ReturnType<typeof vi.fn>;

async function render(
  open = true,
  template: CustomTeamTemplateV1 | null = sampleTemplate
): Promise<void> {
  await act(async () => {
    root.render(
      <DeleteCustomTemplateDialog
        open={open}
        template={template}
        onClose={onClose}
        onDeleted={onDeleted}
      />
    );
  });
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
  deleteTemplate.mockReset();
  onClose = vi.fn();
  onDeleted = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('DeleteCustomTemplateDialog', () => {
  it('shows the correct confirmation making it clear only the template is deleted', async () => {
    await render();

    const text = host.textContent ?? '';
    expect(text).toContain('customTemplates.delete.title');
    expect(text).toContain('customTemplates.delete.description|name=Target Template');
  });

  it('cancels without calling delete', async () => {
    await render();

    await act(async () => {
      findButton('actions.cancel').click();
    });

    expect(deleteTemplate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes only after confirmation and triggers onDeleted', async () => {
    deleteTemplate.mockResolvedValueOnce({
      status: 'deleted',
      templateId: 'tpl-to-delete',
    });

    await render();

    await act(async () => {
      findButton('customTemplates.delete.confirm').click();
    });

    expect(deleteTemplate).toHaveBeenCalledWith({
      templateId: 'tpl-to-delete',
      expectedRevision: 2,
    });
    expect(onDeleted).toHaveBeenCalledWith('tpl-to-delete');
    expect(onClose).toHaveBeenCalled();
  });

  it('handles revision conflict, not-found, and storage-unavailable outcomes', async () => {
    deleteTemplate.mockResolvedValueOnce({
      status: 'revisionConflict',
      current: { ...sampleTemplate, revision: 3 },
    });

    await render();

    await act(async () => {
      findButton('customTemplates.delete.confirm').click();
    });

    expect(host.querySelector('[data-testid="delete-template-revision-conflict"]')).not.toBeNull();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // Second click retries with updated revision 3
    deleteTemplate.mockResolvedValueOnce({
      status: 'notFound',
      templateId: 'tpl-to-delete',
    });

    await act(async () => {
      findButton('customTemplates.delete.confirm').click();
    });

    expect(deleteTemplate).toHaveBeenLastCalledWith({
      templateId: 'tpl-to-delete',
      expectedRevision: 3,
    });
    expect(host.querySelector('[data-testid="delete-template-not-found"]')).not.toBeNull();

    // Storage unavailable
    deleteTemplate.mockResolvedValueOnce({
      status: 'storageUnavailable',
    });

    await act(async () => {
      findButton('customTemplates.delete.confirm').click();
    });

    expect(
      host.querySelector('[data-testid="delete-template-storage-unavailable"]')
    ).not.toBeNull();
  });
});
