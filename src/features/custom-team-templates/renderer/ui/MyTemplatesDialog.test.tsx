import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const preparePreview = vi.hoisted(() => vi.fn());
const saveTemplate = vi.hoisted(() => vi.fn());
const recheckSave = vi.hoisted(() => vi.fn());
const listTemplates = vi.hoisted(() => vi.fn());
const updateTemplate = vi.hoisted(() => vi.fn());
const deleteTemplate = vi.hoisted(() => vi.fn());
const duplicateTemplate = vi.hoisted(() => vi.fn());
const copyBuiltinTemplate = vi.hoisted(() => vi.fn());

vi.mock('@renderer/api', () => ({
  isElectronMode: () => true,
  api: {
    customTeamTemplates: {
      preparePreview,
      saveTemplate,
      recheckSave,
      listTemplates,
      updateTemplate,
      deleteTemplate,
      duplicateTemplate,
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
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange?: (next: boolean) => void;
    children: React.ReactNode;
  }) =>
    open
      ? React.createElement(
          'div',
          null,
          React.createElement('button', {
            type: 'button',
            'data-testid': 'dismiss',
            onClick: () => onOpenChange?.(false),
          }),
          children
        )
      : null,
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

vi.mock('@renderer/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { role: 'tooltip' }, children),
}));

import { MyTemplatesDialog } from './MyTemplatesDialog';

import type {
  CustomTeamTemplateV1,
  ListCustomTeamTemplatesResult,
} from '@features/custom-team-templates/contracts';

const templates: readonly CustomTeamTemplateV1[] = [
  {
    templateId: 'template-1',
    name: 'Alpha',
    description: 'Reusable setup',
    schemaVersion: 1,
    teamPrompt: 'Lead the work.',
    members: [{ name: 'ann', role: 'Developer' }],
    createdAt: '2026-10-01T10:00:00.000Z',
    revision: 1,
  },
  {
    templateId: 'template-2',
    name: 'Beta',
    schemaVersion: 1,
    teamPrompt: '',
    members: [],
    revision: 1,
  },
];

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onClose: ReturnType<typeof vi.fn>;

function render(open = true): Promise<void> {
  return act(async () => {
    root.render(<MyTemplatesDialog open={open} onClose={onClose} />);
  });
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!found) throw new Error(`button not found: ${label}\n${host.textContent}`);
  return found;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  preparePreview.mockReset();
  saveTemplate.mockReset();
  recheckSave.mockReset();
  listTemplates.mockReset();
  updateTemplate.mockReset();
  deleteTemplate.mockReset();
  duplicateTemplate.mockReset();
  copyBuiltinTemplate.mockReset();
  listTemplates.mockResolvedValue({ status: 'ready', templates });
  onClose = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('MyTemplatesDialog', () => {
  it('renders the stored templates with edit, duplicate, and delete actions', async () => {
    await render();
    expect(listTemplates).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="custom-template-library"]')).not.toBeNull();
    expect(host.textContent).toContain('Alpha');
    expect(host.textContent).toContain('Reusable setup');
    expect(host.textContent).toContain('customTemplates.library.memberNames|names=ann');
    expect(host.textContent).toContain('Beta');
    expect(host.textContent).toContain('customTemplates.library.noDescription');
    expect(host.textContent).toContain('customTemplates.library.noMembers');
    expect(host.textContent).toContain('customTemplates.library.createdAt|date=');

    // Management actions are present
    const editButtons = host.querySelectorAll('button[aria-label="customTemplates.actions.edit"]');
    const duplicateButtons = host.querySelectorAll(
      'button[aria-label="customTemplates.actions.duplicate"]'
    );
    const deleteButtons = host.querySelectorAll(
      'button[aria-label="customTemplates.actions.delete"]'
    );
    expect(editButtons.length).toBe(2);
    expect(duplicateButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);

    // Copy built-in action in header
    expect(button('customTemplates.actions.copyBuiltin')).not.toBeNull();
  });

  it('opens edit dialog when edit button is clicked', async () => {
    await render();

    const editBtn = host.querySelector<HTMLButtonElement>(
      'button[aria-label="customTemplates.actions.edit"]'
    );
    await act(async () => {
      editBtn?.click();
    });

    expect(host.textContent).toContain('customTemplates.edit.title');
    const nameInput = host.querySelector<HTMLInputElement>('input#edit-template-name');
    expect(nameInput?.value).toBe('Alpha');
  });

  it('opens duplicate dialog when duplicate button is clicked', async () => {
    await render();

    const dupBtn = host.querySelector<HTMLButtonElement>(
      'button[aria-label="customTemplates.actions.duplicate"]'
    );
    await act(async () => {
      dupBtn?.click();
    });

    expect(host.textContent).toContain('customTemplates.duplicate.title');
    expect(host.textContent).toContain('customTemplates.duplicate.description|name=Alpha');
  });

  it('opens delete dialog when delete button is clicked', async () => {
    await render();

    const delBtn = host.querySelector<HTMLButtonElement>(
      'button[aria-label="customTemplates.actions.delete"]'
    );
    await act(async () => {
      delBtn?.click();
    });

    expect(host.textContent).toContain('customTemplates.delete.title');
    expect(host.textContent).toContain('customTemplates.delete.description|name=Alpha');
  });

  it('opens copy built-in dialog when copy built-in button is clicked', async () => {
    await render();

    await act(async () => {
      button('customTemplates.actions.copyBuiltin').click();
    });

    expect(host.textContent).toContain('customTemplates.copyBuiltin.title');
    expect(host.querySelector('[data-testid="builtin-templates-list"]')).not.toBeNull();
  });

  it('shows a genuinely empty library instead of an error, offering copy built-in', async () => {
    listTemplates.mockResolvedValue({ status: 'empty' } satisfies ListCustomTeamTemplatesResult);
    await render();
    expect(host.textContent).toContain('customTemplates.library.empty');
    expect(host.textContent).toContain('customTemplates.library.emptyDescription');
    expect(host.querySelector('[data-testid="custom-template-library"]')).toBeNull();
    expect(host.querySelector('[data-testid="custom-template-library-error"]')).toBeNull();

    // Copy built-in is discoverable in empty state
    expect(button('customTemplates.actions.copyBuiltin')).not.toBeNull();
  });

  it('keeps unreadable stored records visible as a warning next to the readable ones', async () => {
    listTemplates.mockResolvedValue({
      status: 'hasUnreadableRecords',
      templates,
      unreadableRecords: [{ templateId: 'template-x', reason: 'unreadableRecord' }],
    } satisfies ListCustomTeamTemplatesResult);
    await render();
    expect(host.querySelector('[data-testid="custom-template-library"]')).not.toBeNull();
    expect(host.textContent).toContain('Alpha');
    expect(host.querySelector('[data-testid="custom-template-unreadable"]')?.textContent).toContain(
      'customTemplates.library.unreadableRecords|count=1'
    );
    expect(host.querySelector('[data-testid="custom-template-library-error"]')).toBeNull();
    expect(host.textContent).not.toContain('customTemplates.library.empty');
  });

  it('reports an unreachable storage distinctly with a Retry action', async () => {
    listTemplates.mockResolvedValue({
      status: 'storageUnavailable',
    } satisfies ListCustomTeamTemplatesResult);
    await render();
    expect(
      host.querySelector('[data-testid="custom-template-library-error"]')?.textContent
    ).toContain('customTemplates.library.storageUnavailable');
    expect(host.textContent).not.toContain('customTemplates.library.empty');

    listTemplates.mockResolvedValue({ status: 'ready', templates });
    await act(async () => {
      button('customTemplates.actions.retry').click();
    });
    expect(listTemplates).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="custom-template-library"]')).not.toBeNull();
  });

  it('recovers from a failed request instead of reporting an empty library', async () => {
    listTemplates.mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(
      host.querySelector('[data-testid="custom-template-library-error"]')?.textContent
    ).toContain('customTemplates.library.loadFailed');
    expect(host.textContent).not.toContain('customTemplates.library.empty');

    listTemplates.mockResolvedValue({ status: 'ready', templates });
    await act(async () => {
      button('customTemplates.actions.retry').click();
    });
    expect(host.textContent).toContain('Alpha');
  });

  it('re-reads the library every time it opens', async () => {
    await render(false);
    expect(listTemplates).not.toHaveBeenCalled();
    await render(true);
    expect(listTemplates).toHaveBeenCalledTimes(1);
    await render(false);
    await render(true);
    expect(listTemplates).toHaveBeenCalledTimes(2);
  });
});
