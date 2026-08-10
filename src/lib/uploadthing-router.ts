import { createUploadthing, type FileRouter } from "uploadthing/server";

const f = createUploadthing();

export const uploadRouter = {
  itemImage: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } }).onUploadComplete(
    async ({ file }) => ({ url: (file as { ufsUrl?: string; url: string }).ufsUrl ?? file.url }),
  ),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
