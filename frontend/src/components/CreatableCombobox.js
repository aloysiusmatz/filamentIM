import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreatableCombobox({ options, value, onChange, placeholder, testId, onCustomAdd }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const isCustom = inputValue.trim() && !options.some(
    (o) => o.toLowerCase() === inputValue.trim().toLowerCase()
  );

  const handleSelect = (option) => {
    onChange(option);
    setOpen(false);
    setInputValue("");
  };

  const handleCustom = (val) => {
    onChange(val);
    if (onCustomAdd) onCustomAdd(val);
    setOpen(false);
    setInputValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={testId}
        >
          {value || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search or type custom..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? (
                <button
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm mx-auto justify-center"
                  onClick={() => handleCustom(inputValue.trim())}
                  data-testid={`${testId}-add-custom`}
                >
                  <Plus className="h-3 w-3" />
                  Add &quot;{inputValue.trim()}&quot;
                </button>
              ) : (
                "Type to search..."
              )}
            </CommandEmpty>
            {isCustom && (
              <CommandGroup heading="Add Custom">
                <CommandItem
                  value={`__custom__${inputValue.trim()}`}
                  onSelect={() => handleCustom(inputValue.trim())}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add &quot;{inputValue.trim()}&quot;
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Presets">
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
