import OpenAI from 'openai';
import fs from 'fs/promises'; // Use promises for async file reading
import path from 'path'; // Import path module
import fetch from 'node-fetch'; // Keep for potential fallbacks or other uses
import { Readable } from 'stream';
import { uploadRenderedImage, type UploadResult } from '@/lib/uploadthing'; // Import upload function

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 180000, // 3-minute timeout
    })
  : null;

// Removed UTApi initialization

// File types for UploadThing
type FileWithPath = {
  filepath: string;
  type: string;
  name: string;
};

type RenderParams = {
  inputImagePath: string; // Renamed from collageImagePath
  roomType: string;
  lighting: string;
  userId: string; // Keep userId if needed for context/logging within OpenAI call
  customPrompt?: string; // Optional custom prompt
  emptyRoomImageUrl?: string; // Optional URL of the pre-generated empty room image to provide context
};

// Define the result type for OpenAI calls that return image data
export type OpenAIImageDataResult = {
  success: boolean;
  imageData?: string; // Base64 encoded image data
  prompt?: string;
  error?: string;
};

// Define the result type for functions that return an image URL after processing/uploading
export type ProcessedImageUrlResult = {
    success: boolean;
    imageUrl?: string; // URL of the processed image
    prompt?: string; // Prompt used, if applicable
    error?: string;
};


/**
 * Calls OpenAI to generate an interior design visualization using the images.edit endpoint.
 * @param params The parameters for the render request
 * @returns An object containing the OpenAI result (image data as base64) or error
 */
export async function callOpenAI(params: RenderParams): Promise<OpenAIImageDataResult> {
  const { inputImagePath, roomType, lighting, userId } = params;
  console.log(`[callOpenAI] Starting for user ${userId}. Input: ${inputImagePath}`);

  try {
    // Check if OpenAI is properly initialized
    if (!openai) {
      console.warn('[callOpenAI] OpenAI API key not configured. Using mock response.');
      // Return mock response for development/build without API key
      // Generate a placeholder base64 image for testing if needed, or return error/specific flag
      return {
        success: false, // Indicate failure if not configured
        error: 'OpenAI not configured',
        prompt: `Mock prompt for ${roomType} with ${lighting} lighting.`,
      };
    }

    // 1. Get the input image buffer (fetch from URL or read from local path)
    let imageBuffer: Buffer;
    try {
      if (inputImagePath.startsWith('http://') || inputImagePath.startsWith('https://')) {
        console.log(`[callOpenAI] Fetching input image from URL: ${inputImagePath}`);
        const response = await fetch(inputImagePath);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        const fullImagePath = path.join(process.cwd(), inputImagePath);
        console.log(`[callOpenAI] Reading input image from local path: ${fullImagePath}`);
        imageBuffer = await fs.readFile(fullImagePath);
      }
      console.log(`[callOpenAI] Input image buffer size: ${imageBuffer.length} bytes`);
    } catch (fetchOrReadError) {
      console.error(`[callOpenAI] Error getting input image (${inputImagePath}):`, fetchOrReadError);
      throw new Error(`Failed to get input image: ${inputImagePath}`);
    }

    // 2. Determine prompt and execute appropriate API call based on context
    let finalPrompt: string;
    let apiResult: OpenAIImageDataResult;

    if (params.emptyRoomImageUrl) {
      // --- 2-Step Flow: Use images.generate ---
      console.log(`[callOpenAI] 2-Step Flow: Using images.generate with empty room context from URL: ${params.emptyRoomImageUrl}`);
      // Prompt describes the target scene, referencing the collage style abstractly
      const basePrompt = `Generate a photorealistic interior design visualization of a ${roomType} with ${lighting} lighting. The scene should be set within an empty room context (walls, floor, ceiling, windows, doors). Incorporate design elements, patterns, and the overall aesthetic inspired by a user-provided collage image. The final image should look like the collage's design has been implemented in a real, empty room.`;
      finalPrompt = params.customPrompt || basePrompt;
      console.log(`[callOpenAI] Using generation prompt: "${finalPrompt.substring(0, 100)}..."`);

      const apiParams = {
        model: "dall-e-3", // Use a generation model like DALL-E 3
        prompt: finalPrompt,
        n: 1,
        size: "1024x1024" as const,
        response_format: "b64_json" as const, // Request base64 directly
        // No 'image' parameter for generation
      };
      console.log(`[callOpenAI] Calling OpenAI images.generate API...`);

      try {
        const response = await openai.images.generate(apiParams);
        console.log(`[callOpenAI] OpenAI images.generate call successful.`);

        const image_base64 = response.data[0]?.b64_json;
        if (!image_base64) {
          console.error("[callOpenAI] OpenAI generation response missing b64_json:", response);
          throw new Error('No b64_json in OpenAI images.generate response');
        }

        apiResult = {
          success: true,
          imageData: image_base64,
          prompt: finalPrompt,
        };

      } catch (openaiError: any) {
        console.error(`[callOpenAI] Error during images.generate:`, openaiError);
        // Log details similar to the edit error handling
        if (openaiError.response) {
          console.error("[callOpenAI] Response Status:", openaiError.response.status);
          console.error("[callOpenAI] Response Data:", openaiError.response.data);
        } else {
          console.error("[callOpenAI] Error Message:", openaiError.message);
        }
        apiResult = {
          success: false,
          error: `OpenAI API generation error: ${openaiError.message || 'Unknown error'}`,
          prompt: finalPrompt,
        };
      }

    } else {
      // --- Standard Flow: Use images.edit ---
      console.log(`[callOpenAI] Standard Flow: Using images.edit`);
      // Original prompt generation if no empty room context is given
      const basePrompt = `Transform this collage image into a photorealistic interior design visualization of a ${roomType} with ${lighting} lighting. Maintain the key design elements, patterns, and style from the collage but render it as a realistic 3D scene.`;
      finalPrompt = params.customPrompt || basePrompt;
      console.log(`[callOpenAI] Using edit prompt: "${finalPrompt.substring(0, 100)}..."`);

      const apiParams = {
        // Consider if a different edit model is better, but keep gpt-image-1 for now
        model: "gpt-image-1", // DO NOT CHANGE THIS MODEL
        prompt: finalPrompt,
        n: 1,
        size: "1024x1024" as const,
        // response_format: "b64_json" as const, // Removed based on API error
      };
      console.log(`[callOpenAI] Calling OpenAI images.edit API...`);

      try {
        const imageName = `input_collage_${Date.now()}.png`;
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
        const imageFile = new File([imageBlob], imageName, { type: 'image/png' });

        console.log(`[callOpenAI] Sending imageFile: name=${imageFile.name}, size=${imageFile.size}, type=${imageFile.type}`);
        // Pass the collage image here
        const response = await openai.images.edit({ ...apiParams, image: imageFile });
        console.log(`[callOpenAI] OpenAI images.edit call successful.`);

        const image_base64 = response.data[0]?.b64_json;
        if (!image_base64) {
          console.error("[callOpenAI] OpenAI edit response missing b64_json:", response);
          throw new Error('No b64_json in OpenAI images.edit response');
        }

        apiResult = {
          success: true,
          imageData: image_base64,
          prompt: finalPrompt,
        };

      } catch (openaiError: any) {
        console.error(`[callOpenAI] Error during images.edit:`, openaiError);
        // Log details as before
        if (openaiError.response) {
          console.error("[callOpenAI] Response Status:", openaiError.response.status);
          console.error("[callOpenAI] Response Data:", openaiError.response.data);
        } else {
          console.error("[callOpenAI] Error Message:", openaiError.message);
          if (openaiError.code === 'ETIMEDOUT' || openaiError.message?.includes('timeout')) {
            console.error("[callOpenAI] Request timed out.");
          }
        }
        apiResult = {
          success: false,
          error: `OpenAI API edit error: ${openaiError.message || 'Unknown error'}`,
          prompt: finalPrompt,
        };
      }
    }

    // Return the result from the executed path
    return apiResult;

  } catch (error) {
    console.error('[callOpenAI] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error during OpenAI call.',
    };
  }
}

