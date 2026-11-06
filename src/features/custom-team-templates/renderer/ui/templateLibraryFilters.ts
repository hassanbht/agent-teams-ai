import type { CustomTeamTemplateV1 } from '@features/custom-team-templates/contracts';
import type { TeamTemplateV1 } from '@features/team-templates';

export type TemplateSortOption =
  | 'original'
  | 'name-asc'
  | 'name-desc'
  | 'members-asc'
  | 'members-desc';

export type MemberCountFilter = 'all' | 'single' | 'small' | 'large';

export const normalizeSearchQuery = (value: string): string => value.trim().toLocaleLowerCase();

export const matchesSearch = (haystack: string, query: string): boolean => {
  if (!query) return true;
  return haystack.toLocaleLowerCase().includes(query);
};

export const searchCustomTemplate = (template: CustomTeamTemplateV1, query: string): boolean => {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  const parts = [template.name, template.description ?? '', ...template.members.map((m) => m.name)];
  return parts.some((p) => matchesSearch(p, q));
};

export const filterCustomByMemberCount = (
  template: CustomTeamTemplateV1,
  filter: MemberCountFilter
): boolean => {
  const count = Array.isArray(template.members) ? template.members.length : 0;
  switch (filter) {
    case 'all':
      return true;
    case 'single':
      return count === 1;
    case 'small':
      return count >= 2 && count <= 5;
    case 'large':
      return count >= 6;
    default:
      return true;
  }
};

export const sortCustomTemplates = (
  templates: readonly CustomTeamTemplateV1[],
  sort: TemplateSortOption,
  collator: Intl.Collator
): CustomTeamTemplateV1[] => {
  const copy = [...templates];
  if (sort === 'original') return copy;
  return copy.sort((a, b) => {
    if (sort === 'name-asc' || sort === 'name-desc') {
      const cmp = collator.compare(a.name, b.name);
      return sort === 'name-asc' ? cmp : -cmp;
    }
    const ca = Array.isArray(a.members) ? a.members.length : 0;
    const cb = Array.isArray(b.members) ? b.members.length : 0;
    if (ca !== cb) return sort === 'members-asc' ? ca - cb : cb - ca;
    return 0;
  });
};

export const composeCustomTemplates = (
  templates: readonly CustomTeamTemplateV1[],
  query: string,
  memberFilter: MemberCountFilter,
  sort: TemplateSortOption,
  collator: Intl.Collator
): CustomTeamTemplateV1[] => {
  const searched = templates.filter((t) => searchCustomTemplate(t, query));
  const filtered = searched.filter((t) => filterCustomByMemberCount(t, memberFilter));
  return sortCustomTemplates(filtered, sort, collator);
};

// Built-in

export const searchBuiltinTemplate = (
  template: TeamTemplateV1,
  query: string,
  t: (key: string) => string
): boolean => {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  const name = t(`templates.names.${template.id}`);
  const desc = t(`templates.descriptions.${template.id}`);
  const parts = [name, desc, ...template.members.map((m) => m.role)];
  return parts.some((p) => matchesSearch(p, q));
};

export const filterBuiltinByMemberCount = (
  template: TeamTemplateV1,
  filter: MemberCountFilter
): boolean => {
  const count = template.members.length + 1;
  switch (filter) {
    case 'all':
      return true;
    case 'single':
      return count === 1;
    case 'small':
      return count >= 2 && count <= 5;
    case 'large':
      return count >= 6;
    default:
      return true;
  }
};

export const sortBuiltinTemplates = (
  templates: readonly TeamTemplateV1[],
  sort: TemplateSortOption,
  collator: Intl.Collator,
  t: (key: string) => string
): TeamTemplateV1[] => {
  const copy = [...templates];
  if (sort === 'original') return copy;
  return copy.sort((a, b) => {
    if (sort === 'name-asc' || sort === 'name-desc') {
      const cmp = collator.compare(t(`templates.names.${a.id}`), t(`templates.names.${b.id}`));
      return sort === 'name-asc' ? cmp : -cmp;
    }
    const ca = a.members.length + 1;
    const cb = b.members.length + 1;
    if (ca !== cb) return sort === 'members-asc' ? ca - cb : cb - ca;
    return 0;
  });
};

export const composeBuiltinTemplates = (
  templates: readonly TeamTemplateV1[],
  query: string,
  memberFilter: MemberCountFilter,
  sort: TemplateSortOption,
  collator: Intl.Collator,
  t: (key: string) => string
): TeamTemplateV1[] => {
  const searched = templates.filter((tmpl) => searchBuiltinTemplate(tmpl, query, t));
  const filtered = searched.filter((tmpl) => filterBuiltinByMemberCount(tmpl, memberFilter));
  return sortBuiltinTemplates(filtered, sort, collator, t);
};
