'use client';

import { useCallback, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useDropzone } from '@uploadthing/react';
import { generateClientDropzoneAccept } from 'uploadthing/client';
import { useUploadThing } from '@/lib/uploadthing/hooks';
import Image from 'next/image';

interface UploadDropzoneProps {
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: Error) => void;
  onUploadStart?: () => void;
}

export function UploadDropzone({ 
  onUploadComplete, 
  onUploadError,
  onUploadStart
}: UploadDropzoneProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      if (res && res.length > 0) {
        // Get the file URL from the response
        const file = res[0];
        console.log("Upload complete response:", file);
        
        // Handle different response formats from UploadThing
        let fileUrl;
        if (typeof file === 'string') {
          fileUrl = file;
        } else if (file.url) {
          fileUrl = file.url;
        } else {
          // For the expected response from our router
          fileUrl = file.url;
          console.log("Using URL from our router:", fileUrl);
        }
        
        if (!fileUrl) {
          console.error("Unexpected file response format:", file);
          if (onUploadError) {
            onUploadError(new Error("Failed to get file URL from upload response"));
          }
          return;
        }
        
        console.log("Using file URL:", fileUrl);
        onUploadComplete(fileUrl);
      }
    },
    onUploadError: (error) => {
      console.error("Upload error:", error);
      if (onUploadError) {
        onUploadError(error);
      }
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Create a preview for the first file
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Notify parent that upload is starting
    if (onUploadStart) {
      onUploadStart();
    }

    // Start the upload
    startUpload(acceptedFiles);
  }, [startUpload, onUploadStart]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: generateClientDropzoneAccept(['image/jpeg', 'image/png', 'image/gif']),
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div 
      {...getRootProps()}
      className={`border-2 border-dashed rounded-sm p-12 flex flex-col items-center justify-center 
        cursor-pointer hover:bg-gray-50 transition-colors ${
          preview ? 'border-gray-300' : 'border-gray-200'
        }`}
    >
      <input {...getInputProps()} />
      
      {isUploading ? (
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-gray-400 mb-3 animate-spin" />
          <p className="text-sm text-gray-500">Uploading...</p>
        </div>
      ) : preview ? (
        <div className="relative w-full max-w-md h-64">
          <Image
            src={preview}
            alt="Design collage preview"
            fill
            className="object-contain"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <UploadCloud className="h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PNG, JPG, GIF up to 10MB
          </p>
        </div>
      )}
    </div>
  );
}