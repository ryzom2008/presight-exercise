import { z } from "zod";

export class InvalidQuery extends Error {}

export const sortFields = [
  "first_name",
  "last_name",
  "age",
  "nationality",
] as const;
export type SortField = (typeof sortFields)[number];

const fold = (value: string) =>
  value.replace(/[A-Z]/g, (character) => character.toLowerCase());

const scalar = <T extends z.ZodType<unknown, string>>(
  schema: T,
  fallback: string,
) =>
  z
    .array(z.string())
    .max(1, "Must appear only once")
    .default([])
    .transform((values) => values[0] ?? fallback)
    .pipe(schema);

const filterValues = (max: number) =>
  z
    .array(z.string().max(100).trim().min(1).transform(fold))
    .max(max)
    .default([])
    .transform((values) => [...new Set(values)].sort());

const integerParameter = (maxLength: number, min: number, max: number) =>
  z
    .string()
    .max(maxLength)
    .regex(/^\d+$/, "Must contain only digits")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

const userQuerySchema = z
  .strictObject({
    q: scalar(z.string().max(200).trim().transform(fold), ""),
    nationality: filterValues(50),
    hobby: filterValues(10),
    sort: scalar(z.enum(sortFields), "first_name"),
    direction: scalar(z.enum(["asc", "desc"]), "asc"),
    limit: scalar(integerParameter(3, 1, 100), "20"),
    offset: scalar(integerParameter(16, 0, Number.MAX_SAFE_INTEGER), "0"),
  })
  .transform(({ nationality, hobby, ...query }) => ({
    ...query,
    nationalities: nationality,
    hobbies: hobby,
  }));

export type UserQuery = z.infer<typeof userQuerySchema>;

export const parseUserQuery = (params: URLSearchParams): UserQuery => {
  const input = Object.fromEntries(
    [...new Set(params.keys())].map((key) => [key, params.getAll(key)]),
  );
  const result = userQuerySchema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
      .join("; ");
    throw new InvalidQuery(message);
  }
  return result.data;
};
