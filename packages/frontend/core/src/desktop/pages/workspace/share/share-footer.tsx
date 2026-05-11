import { useI18n } from '@affine/i18n';
import { PRIVATE_SERVICE_URLS } from '@affine/core/modules/brand/constant';
import { ArrowRightBigIcon } from '@blocksuite/icons/rc';

import * as styles from './share-footer.css';

export const ShareFooter = () => {
  const t = useI18n();

  if (!PRIVATE_SERVICE_URLS.website) {
    return null;
  }

  return (
    <div className={styles.footerContainer}>
      <div className={styles.footer}>
        <div className={styles.description}>
          {t['com.affine.share-page.footer.description']()}
        </div>
        <a
          className={styles.getStartLink}
          href={PRIVATE_SERVICE_URLS.website}
          target="_blank"
          rel="noreferrer"
        >
          {t['com.affine.share-page.footer.get-started']()}
          <ArrowRightBigIcon fontSize={16} />
        </a>
      </div>
    </div>
  );
};
