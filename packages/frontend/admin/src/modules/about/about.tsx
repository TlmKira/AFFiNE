import { buttonVariants } from '@affine/admin/components/ui/button';
import { Separator } from '@affine/admin/components/ui/separator';
import { cn } from '@affine/admin/utils';
import {
  AlbumIcon,
  ChevronRightIcon,
  GithubIcon,
  MailWarningIcon,
} from 'lucide-react';

type Channel = 'stable' | 'canary' | 'beta' | 'internal';

const appNames = {
  stable: 'AFFiNE',
  canary: 'AFFiNE Canary',
  beta: 'AFFiNE Beta',
  internal: 'AFFiNE Internal',
} satisfies Record<Channel, string>;
const appName = appNames[BUILD_CONFIG.appBuildType];

const links = [
  {
    href: BUILD_CONFIG.githubUrl,
    icon: <GithubIcon size={20} />,
    label: '在 GitHub 查看源码',
  },
  {
    href: BUILD_CONFIG.githubUrl,
    icon: <MailWarningIcon size={20} />,
    label: '反馈问题',
  },
  {
    href: 'https://docs.affine.pro/docs/self-host-affine',
    icon: <AlbumIcon size={20} />,
    label: '自部署文档',
  },
];

export function AboutAFFiNE() {
  return (
    <div className="flex flex-col h-full gap-3 py-5 px-6 w-full">
      <div className="flex items-center">
        <span className="text-xl font-semibold">关于部署</span>
      </div>
      <div className="overflow-y-auto space-y-[10px]">
        <div className="flex flex-col rounded-md border">
          {links.map(({ href, icon, label }, index) => (
            <div key={label + index}>
              <a
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'justify-between cursor-pointer w-full'
                )}
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <span>{label}</span>
                </div>
                <div>
                  <ChevronRightIcon size={20} />
                </div>
              </a>
              {index < links.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 text-sm font-normal text-muted-foreground">
        <div>{`应用版本：${appName} ${BUILD_CONFIG.appVersion}`}</div>
        <div>{`编辑器版本：${BUILD_CONFIG.editorVersion}`}</div>
      </div>
    </div>
  );
}
