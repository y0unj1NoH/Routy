import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldError, FieldErrors, FieldValues, Resolver } from "react-hook-form";
import { z } from "zod";

function setErrorByPath(target: Record<string, unknown>, path: Array<string | number>, error: FieldError) {
  let cursor: Record<string, unknown> = target;

  for (let index = 0; index < path.length; index += 1) {
    const key = String(path[index]);
    const isLeaf = index === path.length - 1;

    if (isLeaf) {
      if (!Object.prototype.hasOwnProperty.call(cursor, key)) {
        cursor[key] = error;
      }
      return;
    }

    const next = cursor[key];
    if (!next || typeof next !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
}

function zodErrorToFieldErrors<TFieldValues extends FieldValues>(error: z.ZodError): FieldErrors<TFieldValues> {
  const fieldErrors: Record<string, unknown> = {};

  for (const issue of error.issues) {
    const issuePathRaw = issue.path.length > 0 ? issue.path : ["root"];
    const issuePath = issuePathRaw.map((segment) =>
      typeof segment === "symbol" ? String(segment) : segment
    );
    setErrorByPath(fieldErrors, issuePath, {
      type: issue.code,
      message: issue.message
    });
  }

  return fieldErrors as FieldErrors<TFieldValues>;
}

export function safeZodResolver<TFieldValues extends FieldValues>(schema: z.ZodTypeAny): Resolver<TFieldValues> {
  const baseResolver = zodResolver(schema) as unknown as Resolver<TFieldValues>;

  return async (values, context, options) => {
    try {
      return await baseResolver(values, context, options);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          values: {},
          errors: zodErrorToFieldErrors<TFieldValues>(error)
        } as ReturnType<Resolver<TFieldValues>>;
      }
      throw error;
    }
  };
}
