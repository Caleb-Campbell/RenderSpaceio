"use client";

import React, { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea"; // Assuming you have a Textarea component
import { Label } from "@/components/ui/label";

export function CustomSurveyModal({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [response, setResponse] = useState("");
  const posthog = usePostHog();

  const handleSubmit = () => {
    if (response.trim() && posthog) {
      posthog.capture("custom_survey_submitted", {
        survey_question: "What can we do to help?",
        survey_response: response.trim(),
      });
      setResponse(""); // Clear response after submission
      setIsOpen(false); // Close the modal
      // Optionally, show a success message (e.g., using react-hot-toast)
      // toast.success("Thank you for your feedback!");
    } else if (!response.trim()) {
      // Handle empty submission if needed
      console.warn("Survey response cannot be empty.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Feedback</DialogTitle>
          <DialogDescription>
            We'd love to hear from you. What can we do to help?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 items-center gap-4">
            {/* Removed Label as Textarea doesn't typically need one like Input */}
            <Textarea
              id="survey-response"
              placeholder="Your feedback here..."
              value={response}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setResponse(e.target.value)
              }
              className="col-span-3 h-24" // Adjust height as needed
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit}>
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Example Usage (You would place this where you want the trigger button)
// import { CustomSurveyModal } from '@/components/CustomSurveyModal';
// import { Button } from '@/components/ui/button';
//
// function SomeComponent() {
//   return (
//     <CustomSurveyModal trigger={<Button>Give Feedback</Button>} />
//   );
// }
