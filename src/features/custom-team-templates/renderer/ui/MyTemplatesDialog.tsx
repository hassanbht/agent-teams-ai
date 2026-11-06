import { useState, useMemo } from 'react';
import { useAppTranslation } from '@features/localization/renderer';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import { AlertTriangle, Copy, Download, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';

import { useCustomTemplateLibrary } from '../hooks/useCustomTemplateLibrary';
import { useTemplateManagement } from '../hooks/useTemplateManagement';

import { BuiltInTemplateCatalogue } from './BuiltInTemplateCatalogue';
import {
  composeCustomTemplates,
  type MemberCountFilter,
  type TemplateSortOption,
} from './templateLibraryFilters';
import { CopyBuiltinTemplateDialog } from './CopyBuiltinTemplateDialog';
import { DeleteCustomTemplateDialog } from './DeleteCustomTemplateDialog';
import { DuplicateCustomTemplateDialog } from './DuplicateCustomTemplateDialog';
import { EditCustomTemplateDialog } from './EditCustomTemplateDialog';
import { ExportCustomTeamTemplateDialog } from './ExportCustomTeamTemplateDialog';
import { ImportCustomTeamTemplateDialog } from './ImportCustomTeamTemplateDialog';

import type {
  BuiltinTeamTemplateId,
  CustomTeamTemplateV1,
} from '@features/custom-team-templates/contracts';

export interface MyTemplatesDialogProps {
  open: boolean;
  onClose: () => void;
}

type TemplateLibraryTab = 'my-templates' | 'built-in';

function formatCreatedAt(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

export const MyTemplatesDialog = ({ open, onClose }: MyTemplatesDialogProps): React.JSX.Element => {
  const { t } = useAppTranslation('team');
  const { t: tCommon } = useAppTranslation('common');
  const { state, reload } = useCustomTemplateLibrary(open);
  const management = useTemplateManagement({ onSuccess: reload });
  const [tab, setTab] = useState<TemplateLibraryTab>('my-templates');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TemplateSortOption>('original');
  const [memberFilter, setMemberFilter] = useState<MemberCountFilter>('all');

  const collator = useMemo(() => new Intl.Collator(undefined, { sensitivity: 'base' }), []);

  const libraryTemplates =
    state.status === 'ready' || state.status === 'partial' ? state.templates : [];
  const displayedTemplates = useMemo(
    () => composeCustomTemplates(libraryTemplates, query, memberFilter, sort, collator),
    [libraryTemplates, query, memberFilter, sort, collator]
  );

  const [editingTemplate, setEditingTemplate] = useState<CustomTeamTemplateV1 | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<CustomTeamTemplateV1 | null>(null);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<CustomTeamTemplateV1 | null>(null);
  const [exportingTemplate, setExportingTemplate] = useState<CustomTeamTemplateV1 | null>(null);
  const [copyBuiltinOpen, setCopyBuiltinOpen] = useState(false);
  const [copyBuiltinId, setCopyBuiltinId] = useState<BuiltinTeamTemplateId | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const failed = state.status === 'storageUnavailable' || state.status === 'requestFailed';

  const handleEditSaved = (_updated: CustomTeamTemplateV1): void => {
    setEditingTemplate(null);
    void reload();
  };

  const handleDuplicated = (): void => {
    setDuplicatingTemplate(null);
    void reload();
  };

  const handleDeleted = (): void => {
    setDeletingTemplate(null);
    void reload();
  };

  const handleCopied = (): void => {
    setCopyBuiltinOpen(false);
    void reload();
  };

  const handleExport = (template: CustomTeamTemplateV1): void => {
    setExportingTemplate(template);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('customTemplates.library.title')}</DialogTitle>
          <DialogDescription>{t('customTemplates.library.description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TemplateLibraryTab)}>
          <TabsList aria-label={t('customTemplates.library.title')}>
            <TabsTrigger value="my-templates">
              {t('customTemplates.library.tabs.myTemplates')}
            </TabsTrigger>
            <TabsTrigger value="built-in">{t('customTemplates.library.tabs.builtIn')}</TabsTrigger>
          </TabsList>

          <TabsContent value="my-templates">
            <div className="space-y-3">
              {state.status === 'idle' || state.status === 'loading' ? (
                <p role="status" className="text-sm text-[var(--color-text-muted)]">
                  {t('customTemplates.library.loading')}
                </p>
              ) : null}

              {state.status === 'empty' ? (
                <div className="rounded-md border border-[var(--color-border)] p-4 text-center">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {t('customTemplates.library.empty')}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {t('customTemplates.library.emptyDescription')}
                  </p>
                </div>
              ) : null}

              {state.status === 'ready' ||
              state.status === 'partial' ||
              state.status === 'empty' ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={t('customTemplates.library.searchLabel')}
                      placeholder={t('customTemplates.library.searchPlaceholder')}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <Select value={sort} onValueChange={(v) => setSort(v as TemplateSortOption)}>
                      <SelectTrigger
                        className="w-[160px]"
                        aria-label={t('customTemplates.library.sortLabel')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">
                          {t('customTemplates.library.sort.original')}
                        </SelectItem>
                        <SelectItem value="name-asc">
                          {t('customTemplates.library.sort.nameAsc')}
                        </SelectItem>
                        <SelectItem value="name-desc">
                          {t('customTemplates.library.sort.nameDesc')}
                        </SelectItem>
                        <SelectItem value="members-asc">
                          {t('customTemplates.library.sort.membersAsc')}
                        </SelectItem>
                        <SelectItem value="members-desc">
                          {t('customTemplates.library.sort.membersDesc')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={memberFilter}
                      onValueChange={(v) => setMemberFilter(v as MemberCountFilter)}
                    >
                      <SelectTrigger
                        className="w-[160px]"
                        aria-label={t('customTemplates.library.filterLabel')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('customTemplates.library.filter.all')}
                        </SelectItem>
                        <SelectItem value="single">
                          {t('customTemplates.library.filter.single')}
                        </SelectItem>
                        <SelectItem value="small">
                          {t('customTemplates.library.filter.small')}
                        </SelectItem>
                        <SelectItem value="large">
                          {t('customTemplates.library.filter.large')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery('');
                        setSort('original');
                        setMemberFilter('all');
                      }}
                    >
                      {t('customTemplates.library.clearFilters')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="import-template-button"
                      disabled={management.busy || importOpen}
                      onClick={() => setImportOpen(true)}
                    >
                      <Upload className="mr-1.5 size-3.5" />
                      {t('customTemplates.import.action')}
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
                    {t('customTemplates.library.resultCount', {
                      count: displayedTemplates.length,
                      total: libraryTemplates.length,
                    })}
                  </p>
                  {(state.status === 'ready' || state.status === 'partial') &&
                    displayedTemplates.length === 0 && (
                      <div className="rounded-md border border-[var(--color-border)] p-4 text-center">
                        <p className="text-sm font-medium text-[var(--color-text)]">
                          {t('customTemplates.library.noResults')}
                        </p>
                      </div>
                    )}
                  {(state.status === 'ready' || state.status === 'partial') &&
                    displayedTemplates.length > 0 && (
                      <ul className="mt-3 space-y-2" data-testid="custom-template-library">
                        {displayedTemplates.map((template) => {
                          const createdAt = formatCreatedAt(template.createdAt);
                          return (
                            <li
                              key={template.templateId}
                              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="min-w-0 break-words text-sm font-semibold text-[var(--color-text)]">
                                  {template.name}
                                </span>
                                {createdAt ? (
                                  <span className="text-xs text-[var(--color-text-muted)]">
                                    {t('customTemplates.library.createdAt', { date: createdAt })}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 break-words text-xs text-[var(--color-text-muted)] [overflow-wrap:anywhere]">
                                {template.description?.trim()
                                  ? template.description
                                  : t('customTemplates.library.noDescription')}
                              </p>
                              <p className="mt-2 break-words text-xs text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">
                                {template.members.length > 0
                                  ? t('customTemplates.library.memberNames', {
                                      names: template.members
                                        .map((member) => member.name)
                                        .join(', '),
                                    })
                                  : t('customTemplates.library.noMembers')}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  data-testid={`edit-template-${template.templateId}`}
                                  disabled={management.busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTemplate(template);
                                  }}
                                >
                                  <Pencil className="size-3.5" />
                                  {t('customTemplates.actions.edit')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  data-testid={`duplicate-template-${template.templateId}`}
                                  disabled={management.busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDuplicatingTemplate(template);
                                  }}
                                >
                                  <Copy className="size-3.5" />
                                  {t('customTemplates.actions.duplicate')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  data-testid={`delete-template-${template.templateId}`}
                                  disabled={management.busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingTemplate(template);
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                  {t('customTemplates.actions.delete')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  data-testid={`export-template-${template.templateId}`}
                                  disabled={management.busy || exportingTemplate !== null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExport(template);
                                  }}
                                >
                                  <Download className="size-3.5" />
                                  {t('customTemplates.actions.export')}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                </>
              ) : null}

              {state.status === 'partial' ? (
                <div
                  role="status"
                  data-testid="custom-template-unreadable"
                  className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {t('customTemplates.library.unreadableRecords', {
                      count: state.unreadableRecords.length,
                    })}
                  </p>
                </div>
              ) : null}

              {failed ? (
                <div
                  role="alert"
                  data-testid="custom-template-library-error"
                  className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {state.status === 'storageUnavailable'
                      ? t('customTemplates.library.storageUnavailable')
                      : t('customTemplates.library.loadFailed')}
                  </p>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="built-in">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={t('customTemplates.library.searchLabel')}
                  placeholder={t('customTemplates.library.searchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-w-0 flex-1"
                />
                <Select value={sort} onValueChange={(v) => setSort(v as TemplateSortOption)}>
                  <SelectTrigger
                    className="w-[160px]"
                    aria-label={t('customTemplates.library.sortLabel')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">
                      {t('customTemplates.library.sort.original')}
                    </SelectItem>
                    <SelectItem value="name-asc">
                      {t('customTemplates.library.sort.nameAsc')}
                    </SelectItem>
                    <SelectItem value="name-desc">
                      {t('customTemplates.library.sort.nameDesc')}
                    </SelectItem>
                    <SelectItem value="members-asc">
                      {t('customTemplates.library.sort.membersAsc')}
                    </SelectItem>
                    <SelectItem value="members-desc">
                      {t('customTemplates.library.sort.membersDesc')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={memberFilter}
                  onValueChange={(v) => setMemberFilter(v as MemberCountFilter)}
                >
                  <SelectTrigger
                    className="w-[160px]"
                    aria-label={t('customTemplates.library.filterLabel')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('customTemplates.library.filter.all')}</SelectItem>
                    <SelectItem value="single">
                      {t('customTemplates.library.filter.single')}
                    </SelectItem>
                    <SelectItem value="small">
                      {t('customTemplates.library.filter.small')}
                    </SelectItem>
                    <SelectItem value="large">
                      {t('customTemplates.library.filter.large')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <BuiltInTemplateCatalogue
                onCopyBuiltin={(id) => {
                  setCopyBuiltinId(id);
                  setCopyBuiltinOpen(true);
                }}
                query={query}
                sort={sort}
                memberFilter={memberFilter}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="copy-builtin-open"
                onClick={() => {
                  setCopyBuiltinId(null);
                  setCopyBuiltinOpen(true);
                }}
              >
                <Copy className="size-3.5" />
                {t('customTemplates.actions.copyToMyTemplates')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon('actions.close')}
          </Button>
          {tab === 'my-templates' && failed ? (
            <Button className="gap-1.5" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" />
              {t('customTemplates.actions.retry')}
            </Button>
          ) : null}
        </DialogFooter>

        <EditCustomTemplateDialog
          open={editingTemplate !== null}
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={handleEditSaved}
        />
        <DuplicateCustomTemplateDialog
          open={duplicatingTemplate !== null}
          template={duplicatingTemplate}
          onClose={() => setDuplicatingTemplate(null)}
          onDuplicated={handleDuplicated}
        />
        <DeleteCustomTemplateDialog
          open={deletingTemplate !== null}
          template={deletingTemplate}
          onClose={() => setDeletingTemplate(null)}
          onDeleted={handleDeleted}
          onReload={() => void reload()}
        />
        <CopyBuiltinTemplateDialog
          open={copyBuiltinOpen}
          onClose={() => setCopyBuiltinOpen(false)}
          onCopied={handleCopied}
          initialBuiltinId={copyBuiltinId ?? undefined}
        />
        <ImportCustomTeamTemplateDialog
          open={importOpen}
          onClose={() => {
            setImportOpen(false);
            void reload();
          }}
        />
        {exportingTemplate && (
          <ExportCustomTeamTemplateDialog
            open={true}
            templateId={exportingTemplate.templateId}
            templateName={exportingTemplate.name}
            onClose={() => setExportingTemplate(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
