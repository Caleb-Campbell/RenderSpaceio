import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "./index";

// Create type safe helper functions for UploadThing
export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

// Define additional types for better type safety
export type UploadFileResponse = {
  fileUrl: string;
  fileKey: string;
  fileName: string;
};