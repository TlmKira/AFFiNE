import { Avatar } from '@affine/component';
import { AuthService } from '@affine/core/modules/cloud';
import { getAccountDisplayName } from '@affine/core/modules/cloud/entities/session';
import { useLiveData, useService } from '@toeverything/infra';

import * as styles from './index.css';

export const Account = () => {
  const account = useLiveData(useService(AuthService).session.account$);
  if (!account) {
    // TODO(@JimmFly): loading ui
    return null;
  }
  const displayName = getAccountDisplayName(account);
  return (
    <div data-testid="user-info-card" className={styles.account}>
      <Avatar size={28} rounded={50} name={displayName} url={account.avatar} />

      <div className={styles.content}>
        <div className={styles.name} title={displayName} content={displayName}>
          {displayName}
        </div>
        <div
          className={styles.email}
          title={account.displayEmail ?? account.phone ?? ''}
          content={account.displayEmail ?? account.phone ?? ''}
        >
          {account.displayEmail ?? account.phone}
        </div>
      </div>
    </div>
  );
};
