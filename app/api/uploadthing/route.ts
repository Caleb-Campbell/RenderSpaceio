import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "@/lib/uploadthing";

// Export routes for Next.js App Router
export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
});