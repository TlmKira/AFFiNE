import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { SHOW_PRICING_PLANS } from '@affine/core/modules/dialogs/constant';
import track from '@affine/track';
import type { Container } from '@blocksuite/affine/global/di';
import {
  FileSizeLimitProvider,
  type IFileSizeLimitService,
} from '@blocksuite/affine/shared/services';
import { Extension } from '@blocksuite/affine/store';
import type { FrameworkProvider } from '@toeverything/infra';

export function patchFileSizeLimitExtension(framework: FrameworkProvider) {
  const workspaceDialogService = framework.get(WorkspaceDialogService);

  class AffineFileSizeLimitService
    extends Extension
    implements IFileSizeLimitService
  {
    // 2GB
    maxFileSize = 2 * 1024 * 1024 * 1024;

    onOverFileSize() {
      if (!SHOW_PRICING_PLANS) {
        return;
      }

      workspaceDialogService.open('setting', {
        activeTab: SHOW_PRICING_PLANS ? 'plans' : 'appearance',
        scrollAnchor: SHOW_PRICING_PLANS ? 'cloudPricingPlan' : undefined,
      });
      track.$.paywall.storage.viewPlans();
    }

    static override setup(di: Container) {
      di.override(FileSizeLimitProvider, AffineFileSizeLimitService);
    }
  }

  return AffineFileSizeLimitService;
}
