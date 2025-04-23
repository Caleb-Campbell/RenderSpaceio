'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, ShoppingCart, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ className }: { className?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={`w-full flex items-center justify-center ${className || ''}`}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Processing...
        </>
      ) : (
        <>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Purchase Credits
        </>
      )}
    </Button>
  );
}