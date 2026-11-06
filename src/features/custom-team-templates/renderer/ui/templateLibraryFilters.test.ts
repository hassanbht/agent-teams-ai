import { describe, it, expect } from 'vitest';

import {
  composeCustomTemplates,
  composeBuiltinTemplates,
  type TemplateSortOption,
  type MemberCountFilter,
} from './templateLibraryFilters';

import type { CustomTeamTemplateV1 } from '@features/custom-team-templates/contracts';
import { TEAM_TEMPLATES } from '@features/team-templates';

const mk = (
  id: string,
  name: string,
  description: string,
  members: string[]
): CustomTeamTemplateV1 =>
  ({
    templateId: id,
    name,
    description,
    members: members.map((n) => ({ name: n, role: n, prompt: '' })),
    createdAt: '2024-01-01T00:00:00.000Z',
  }) as unknown as CustomTeamTemplateV1;

const base = [
  mk('1', 'Alpha', 'first desc', ['Alice', 'Bob']),
  mk('2', 'beta', 'Second', ['carol']),
  mk('3', 'Gamma', 'third', ['Dave', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan']),
  mk('4', 'delta', 'no members', []),
];

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

describe('templateLibraryFilters', () => {
  it('searches by name', () => {
    const out = composeCustomTemplates(base, 'alpha', 'all', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1']);
  });
  it('searches by description', () => {
    const out = composeCustomTemplates(base, 'second', 'all', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['2']);
  });
  it('searches by member name', () => {
    const out = composeCustomTemplates(base, 'carol', 'all', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['2']);
  });
  it('is case-insensitive', () => {
    const out = composeCustomTemplates(base, 'ALPHA', 'all', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1']);
  });
  it('trims query', () => {
    const out = composeCustomTemplates(base, '  alpha  ', 'all', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1']);
  });
  it('empty/whitespace query returns all', () => {
    expect(composeCustomTemplates(base, '', 'all', 'original', collator)).toHaveLength(4);
    expect(composeCustomTemplates(base, '   ', 'all', 'original', collator)).toHaveLength(4);
  });
  it('unicode matching', () => {
    const u = [mk('u', 'Café', 'desc', ['Zoë'])];
    expect(composeCustomTemplates(u, 'café', 'all', 'original', collator)).toHaveLength(1);
    expect(composeCustomTemplates(u, 'zoë', 'all', 'original', collator)).toHaveLength(1);
  });
  it('does not search team prompt/workflow', () => {
    const out = composeCustomTemplates(base, 'prompt', 'all', 'original', collator);
    expect(out).toHaveLength(0);
  });
  it('does not mutate source', () => {
    const copy = [...base];
    composeCustomTemplates(base, 'alpha', 'all', 'name-asc', collator);
    expect(base).toEqual(copy);
  });

  it('sorts name asc', () => {
    const out = composeCustomTemplates(base, '', 'all', 'name-asc', collator);
    expect(out.map((t) => t.name)).toEqual(['Alpha', 'beta', 'delta', 'Gamma']);
  });
  it('sorts name desc', () => {
    const out = composeCustomTemplates(base, '', 'all', 'name-desc', collator);
    expect(out.map((t) => t.name)).toEqual(['Gamma', 'delta', 'beta', 'Alpha']);
  });
  it('sorts members asc', () => {
    const out = composeCustomTemplates(base, '', 'all', 'members-asc', collator);
    expect(out.map((t) => t.templateId)).toEqual(['4', '2', '1', '3']);
  });
  it('sorts members desc', () => {
    const out = composeCustomTemplates(base, '', 'all', 'members-desc', collator);
    expect(out.map((t) => t.templateId)).toEqual(['3', '1', '2', '4']);
  });
  it('original order default', () => {
    const out = composeCustomTemplates(base, '', 'all', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1', '2', '3', '4']);
  });

  it('filters single', () => {
    const out = composeCustomTemplates(base, '', 'single', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['2']);
  });
  it('filters small (2-5)', () => {
    const out = composeCustomTemplates(base, '', 'small', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1']);
  });
  it('filters large (6+)', () => {
    const out = composeCustomTemplates(base, '', 'large', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['3']);
  });
  it('filter all', () => {
    expect(composeCustomTemplates(base, '', 'all', 'original', collator)).toHaveLength(4);
  });

  it('composition search+filter+sort', () => {
    const out = composeCustomTemplates(base, '', 'all', 'name-asc', collator);
    expect(out.map((t) => t.name)).toEqual(['Alpha', 'beta', 'delta', 'Gamma']);
  });

  it('clear search retains filter/sort', () => {
    const filtered = composeCustomTemplates(base, 'alpha', 'all', 'name-asc', collator);
    expect(filtered).toHaveLength(1);
    const cleared = composeCustomTemplates(base, '', 'all', 'name-asc', collator);
    expect(cleared).toHaveLength(4);
  });

  it('reset all restores original', () => {
    const out = composeCustomTemplates(base, '', 'all', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1', '2', '3', '4']);
  });

  it('stable tie ordering', () => {
    const ties = [mk('a', 'Same', 'd', ['x']), mk('b', 'Same', 'd', ['y'])];
    const out = composeCustomTemplates(ties, '', 'all', 'name-asc', collator);
    expect(out.map((t) => t.templateId)).toEqual(['a', 'b']);
  });

  it('handles empty members', () => {
    const out = composeCustomTemplates(base, '', 'single', 'original', collator);
    expect(out.map((t) => t.templateId)).not.toContain('4');
  });

  it('built-in compose works', () => {
    const out = composeBuiltinTemplates(TEAM_TEMPLATES, '', 'all', 'original', collator, (k) => k);
    expect(out.length).toBe(TEAM_TEMPLATES.length);
  });

  it('sorts names with Unicode collation', () => {
    const unicode = [
      mk('z', 'Zebra', 'd', ['x']),
      mk('a', 'Ärzte', 'd', ['x']),
      mk('b', 'Apfel', 'd', ['x']),
    ];
    const out = composeCustomTemplates(unicode, '', 'all', 'name-asc', collator);
    const names = out.map((t) => t.name);
    for (let i = 0; i < names.length - 1; i += 1) {
      expect(collator.compare(names[i], names[i + 1])).toBeLessThanOrEqual(0);
    }
  });

  it('sorts by name after search', () => {
    const out = composeCustomTemplates(base, 'a', 'all', 'name-asc', collator);
    const names = out.map((t) => t.name);
    for (let i = 0; i < names.length - 1; i += 1) {
      expect(collator.compare(names[i], names[i + 1])).toBeLessThanOrEqual(0);
    }
  });

  it('composition search + filter', () => {
    const out = composeCustomTemplates(base, 'a', 'small', 'original', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1']);
  });

  it('composition filter + sort', () => {
    const out = composeCustomTemplates(base, '', 'small', 'name-asc', collator);
    expect(out.map((t) => t.templateId)).toEqual(['1']);
  });

  it('composition full pipeline preserves pipeline order', () => {
    const out = composeCustomTemplates(base, 'a', 'all', 'members-desc', collator);
    expect(out.map((t) => t.templateId)).toEqual(['3', '1', '2', '4']);
  });

  it('clear filter retains search and sort', () => {
    const withFilter = composeCustomTemplates(base, 'a', 'small', 'name-asc', collator);
    expect(withFilter).toHaveLength(1);
    const clearedFilter = composeCustomTemplates(base, 'a', 'all', 'name-asc', collator);
    expect(clearedFilter.map((t) => t.name)).toEqual(['Alpha', 'beta', 'delta', 'Gamma']);
  });

  it('filter does not mutate input array', () => {
    const input = [...base];
    composeCustomTemplates(base, '', 'single', 'original', collator);
    expect(base).toEqual(input);
  });

  it('treats non-array members as zero for filtering', () => {
    const malformed = [
      {
        templateId: 'm',
        name: 'M',
        description: 'd',
        members: undefined,
        createdAt: '2024-01-01T00:00:00.000Z',
      } as unknown as CustomTeamTemplateV1,
    ];
    expect(composeCustomTemplates(malformed, '', 'all', 'original', collator)).toHaveLength(1);
    expect(composeCustomTemplates(malformed, '', 'single', 'original', collator)).toHaveLength(0);
    expect(composeCustomTemplates(malformed, '', 'small', 'original', collator)).toHaveLength(0);
    expect(composeCustomTemplates(malformed, '', 'large', 'original', collator)).toHaveLength(0);
  });
});
