import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { FC } from 'react';

import { DbFile } from '@/types/types';

import { Editor } from './Editor';

type EditorDialogProps = {
  fileId?: DbFile['id'];
  open: boolean;
  setOpen: (open: boolean) => void;
};

const EditorDialog: FC<EditorDialogProps> = ({ fileId, open, setOpen }) => {
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-appear dialog-overlay" />
        <Dialog.Content className="animate-dialog-slide-in dialog-content relative flex h-[90%] w-[90%] max-w-screen-lg flex-col outline-none">
          <button
            className="absolute top-4 right-4 rounded-md p-1 outline-none transition hover:bg-neutral-900"
            onClick={() => {
              setOpen(false);
            }}
          >
            <X className="h-4 w-4 text-neutral-500" />
          </button>
          <div className="overflow-y-auto">
            <div className="mx-auto flex w-full max-w-screen-md p-8">
              <Editor fileId={fileId} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default EditorDialog;
