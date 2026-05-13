import { TypeConfirmDialog } from '../../../components/shared/type-confirm-dialog';

export const DeleteAccountDialog = ({
  email,
  open,
  onClose,
  onDelete,
  onOpenChange,
}: {
  email: string;
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <TypeConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="删除账号？"
      description={
        <>
          <span className="font-bold">{email}</span>{' '}
          将被永久删除。此操作不可恢复，请谨慎操作。
        </>
      }
      targetText={email}
      inputPlaceholder="请输入邮箱确认"
      confirmText="删除"
      confirmButtonVariant="destructive"
      onConfirm={onDelete}
      onClose={onClose}
    />
  );
};
