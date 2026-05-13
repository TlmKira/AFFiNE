import { Button, Tooltip } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { AffineErrorBoundary } from '@affine/core/components/affine/affine-error-boundary';
import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import { ServerService, UserFeatureService } from '@affine/core/modules/cloud';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect } from 'react';
import type { ReactElement } from 'react';

import type { SettingState } from '../../types';
import { EnableCloudPanel } from '../preference/enable-cloud';
import { CloudWorkspaceMembersPanel } from './cloud-members-panel';
import * as styles from './styles.css';

export const MembersPanel = ({
  onChangeSettingState,
  onCloseSetting,
}: {
  onChangeSettingState: (settingState: SettingState) => void;
  onCloseSetting: () => void;
}): ReactElement | null => {
  const workspace = useService(WorkspaceService).workspace;
  const isTeam = useWorkspaceInfo(workspace.meta)?.isTeam;
  if (workspace.flavour === 'local') {
    return <MembersPanelLocal onCloseSetting={onCloseSetting} />;
  }
  return (
    <AffineErrorBoundary>
      <div className={styles.remoteMembersPanel}>
        <ServerAccountsCard />
        <CloudWorkspaceMembersPanel
          onChangeSettingState={onChangeSettingState}
          isTeam={isTeam}
        />
      </div>
    </AffineErrorBoundary>
  );
};

const MembersPanelLocal = ({
  onCloseSetting,
}: {
  onCloseSetting: () => void;
}) => {
  const t = useI18n();
  return (
    <div className={styles.localMembersPanel}>
      <ServerAccountsCard />
      <Tooltip content={t['com.affine.settings.member-tooltip']()}>
        <div className={styles.fakeWrapper}>
          <SettingRow name={`${t['Members']()} (0)`} desc={t['Members hint']()}>
            <Button>{t['Invite Members']()}</Button>
          </SettingRow>
        </div>
      </Tooltip>
      <EnableCloudPanel onCloseSetting={onCloseSetting} />
    </div>
  );
};

const ServerAccountsCard = () => {
  const t = useI18n();
  const serverService = useService(ServerService);
  const userFeatureService = useService(UserFeatureService);
  const isAdmin = useLiveData(userFeatureService.userFeature.isAdmin$);

  useEffect(() => {
    userFeatureService.userFeature.revalidate();
  }, [userFeatureService]);

  const openAccounts = useCallback(() => {
    window.open(`${serverService.server.baseUrl}/admin/accounts`, '_blank');
  }, [serverService.server.baseUrl]);

  if (!isAdmin) return null;

  return (
    <div className={styles.managementCard}>
      <div>
        <div className={styles.managementTitle}>
          {t['com.affine.settings.workspace.members.server-accounts.title']()}
        </div>
        <div className={styles.managementDescription}>
          {t[
            'com.affine.settings.workspace.members.server-accounts.description'
          ]()}
        </div>
      </div>
      <Button onClick={openAccounts}>
        {t['com.affine.settings.workspace.members.server-accounts.open']()}
      </Button>
    </div>
  );
};
