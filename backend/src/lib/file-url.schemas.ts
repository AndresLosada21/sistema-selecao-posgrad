import { z } from "zod";

function isInternalUploadUrl(value: string) {
  return value.startsWith("/v1/uploads/");
}

function isHttpsUrl(value: string) {
  return /^https:\/\//i.test(value);
}

function hasAllowedExtension(value: string, extensions: string[]) {
  const lower = value.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
}

export const internalOrHttpsUrlSchema = z.string().trim().refine((value) => isInternalUploadUrl(value) || isHttpsUrl(value), {
  message: "Invalid url",
});

export const pdfFileUrlSchema = internalOrHttpsUrlSchema.refine((value) => hasAllowedExtension(value, [".pdf"]), {
  message: "Invalid url",
});

export const imageFileUrlSchema = internalOrHttpsUrlSchema.refine((value) => hasAllowedExtension(value, [".png", ".jpg", ".jpeg"]), {
  message: "Invalid url",
});
