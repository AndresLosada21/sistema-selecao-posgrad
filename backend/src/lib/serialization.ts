import { Prisma } from "@prisma/client";

export function toIsoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function toInputJsonOrDbNull(value: Prisma.JsonValue | object | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.DbNull;
}

export function toInputJsonOrUndefined(value: Prisma.JsonValue | object | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}
