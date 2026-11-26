import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { fileTypeFromBuffer } from "file-type";
import multer from "multer";
import sharp from "sharp";
import { env } from "../config/env.js";
import { badRequest, HttpError } from "./http-error.js";
import { logger } from "./logger.js";

/**
 * Secure image uploads (docs/02-security.md):
 * 1. multer keeps the file in memory, max 5 MB, one file, no other fields worth trusting.
 * 2. The real type is read from the file's bytes (file-type). The filename and the browser's mimetype are ignored,
 *    so "shell.php" renamed to "photo.jpg" is rejected.
 * 3. sharp decodes and re-encodes the pixels: metadata (EXIF/GPS) is dropped, anything hidden after the image
 *    data is gone, size is capped at 2000 px. Gallery → WebP, try-on garment photo → JPEG on white.
 * 4. Saved under a random UUID name in UPLOAD_DIR (outside the code), served read-only at /uploads with nosniff.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
export const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);
const UPLOAD_NAME = /^\/uploads\/([0-9a-f-]{36}\.(?:webp|jpg))$/;

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, fieldSize: 1024, parts: 6 },
}).single("file");

/** Express middleware: parse one multipart "file" field, turning multer errors into friendly HTTP errors. */
export function receiveImage(req: Request, res: Response, next: NextFunction) {
  memory(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return next(new HttpError(413, "file_too_large", "That photo is larger than 5 MB. Please choose a smaller one."));
      return next(badRequest("Upload one photo in the “file” field."));
    }
    next(err);
  });
}

export type ImageKind = "gallery" | "tryon";

/** Validate + re-encode. Throws 400 for anything that isn't a real JPEG/PNG/WebP image. */
export async function processImage(file: Express.Multer.File | undefined, kind: ImageKind) {
  if (!file?.buffer?.length) throw badRequest("Choose a photo to upload.");
  const type = await fileTypeFromBuffer(file.buffer);
  if (!type || !ALLOWED.has(type.mime)) throw badRequest("Only JPEG, PNG or WebP photos can be uploaded.");

  let img = sharp(file.buffer, { limitInputPixels: 50_000_000, failOn: "error" })
    .rotate() // apply the camera's orientation before metadata is dropped
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
  try {
    const out =
      kind === "tryon"
        ? await img.flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true })
        : await (img = img.webp({ quality: 84 })).toBuffer({ resolveWithObject: true });
    return { buffer: out.data, ext: kind === "tryon" ? "jpg" : "webp", width: out.info.width, height: out.info.height };
  } catch {
    throw badRequest("That file couldn't be read as an image. Please try another photo.");
  }
}

/** Write to UPLOAD_DIR with a random name; returns the public URL (/uploads/<uuid>.<ext>). */
export async function saveImage(img: { buffer: Buffer; ext: string }) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${img.ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), img.buffer, { flag: "wx" });
  return `/uploads/${name}`;
}

/** Delete a file we uploaded. Ignores anything that isn't exactly one of our own /uploads names (no traversal). */
export async function deleteUpload(url: string | null | undefined) {
  const m = url ? UPLOAD_NAME.exec(url) : null;
  if (!m) return;
  try {
    await unlink(path.join(UPLOAD_DIR, m[1]!));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") logger.warn({ err, url }, "could not delete upload");
  }
}

/**
 * Review form with an optional photo: multipart with a JSON "data" field (≤ 8 KB) + optional "file".
 * Plain JSON requests pass straight through. After this, req.body is the parsed JSON object.
 */
const reviewForm = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, fieldSize: 8 * 1024, parts: 3 },
}).single("file");

export function receiveOptionalImageWithJson(req: Request, res: Response, next: NextFunction) {
  if (!req.is("multipart/form-data")) return next();
  reviewForm(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return next(new HttpError(413, "file_too_large", "That photo is larger than 5 MB. Please choose a smaller one."));
      return next(badRequest("Please check the form and try again."));
    }
    if (err) return next(err);
    try {
      req.body = JSON.parse(typeof req.body?.data === "string" ? req.body.data : "{}");
    } catch {
      return next(badRequest("Please check the form and try again."));
    }
    next();
  });
}
