import { Button } from '@affine/admin/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@affine/admin/components/ui/dialog';
import { Input } from '@affine/admin/components/ui/input';
import { CopyIcon } from 'lucide-react';

export const ResetPasswordDialog = ({
  link,
  open,
  onCopy,
  onOpenChange,
}: {
  link: string;
  open: boolean;
  onCopy: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[460px]">
        <DialogHeader>
          <DialogTitle className="leading-7">账号恢复链接</DialogTitle>
          <DialogDescription className="leading-6">
            请把此恢复链接发送给用户，并提醒用户按页面提示完成密码重置。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <div className="flex justify-end gap-2 items-center w-full">
            <Input
              type="text"
              value={link}
              placeholder="账号恢复链接"
              className="placeholder:opacity-50 text-ellipsis overflow-hidden whitespace-nowrap"
              readOnly
            />
            <Button type="button" onClick={onCopy} className="space-x-[10px]">
              <CopyIcon size={20} /> <span>复制并关闭</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
