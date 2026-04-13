import { useId } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/utils/cn";
import type { MediaContentType } from "@/types";

export type MassDownloadMediaFilterValue = "all" | "images" | "videos";

export function mediaTypeMatchesMassDownloadFilter(
  mediaType: MediaContentType,
  filter: MassDownloadMediaFilterValue,
): boolean {
  if (filter === "all") return true;
  if (filter === "videos") return mediaType === "video";
  return mediaType === "single-image" || mediaType === "multiple-images";
}

const OPTIONS: { value: MassDownloadMediaFilterValue; label: string }[] = [
  { value: "all", label: "Images and videos" },
  { value: "images", label: "Images only" },
  { value: "videos", label: "Videos only" },
];

export type MassDownloadMediaFilterProps = {
  value: MassDownloadMediaFilterValue;
  onValueChange: (value: MassDownloadMediaFilterValue) => void;
  className?: string;
};

export function MassDownloadMediaFilter({
  value,
  onValueChange,
  className,
}: MassDownloadMediaFilterProps) {
  const labelId = useId();

  return (
    <div className={cn("space-y-2", className)}>
      <Label
        id={labelId}
        className="text-xs font-medium text-gray-600 dark:text-gray-300"
      >
        Media to download
      </Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onValueChange(v as MassDownloadMediaFilterValue)}
        aria-labelledby={labelId}
      >
        {OPTIONS.map((opt) => (
          <div key={opt.value} className="flex flex-row items-center space-x-2">
            <RadioGroupItem
              value={opt.value}
              id={`mass-download-media-${opt.value}`}
            />
            <Label
              htmlFor={`mass-download-media-${opt.value}`}
              className="text-xs text-gray-500 dark:text-gray-400 font-normal leading-none cursor-pointer"
            >
              {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
