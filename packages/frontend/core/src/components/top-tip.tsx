import { notify } from '@affine/component';
import { BrowserWarning, LocalDemoTips } from '@affine/component/affine-banner';
import { Trans, useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getAutoCloudSyncPreference } from './cloud/auto-cloud-sync';
import { useEnableCloud } from '../components/hooks/affine/use-enable-cloud';
import { AuthService } from '../modules/cloud';
import { GlobalDialogService } from '../modules/dialogs';
import type { Workspace } from '../modules/workspace';
import { WorkspacesService } from '../modules/workspace';
import { useNavigateHelper } from './hooks/use-navigate-helper';

const minimumChromeVersion = 106;

const shouldShowWarning = (() => {
  if (BUILD_CONFIG.isElectron) {
    // even though desktop has compatibility issues,
    //  we don't want to show the warning
    return false;
  }
  if (BUILD_CONFIG.isMobileEdition) {
    return true;
  }
  if (environment.isChrome && environment.chromeVersion) {
    return environment.chromeVersion < minimumChromeVersion;
  }
  return false;
})();

const OSWarningMessage = () => {
  const t = useI18n();
  const notChrome = !environment.isChrome;
  const notGoodVersion =
    environment.isChrome &&
    environment.chromeVersion &&
    environment.chromeVersion < minimumChromeVersion;

  // TODO(@L-Sun): remove this message when mobile version is able to edit.
  if (environment.isMobile) {
    return <span>{t['com.affine.top-tip.mobile']()}</span>;
  }

  if (notChrome) {
    return (
      <span>
        <Trans i18nKey="recommendBrowser">
          We recommend the <strong>Chrome</strong> browser for an optimal
          experience.
        </Trans>
      </span>
    );
  } else if (notGoodVersion) {
    return <span>{t['upgradeBrowser']()}</span>;
  }

  return null;
};

export const TopTip = ({
  pageId,
  workspace,
}: {
  pageId?: string;
  workspace: Workspace;
}) => {
  const authService = useService(AuthService);
  const loginStatus = useLiveData(authService.session.status$);
  const account = useLiveData(authService.session.account$);
  const isLoggedIn = loginStatus === 'authenticated';
  const workspacesService = useService(WorkspacesService);
  const { jumpToPage } = useNavigateHelper();

  const [showWarning, setShowWarning] = useState(shouldShowWarning);
  const [showLocalDemoTips, setShowLocalDemoTips] = useState(true);
  const [autoEnabling, setAutoEnabling] = useState(false);
  const autoTriedWorkspaceIds = useRef(new Set<string>());
  const confirmEnableCloud = useEnableCloud();

  const globalDialogService = useService(GlobalDialogService);
  const onLogin = useCallback(() => {
    globalDialogService.open('sign-in', {});
  }, [globalDialogService]);

  useEffect(() => {
    if (BUILD_CONFIG.isElectron) return;
    if (!getAutoCloudSyncPreference()) return;
    if (workspace.flavour !== 'local') return;
    if (loginStatus !== 'authenticated' || !account) return;
    if (autoTriedWorkspaceIds.current.has(workspace.id)) return;

    autoTriedWorkspaceIds.current.add(workspace.id);
    setAutoEnabling(true);
    workspacesService
      .transformLocalToCloud(workspace, account.id, 'affine-cloud')
      .then(({ id }) => {
        notify.success({
          title: '已连接私有同步服务',
          message: '当前工作区已切换为自部署同步模式。',
        });
        jumpToPage(id, pageId || 'all');
      })
      .catch(error => {
        console.error(error);
        notify.error({
          title: '自动连接私有同步服务失败',
          message: '你仍可继续使用本地模式，或稍后手动点击“连接到私有服务”。',
        });
      })
      .finally(() => setAutoEnabling(false));
  }, [account, jumpToPage, loginStatus, pageId, workspace, workspacesService]);

  if (
    !BUILD_CONFIG.isElectron &&
    showLocalDemoTips &&
    workspace.flavour === 'local'
  ) {
    return (
      <LocalDemoTips
        isLoggedIn={isLoggedIn}
        message={autoEnabling ? '正在自动连接私有同步服务...' : undefined}
        onLogin={onLogin}
        onEnableCloud={() =>
          confirmEnableCloud(workspace, { openPageId: pageId })
        }
        onClose={() => {
          setShowLocalDemoTips(false);
        }}
      />
    );
  }

  return (
    <BrowserWarning
      show={showWarning}
      message={<OSWarningMessage />}
      onClose={() => {
        setShowWarning(false);
      }}
    />
  );
};
