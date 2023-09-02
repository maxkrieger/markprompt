import * as Select from '@radix-ui/react-select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FC, useMemo } from 'react';

import { useConfigContext } from '@/lib/context/config';
import { DEFAULT_SYSTEM_PROMPT, predefinedSystemPrompts } from '@/lib/prompt';

import { SelectItem } from '../ui/Select';

interface TemplatePickerProps {
  className?: string;
}

export const TemplatePicker: FC<TemplatePickerProps> = () => {
  const { markpromptOptions, setMarkpromptOptions } = useConfigContext();

  const selectedTemplateName = useMemo(() => {
    return predefinedSystemPrompts.find((t) => {
      return t.template === markpromptOptions.prompt?.promptTemplate;
    })?.name;
  }, [markpromptOptions?.prompt?.promptTemplate]);

  return (
    <Select.Root
      value={selectedTemplateName || 'Custom'}
      onValueChange={(value) => {
        const promptTemplate =
          predefinedSystemPrompts.find((t) => t.name === value)?.template ||
          DEFAULT_SYSTEM_PROMPT.template;
        setMarkpromptOptions({
          ...markpromptOptions,
          prompt: {
            ...markpromptOptions.prompt,
            promptTemplate,
          },
        });
      }}
    >
      <Select.Trigger
        className="button-ring flex w-full flex-row items-center gap-2 rounded-md border border-neutral-900 py-1.5 px-3 text-sm text-neutral-300 outline-none"
        aria-label="Theme"
      >
        <div className="flex-grow truncate whitespace-nowrap text-left">
          <Select.Value placeholder="Pick a template…" />
        </div>
        <Select.Icon className="flex-none text-neutral-500">
          <ChevronDown className="h-4 w-4" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-30 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900">
          <Select.ScrollUpButton className="flex h-10 items-center justify-center">
            <ChevronUp className="h-4 w-4" />
          </Select.ScrollUpButton>
          <Select.Viewport>
            <Select.Group>
              {!selectedTemplateName && (
                <SelectItem value="Custom">Custom</SelectItem>
              )}
              {predefinedSystemPrompts?.map((prompt) => {
                return (
                  <SelectItem key={`prompt-${prompt.name}`} value={prompt.name}>
                    {prompt.name}
                  </SelectItem>
                );
              })}
            </Select.Group>
          </Select.Viewport>
          <Select.ScrollDownButton className="flex items-center justify-center p-2">
            <ChevronDown className="h-4 w-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>{' '}
    </Select.Root>
  );
};
