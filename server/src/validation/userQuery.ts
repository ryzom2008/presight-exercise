import {
  NAME_SEARCH_MAX_LENGTH,
  isValidNameSearch,
  MAX_NATIONALITY_FILTERS,
  MAX_HOBBY_FILTERS,
  FILTER_VALUE_MAX_LENGTH,
} from '@presight/shared';
import type { SortFields } from '@presight/shared';
import { z } from 'zod';

export class InvalidQuery extends Error {}

export const sortFields = [
  'first_name',
  'last_name',
  'age',
  'nationality',
] as const satisfies SortFields;

const fold = (value: string) => value.replace(/[A-Z]/g, (character) => character.toLowerCase());

const filterValues = (max: number) =>
  z
    .array(z.string().max(FILTER_VALUE_MAX_LENGTH).trim().min(1).transform(fold))
    .max(max)
    .default([])
    .transform((values) => [...new Set(values)].sort());

const userFilterSchema = z.strictObject({
  q: z
    .string()
    .max(NAME_SEARCH_MAX_LENGTH)
    .refine(isValidNameSearch, { message: 'Invalid name search' })
    .transform((value) => fold(value.trim()))
    .default(''),
  nationalities: filterValues(MAX_NATIONALITY_FILTERS),
  hobbies: filterValues(MAX_HOBBY_FILTERS),
});

const userQuerySchema = userFilterSchema.extend({
  sort: z.enum(sortFields).default('first_name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
});

export type UserQuery = z.infer<typeof userQuerySchema>;

export type UserFilters = z.infer<typeof userFilterSchema>;

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`)
      .join('; ');
    throw new InvalidQuery(message);
  }
  return result.data;
};

export const parseUserQuery = (input: unknown): UserQuery => parse(userQuerySchema, input);
export const parseUserFilters = (input: unknown): UserFilters => parse(userFilterSchema, input);
