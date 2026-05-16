import { ConfirmDialog } from './confirm-dialog';

export const DiscardChanges = ({
  open,
  onClose,
  onConfirm,
  onOpenChange,
  description = '当前修改不会被保存。',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  description?: string;
}) => {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="放弃修改？"
      description={description}
      confirmText="放弃"
      confirmButtonVariant="destructive"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};
