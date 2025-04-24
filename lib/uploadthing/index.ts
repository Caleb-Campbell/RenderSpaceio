import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server"; // Import UploadThingError
import { getSessionUser } from "../auth/session";

const f = createUploadthing();

export const uploadRouter = {
  // Define the full image uploader logic directly here
  imageUploader: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      console.log("UploadThing: Starting middleware check...");
      // Get user from session to verify authentication
      const user = await getSessionUser();
      console.log("UploadThing: Fetched user session.");
 
      if (!user) {
        console.error("UploadThing: Middleware check failed - Unauthorized.");
        throw new Error("Unauthorized");
      }
      console.log("UploadThing: Middleware check passed for userId:", user.id);
 
      // Return user data to be available in onUploadComplete
      return { userId: user.id };
    })
    .onUploadError(({ error }: { error: UploadThingError }) => { // Moved before onUploadComplete
      console.log("UploadThing: Entering onUploadError callback...");
      // This code runs on upload error
      console.error("UploadThing: Upload error occurred:", error.message, error.cause); // Log the error message and cause
      // UploadThing handles sending the error response to the client.
      console.log("UploadThing: Exiting onUploadError callback.");
    })
    .onUploadComplete(async ({ metadata, file }) => { // Moved to be the last callback
      console.log("UploadThing: Entering onUploadComplete callback...");
      // This code runs after upload completes
      console.log("UploadThing: Upload complete for userId:", metadata.userId);
      console.log("UploadThing: File URL:", file.url);
      console.log("UploadThing: File details:", file); // Log the full file object

      // Potentially add database update logic here if needed

      console.log("UploadThing: Exiting onUploadComplete callback.");
      return { fileUrl: file.url, userId: metadata.userId };
    }),
}; // Removed 'satisfies FileRouter'

export type OurFileRouter = typeof uploadRouter;
