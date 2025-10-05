import * as React from "react";
import { format, parseISO, isValid, startOfDay, endOfDay } from "date-fns";
import { isBefore, isAfter } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Icon } from "@iconify/react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }
  return format(date, "yyyy-MM-dd");
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return isValid(date);
}

interface DatePickerProps {
  value?: number;
  onChange: (timestamp: number | undefined) => void;
  placeholder?: string;
  className?: string;
  useEndOfDay?: boolean;
  onBlur?: () => void;
  name?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  useEndOfDay = false,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [month, setMonth] = React.useState<Date | undefined>(date);
  const [inputValue, setInputValue] = React.useState(formatDate(date));

  // Update when value prop changes
  React.useEffect(() => {
    const newDate = value ? new Date(value) : undefined;
    setDate(newDate);
    setInputValue(formatDate(newDate));
    setMonth(newDate);
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setInputValue(formatDate(selectedDate));
    setMonth(selectedDate);
    setOpen(false);

    if (selectedDate) {
      const timestamp = useEndOfDay
        ? endOfDay(selectedDate).getTime()
        : startOfDay(selectedDate).getTime();
      onChange(timestamp);
    } else {
      onChange(undefined);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    setInputValue(inputVal);

    if (inputVal === "") {
      setDate(undefined);
      onChange(undefined);
      return;
    }

    try {
      const parsedDate = parseISO(inputVal);
      if (isValidDate(parsedDate)) {
        setDate(parsedDate);
        setMonth(parsedDate);
        const timestamp = useEndOfDay
          ? endOfDay(parsedDate).getTime()
          : startOfDay(parsedDate).getTime();
        onChange(timestamp);
      }
    } catch (error) {
      // Invalid date, keep input value but don't update date
    }
  };

  const handleClear = () => {
    setDate(undefined);
    setInputValue("");
    onChange(undefined);
  };

  return (
    <div className="relative">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`bg-background pr-20 ${className}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        {...props}
      />
      <div className="absolute top-1/2 right-2 -translate-y-1/2 flex gap-1">
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={handleClear}
          >
            <Icon icon="lucide:x" className="h-3.5 w-3.5" />
          </Button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              <Icon icon="lucide:calendar" className="h-3.5 w-3.5" />
              <span className="sr-only">Select date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              month={month}
              onMonthChange={setMonth}
              onSelect={handleDateSelect}
              disabled={(date) => {
                const redditFounding = new Date("2005-06-23");
                const today = new Date();
                return isBefore(date, redditFounding) || isAfter(date, today);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
