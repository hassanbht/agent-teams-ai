import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const copyBuiltinTemplate = vi.hoisted(() => vi.fn());

vi.mock('@renderer/api', () => ({
  api: {
    customTeamTemplates: {
      copyBuiltinTemplate,
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

import { TEAM_TEMPLATES } from '@features/team-templates';

import { CopyBuiltinTemplateDialog } from './CopyBuiltinTemplateDialog';

import type { CustomTeamTemplateV1 } from '@features/custom-team-templates/contracts';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onClose: ReturnType<typeof vi.fn>;
let onCopied: ReturnType<typeof vi.fn>;

async function render(open = true): Promise<void> {
  await act(async () => {
    root.render(<CopyBuiltinTemplateDialog open={open} onClose={onClose} onCopied={onCopied} />);
  });
}

function findInput(): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>('input#copy-builtin-name');
  if (!input) throw new Error('copy-builtin-name input not found');
  return input;
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
  copyBuiltinTemplate.mockReset();
  onClose = vi.fn();
  onCopied = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('CopyBuiltinTemplateDialog', () => {
  it('displays valid built-in templates as read-only sources', async () => {
    await render();

    const list = host.querySelector('[data-testid="builtin-templates-list"]');
    expect(list).not.toBeNull();

    // Verify all 8 built-in templates are displayed
    for (const tpl of TEAM_TEMPLATES) {
      expect(host.querySelector(`[data-testid="builtin-template-${tpl.id}"]`)).not.toBeNull();
    }

    // Read-only preview badge is present
    expect(host.textContent).toContain('customTemplates.copyBuiltin.readOnlySource');
    expect(findInput().value).toBe('Software Product Team');
  });

  it('copies using the closed built-in ID contract and closes on success', async () => {
    const createdTemplate: CustomTeamTemplateV1 = {
      templateId: 'tpl-new-copy',
      name: 'Custom Product Team',
      schemaVersion: 1,
      teamPrompt: 'prompt',
      members: [],
      revision: 1,
    };
    copyBuiltinTemplate.mockResolvedValueOnce({
      status: 'copied',
      template: createdTemplate,
    });

    await render();

    // Select marketing template
    const marketingBtn = host.querySelector<HTMLButtonElement>(
      '[data-testid="builtin-template-marketing"]'
    );
    await act(async () => {
      marketingBtn?.click();
    });

    expect(findInput().value).toBe('Marketing Team');

    // Change name
    await act(async () => {
      setText('#copy-builtin-name', 'Custom Marketing Team');
    });

    await act(async () => {
      findButton('customTemplates.copyBuiltin.action').click();
    });

    expect(copyBuiltinTemplate).toHaveBeenCalledWith({
      builtinTemplateId: 'marketing',
      name: 'Custom Marketing Team',
    });
    expect(onCopied).toHaveBeenCalledWith(createdTemplate);
    expect(onClose).toHaveBeenCalled();

    // Verify built-in templates catalogue remains untouched
    const marketingOriginal = TEAM_TEMPLATES.find((tpl) => tpl.id === 'marketing');
    expect(marketingOriginal?.name).toBe('Marketing Team');
  });

  it('cancels without calling copy', async () => {
    await render();

    await act(async () => {
      findButton('actions.cancel').click();
    });

    expect(copyBuiltinTemplate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles name conflict and storage failure', async () => {
    copyBuiltinTemplate.mockResolvedValueOnce({
      status: 'nameConflict',
      existingTemplateId: 'tpl-existing',
    });

    await render();

    await act(async () => {
      findButton('customTemplates.copyBuiltin.action').click();
    });

    expect(host.querySelector('[data-testid="copy-builtin-name-conflict"]')).not.toBeNull();
    expect(onCopied).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // Storage failure
    copyBuiltinTemplate.mockResolvedValueOnce({
      status: 'storageUnavailable',
    });

    await act(async () => {
      findButton('customTemplates.copyBuiltin.action').click();
    });

    expect(host.querySelector('[data-testid="copy-builtin-storage-unavailable"]')).not.toBeNull();
  });
});
