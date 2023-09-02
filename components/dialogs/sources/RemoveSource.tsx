import { FC, useState } from 'react';
import { toast } from 'react-hot-toast';

import ConfirmDialog from '@/components/dialogs/Confirm';
import { deleteSource } from '@/lib/api';
import useFiles from '@/lib/hooks/use-files';
import useSources from '@/lib/hooks/use-sources';
import useUsage from '@/lib/hooks/use-usage';
import { getLabelForSource } from '@/lib/utils';
import { Project, DbSource } from '@/types/types';

interface RemoveSourceDialogProps {
  projectId: Project['id'];
  source: DbSource;
  onComplete: () => void;
}

const RemoveSourceDialog: FC<RemoveSourceDialogProps> = ({
  projectId,
  source,
  onComplete,
}) => {
  const { mutate: mutateFiles } = useFiles();
  const { mutate: mutateSources } = useSources();
  const { mutate: mutateFileStats } = useUsage();
  const [loading, setLoading] = useState(false);

  return (
    <ConfirmDialog
      title={`Remove ${getLabelForSource(source, true)}?`}
      description={<>All associated files and training data will be deleted.</>}
      cta="Remove"
      variant="danger"
      loading={loading}
      onCTAClick={async () => {
        setLoading(true);
        try {
          await deleteSource(projectId, source.id);
          await mutateSources();
          await mutateFiles();
          await mutateFileStats();
          toast.success(
            `The source ${getLabelForSource(
              source,
              true,
            )} has been removed from the project.`,
          );
        } catch (e) {
          console.error(e);
          toast.error('Error removing source.');
        } finally {
          setLoading(false);
          onComplete();
        }
      }}
    />
  );
};

export default RemoveSourceDialog;
