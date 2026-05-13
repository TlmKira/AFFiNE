import { ConfirmDialog } from '../../../components/shared/confirm-dialog';

export const EnableAccountDialog = ({
  open,
  email,
  onClose,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="启用账号"
      description={
        <>
          确认启用该账号吗？启用后，
          <span className="font-bold">{email}</span> 可重新用于登录。
        </>
      }
      confirmText="启用"
      confirmButtonVariant="default"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};
