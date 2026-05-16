import { AppContainer } from '@affine/core/desktop/components/app-container';
import { WorkspacesService } from '@affine/core/modules/workspace';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export const Component = () => {
  const navigate = useNavigate();
  const workspacesService = useService(WorkspacesService);
  const workspaces = useLiveData(workspacesService.list.workspaces$);

  const targetWorkspaceId = useMemo(() => {
    const lastWorkspaceId = localStorage.getItem('last_workspace_id');
    if (lastWorkspaceId) {
      return lastWorkspaceId;
    }
    return workspaces[0]?.id ?? null;
  }, [workspaces]);

  useEffect(() => {
    workspacesService.list.revalidate();
  }, [workspacesService]);

  useEffect(() => {
    if (targetWorkspaceId) {
      navigate(`/workspace/${targetWorkspaceId}/all`, { replace: true });
    }
  }, [navigate, targetWorkspaceId]);

  return <AppContainer fallback />;
};
