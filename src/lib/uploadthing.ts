import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "./uploadthing-router";

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>({
  url: "/api/uploadthing",
});
