import { WorkbenchService } from '@affine/core/modules/workbench';
import { useService } from '@toeverything/infra';
import { useEffect } from 'react';

export const Component = () => {
  const workbench = useService(WorkbenchService).workbench;

  useEffect(() => {
    workbench.openAll({ replaceHistory: true });
  }, [workbench]);

  return null;
};
