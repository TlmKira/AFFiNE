import { PRIVATE_SERVICE_URLS } from '@affine/core/modules/brand/constant';

import { link } from './blocks.css';

export const BlogLink = () => {
  if (!PRIVATE_SERVICE_URLS.blog) {
    return null;
  }

  return (
    <a className={link} href={PRIVATE_SERVICE_URLS.blog}>
      Check other articles
    </a>
  );
};