// Removed deprecated generateRender function and RenderResult type

/**
 * Placeholder function to generate an empty room from a photo.
 * TODO: Implement the actual AI call for furniture removal.
 * @param roomPhotoUrl URL or path to the original room photo.
 * @returns An object containing the result (URL of the generated empty room image) or error.
 */
export async function generateEmptyRoom(roomPhotoUrl: string): Promise<ProcessedImageUrlResult> {
  console.log(`[generateEmptyRoom] Starting for room photo: ${roomPhotoUrl}`);

  if (!openai) {
    console.warn('[generateEmptyRoom] OpenAI API key not configured.');
    return { success: false, error: 'OpenAI not configured' };
  }

  try {
    // 1. Get the input room photo buffer
    let imageBuffer: Buffer;
    try {
      if (roomPhotoUrl.startsWith('http://') || roomPhotoUrl.startsWith('https://')) {
        console.log(`[generateEmptyRoom] Fetching room photo from URL: ${roomPhotoUrl}`);
        const response = await fetch(roomPhotoUrl);
        if (!response.ok) throw new Error(`Failed to fetch room photo: ${response.statusText}`);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        // Assuming it might be a local path during testing, adjust if only URLs are expected
        const fullImagePath = path.join(process.cwd(), roomPhotoUrl);
        console.log(`[generateEmptyRoom] Reading room photo from local path: ${fullImagePath}`);
        imageBuffer = await fs.readFile(fullImagePath);
      }
      console.log(`[generateEmptyRoom] Room photo buffer size: ${imageBuffer.length} bytes`);
    } catch (fetchOrReadError) {
      console.error(`[generateEmptyRoom] Error getting room photo (${roomPhotoUrl}):`, fetchOrReadError);
      throw new Error(`Failed to get room photo: ${roomPhotoUrl}`);
    }

    // 2. Create the prompt for furniture removal
    const removalPrompt = "Remove all furniture (sofas, chairs, tables, beds, shelves, etc.), rugs, carpets, and all wall art (paintings, photos, decorations) from this room image. Leave only the empty room structure (walls, floor, ceiling, windows, doors).";
    console.log(`[generateEmptyRoom] Using removal prompt: "${removalPrompt.substring(0, 100)}..."`);

    // 3. Make the API call to OpenAI images.edit
    const apiParams = {
      model: "gpt-image-1", // Or potentially a model better suited for inpainting/removal if available
      prompt: removalPrompt,
      n: 1,
      size: "1024x1024" as const,
      // mask: ??? // Ideally, a mask would be provided for better results, but generating one is complex. Relying on prompt for now.
    };
    console.log(`[generateEmptyRoom] Calling OpenAI images.edit API...`);

    try {
      const imageName = `room_photo_${Date.now()}.png`; // Use appropriate naming
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' }); // Assuming PNG is acceptable, adjust if needed
      const imageFile = new File([imageBlob], imageName, { type: 'image/png' });

      console.log(`[generateEmptyRoom] Sending imageFile: name=${imageFile.name}, size=${imageFile.size}, type=${imageFile.type}`);

      // --- Retry Logic ---
      let response;
      let lastError: any = null;
      const maxRetries = 3;
      const initialDelay = 1000; // 1 second

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[generateEmptyRoom] Attempt ${attempt}/${maxRetries} calling OpenAI images.edit API...`);
          response = await openai.images.edit({ ...apiParams, image: imageFile });
          console.log(`[generateEmptyRoom] OpenAI images.edit call successful on attempt ${attempt}.`);
          lastError = null; // Clear last error on success
          break; // Exit loop on success
        } catch (error: any) {
          lastError = error;
          console.warn(`[generateEmptyRoom] Attempt ${attempt}/${maxRetries} failed:`, error.message);
          // Check if it's a retryable error (like ECONNRESET) and if we haven't reached max retries
          if ((error.code === 'ECONNRESET' || error.type === 'system') && attempt < maxRetries) {
            const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`[generateEmptyRoom] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error(`[generateEmptyRoom] Non-retryable error or max retries reached on attempt ${attempt}.`);
            throw error; // Re-throw the error if not retryable or max retries hit
          }
        }
      }

      // If response is still undefined after retries, throw the last error encountered
      if (!response) {
         console.error(`[generateEmptyRoom] Failed after ${maxRetries} attempts.`);
         throw lastError || new Error('Unknown error after retries');
      }
      // --- End Retry Logic ---

      const image_base64 = response.data[0]?.b64_json;
      if (!image_base64) {
         console.error("[generateEmptyRoom] OpenAI response missing b64_json:", response);
         throw new Error('No b64_json in OpenAI images.edit response for empty room generation');
       }
 
       // --- Upload the generated empty room image ---
       console.log("[generateEmptyRoom] Uploading generated empty room image...");
       const uploadResult = await uploadRenderedImage({
        imageData: image_base64,
        // filename: `empty_room_${Date.now()}.png` // Optional: provide a filename
      });

      if (!uploadResult.success || !uploadResult.imageUrl) {
        console.error("[generateEmptyRoom] Failed to upload generated empty room image:", uploadResult.error);
        // Return failure, but include the prompt used
        return {
          success: false,
          error: `Failed to upload empty room image: ${uploadResult.error || 'Unknown upload error'}`,
          prompt: removalPrompt,
        };
      }
      console.log(`[generateEmptyRoom] Empty room image uploaded successfully: ${uploadResult.imageUrl}`);
      // --- End Upload ---

      // Return success with the IMAGE URL
      return {
        success: true,
        imageUrl: uploadResult.imageUrl, // Return the URL, not the base64
        prompt: removalPrompt, // Return the prompt used
      };


    } catch (openaiError: any) {
      console.error(`[generateEmptyRoom] Error during images.edit:`, openaiError);
      // Log details as before
      if (openaiError.response) {
        console.error("[generateEmptyRoom] Response Status:", openaiError.response.status);
        console.error("[generateEmptyRoom] Response Data:", openaiError.response.data);
      } else {
         console.error("[generateEmptyRoom] Error Message:", openaiError.message);
         if (openaiError.code === 'ETIMEDOUT' || openaiError.message?.includes('timeout')) {
           console.error("[generateEmptyRoom] Request timed out.");
         }
      }
      // Return failure status consistent with ProcessedImageUrlResult
      return {
        success: false,
        error: `OpenAI API error during empty room generation: ${openaiError.message || 'Unknown error'}`,
        prompt: removalPrompt, // Include prompt even on failure
      };
    }
  } catch (error) {
    console.error('[generateEmptyRoom] Unexpected error:', error);
    // Return failure status consistent with ProcessedImageUrlResult
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error during empty room generation.',
      // No prompt available here as it's defined within the try block
    };
  }
}

export async function uploadImage(fileUrl: string) {
  // This function now just returns the URL from uploadthing
  try {
    return {
      success: true,
      imagePath: fileUrl,
    };
  } catch (error) {
    console.error('Error processing uploaded image:', error);
    return {
      success: false,
      error: 'Failed to process uploaded image. Please try again.',
    };
  }
}
