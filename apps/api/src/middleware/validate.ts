import type { Request } from "express";
import type { z } from "zod";
import { badRequest } from "../lib/http-error.js";

/** Parse and validate input with a Zod schema. Unknown keys are stripped; invalid input → 400. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      "Please check the highlighted fields",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

export const body = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.body);
export const query = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.query);
