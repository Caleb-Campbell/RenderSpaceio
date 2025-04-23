'use client';

import { useState, useCallback } from 'react'; // Import useCallback
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, MoreHorizontal, Download, Redo } from 'lucide-react';
import Image from 'next/image';
import type { renderJobs } from '@/lib/db/schema'; // Import the type

// Define the props type based on the renderJobs schema and filterOptions
type RenderJob = typeof renderJobs.$inferSelect;
interface FilterOptions {
  roomTypes: { value: string; label: string }[];
  sortBy: { value: string; label: string }[];
}

interface GalleryClientComponentProps {
  initialRenders: RenderJob[];
  filterOptions: FilterOptions;
}

// Helper function to get a readable room type label
function getRoomTypeLabel(roomTypeId: string | null): string {
  if (!roomTypeId) return 'Unknown';
  switch (roomTypeId) {
    case 'living_room': return 'Living Room';
    case 'bedroom': return 'Bedroom';
    case 'kitchen': return 'Kitchen';
    case 'bathroom': return 'Bathroom';
    case 'office': return 'Home Office';
    case 'dining_room': return 'Dining Room';
    default: return roomTypeId.replace('_', ' ');
  }
}

// Helper function to get a readable lighting label
function getLightingLabel(lightingId: string | null): string {
  if (!lightingId) return 'Unknown';
  switch (lightingId) {
    case 'bright': return 'Bright';
    case 'moody': return 'Moody';
    case 'warm': return 'Warm';
    default: return lightingId.charAt(0).toUpperCase() + lightingId.slice(1);
  }
}

export default function GalleryClientComponent({
  initialRenders,
  filterOptions,
}: GalleryClientComponentProps) {
  const router = useRouter();
  const [selectedRender, setSelectedRender] = useState<string | null>(null); // Changed type to string
  const [filter, setFilter] = useState({
    roomType: 'all',
    sortBy: 'newest'
  });

  // Filter renders based on selected options (client-side)
  const filteredRenders = initialRenders
    .filter(render => filter.roomType === 'all' || render.roomType === filter.roomType)
    .sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      if (filter.sortBy === 'newest') {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });

  // Handle render click to preview
  const handleRenderClick = (renderId: string) => { // Changed type to string
    setSelectedRender(selectedRender === renderId ? null : renderId);
  };

  // Handle view details - Updated to use path parameter
  const handleViewDetails = (renderId: string) => { // Changed type to string
    router.push(`/dashboard/result/${renderId}`); // Changed from query param to path param
  };

  // Handle download
  const handleDownload = useCallback((imageUrl: string | null | undefined, filename: string) => {
    if (!imageUrl) return;
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = imageUrl;
    // Suggest a filename (browser might override)
    link.download = filename || 'render-image.png'; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Renders</h1>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => router.push('/dashboard/new-render')}>
            <Plus className="h-4 w-4 mr-2" />
            New Render
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Type
            </label>
            <select
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500"
              value={filter.roomType}
              onChange={(e) => setFilter({...filter, roomType: e.target.value})}
            >
              {filterOptions.roomTypes.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500"
              value={filter.sortBy}
              onChange={(e) => setFilter({...filter, sortBy: e.target.value})}
            >
              {filterOptions.sortBy.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Renders Grid */}
      {filteredRenders.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRenders.map((render) => (
            <Card
              key={render.id}
              className={`overflow-hidden cursor-pointer transition-all duration-200 ${
                selectedRender === render.id ? 'ring-2 ring-orange-500' : ''
              }`}
              onClick={() => handleRenderClick(render.id)}
            >
              <div className="relative aspect-video bg-gray-100">
                {render.resultImagePath ? (
                  <Image
                    src={render.resultImagePath}
                    alt={render.title || 'Rendered image'}
                    fill // Use fill instead of layout="fill"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" // Add sizes prop
                    style={{ objectFit: 'cover' }} // Use style instead of objectFit
                    className="bg-gray-200" // Background while loading
                    priority={filteredRenders.indexOf(render) < 3} // Prioritize loading first few images
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    Processing... {/* Or a placeholder */}
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900 truncate">
                      {render.title || `Render #${render.id}`} {/* Fallback title */}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {render.createdAt instanceof Date
                        ? render.createdAt.toLocaleDateString()
                        : new Date(render.createdAt).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex gap-2 flex-wrap"> {/* Added flex-wrap */}
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                        {getRoomTypeLabel(render.roomType)}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                        {getLightingLabel(render.lighting)}
                      </span>
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"> {/* Added flex-shrink-0 */}
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                {selectedRender === render.id && (
                  <div className="mt-4 space-y-4"> 
                    {/* Input Image Preview */}
                    {render.inputImagePath && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Input Image:</p>
                        <div className="relative aspect-video bg-gray-100 rounded overflow-hidden">
                           <Image
                              src={render.inputImagePath}
                              alt="Input image"
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              style={{ objectFit: 'contain' }} // Use contain to show the whole image
                              className="bg-gray-200"
                            />
                        </div>
                      </div>
                    )}
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[calc(33%-0.5rem)]" // Ensure buttons wrap nicely
                        onClick={(e) => { e.stopPropagation(); handleViewDetails(render.id); }} // Stop propagation
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[calc(33%-0.5rem)]"
                        // Use the handleDownload function
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleDownload(render.resultImagePath, `${render.title || 'render'}_result.png`); 
                        }} 
                        disabled={!render.resultImagePath} // Disable if no result image
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[calc(33%-0.5rem)]"
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/customize?roomType=${render.roomType}&clone=${render.id}`); }} // Stop propagation
                      >
                        <Redo className="h-3 w-3 mr-1" />
                        Similar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">No renders found</h3>
          <p className="mt-2 text-gray-500">
            You haven't created any renders yet.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push('/dashboard/new-render')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Render
          </Button>
        </div>
      )}
    </div>
  );
}
