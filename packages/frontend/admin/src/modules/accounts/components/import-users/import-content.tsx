import type { FC, RefObject } from 'react';

import type { ParsedUser } from '../../utils/csv-utils';
import { UserTable } from '../user-table';
import { CsvFormatGuidance } from './csv-format-guidance';
import { FileUploadArea, type FileUploadAreaRef } from './file-upload-area';

interface ImportPreviewContentProps {
  parsedUsers: ParsedUser[];
  isImported: boolean;
}

/**
 * Component for the preview mode content
 */
export const ImportPreviewContent: FC<ImportPreviewContentProps> = ({
  parsedUsers,
  isImported,
}) => {
  return (
    <div className="grid gap-3">
      {!isImported && (
        <p className="text-sm text-muted-foreground">
          已从 CSV 文件中检测到 {parsedUsers.length}{' '}
          个账号，请确认下面的账号列表后导入。
        </p>
      )}
      <UserTable users={parsedUsers} />
    </div>
  );
};

interface ImportInitialContentProps {
  passwordLimits: {
    minLength: number;
    maxLength: number;
  };
  fileUploadRef: RefObject<FileUploadAreaRef | null>;
  onFileSelected: (file: File) => Promise<void>;
}

/**
 * Component for the initial import screen
 */
export const ImportInitialContent: FC<ImportInitialContentProps> = ({
  passwordLimits,
  fileUploadRef,
  onFileSelected,
}) => {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        请使用正确格式的 CSV 文件导入账号。可以先下载 CSV 模板再填写。
      </p>
      <CsvFormatGuidance passwordLimits={passwordLimits} />
      <FileUploadArea ref={fileUploadRef} onFileSelected={onFileSelected} />
    </div>
  );
};

interface ImportErrorContentProps {
  message?: string;
}

/**
 * Component for displaying import errors
 */
export const ImportErrorContent: FC<ImportErrorContentProps> = ({
  message = '请使用正确格式的 CSV 文件导入账号。可以先下载 CSV 模板再填写。',
}) => {
  return message;
};
