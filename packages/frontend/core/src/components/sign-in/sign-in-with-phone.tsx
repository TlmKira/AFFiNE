import { notify } from '@affine/component';
import {
  AuthContainer,
  AuthContent,
  AuthFooter,
  AuthHeader,
  AuthInput,
} from '@affine/component/auth-components';
import { Button } from '@affine/component/ui/button';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { AuthService } from '@affine/core/modules/cloud';
import type { AuthSessionStatus } from '@affine/core/modules/cloud/entities/session';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { SignInState } from '.';
import { Back } from './back';
import * as style from './style.css';

function isValidPhone(phone: string) {
  const value = phone.trim().replace(/[\s-]/g, '');
  return (
    /^1[3-9]\d{9}$/.test(value) ||
    /^86(1[3-9]\d{9})$/.test(value) ||
    /^\+[1-9]\d{7,14}$/.test(value)
  );
}

export const SignInWithPhoneStep = ({
  state,
  changeState,
  onAuthenticated,
}: {
  state: SignInState;
  changeState: Dispatch<SetStateAction<SignInState>>;
  onAuthenticated?: (status: AuthSessionStatus) => void;
}) => {
  const t = useI18n();
  const authService = useService(AuthService);
  const loginStatus = useLiveData(authService.session.status$);
  const [phone, setPhone] = useState(state.phone ?? '');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [mockCode, setMockCode] = useState<string | undefined>();
  const [resendCountDown, setResendCountDown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (loginStatus === 'authenticated') {
      notify.success({
        title: t['com.affine.auth.toast.title.signed-in'](),
        message: t['com.affine.auth.toast.message.signed-in'](),
      });
    }
    onAuthenticated?.(loginStatus);
  }, [loginStatus, onAuthenticated, t]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCountDown(c => Math.max(c - 1, 0));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const sendCode = useAsyncCallback(async () => {
    if (isSending || resendCountDown > 0) return;
    if (!isValidPhone(phone)) {
      setPhoneError('请输入有效手机号，支持中国大陆手机号或 +86 格式。');
      return;
    }

    setPhoneError('');
    setCodeError('');
    setIsSending(true);

    try {
      const result = await authService.sendPhoneCode(phone);
      setMockCode(result.code);
      setPhone(result.phone);
      changeState(prev => ({ ...prev, phone: result.phone }));
      setResendCountDown(60);
      notify.success({
        title: '验证码已生成',
        message: result.code
          ? `当前模拟验证码：${result.code}`
          : '请查看后端日志中的手机号验证码。',
      });
    } catch (err) {
      const error = UserFriendlyError.fromAny(err);
      notify.error({
        title: '获取验证码失败',
        message: error.message,
      });
    } finally {
      setIsSending(false);
    }
  }, [authService, changeState, isSending, phone, resendCountDown]);

  const signIn = useAsyncCallback(async () => {
    if (isVerifying) return;
    if (!isValidPhone(phone)) {
      setPhoneError('请输入有效手机号，支持中国大陆手机号或 +86 格式。');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setCodeError('请输入 6 位验证码。');
      return;
    }

    setPhoneError('');
    setCodeError('');
    setIsVerifying(true);

    try {
      await authService.signInPhone(phone, code);
    } catch (err) {
      const error = UserFriendlyError.fromAny(err);
      notify.error({
        title: '手机号登录失败',
        message: error.message,
      });
      setCodeError('验证码不正确或已过期。');
    } finally {
      setIsVerifying(false);
    }
  }, [authService, code, isVerifying, phone]);

  const backToEmail = useCallback(() => {
    changeState(prev => ({ ...prev, step: 'signIn' }));
  }, [changeState]);

  return (
    <AuthContainer>
      <AuthHeader title="手机号登录" subTitle="使用模拟验证码登录私有服务" />
      <AuthContent>
        <AuthInput
          className={style.authInput}
          label="手机号"
          placeholder="请输入手机号，例如 13800138000"
          onChange={value => {
            setPhone(value);
            setPhoneError('');
          }}
          error={!!phoneError}
          errorHint={phoneError}
          onEnter={sendCode}
        />

        <AuthInput
          className={style.authInput}
          label="验证码"
          placeholder={
            mockCode ? `模拟验证码：${mockCode}` : '请输入 6 位验证码'
          }
          onChange={value => {
            setCode(value);
            setCodeError('');
          }}
          error={!!codeError}
          errorHint={codeError}
          onEnter={signIn}
          maxLength={6}
        />

        <Button
          style={{ width: '100%' }}
          size="extraLarge"
          block
          loading={isSending}
          disabled={resendCountDown > 0}
          onClick={sendCode}
        >
          {resendCountDown > 0
            ? `${resendCountDown} 秒后重新获取`
            : '获取验证码'}
        </Button>

        <Button
          style={{ width: '100%' }}
          size="extraLarge"
          block
          loading={isVerifying}
          disabled={isVerifying}
          onClick={signIn}
        >
          登录
        </Button>

        <Button variant="plain" onClick={backToEmail} style={{ padding: 4 }}>
          使用邮箱登录
        </Button>
      </AuthContent>

      <AuthFooter>
        <div className={style.authMessage}>
          v1 使用模拟验证码。生产环境请关闭验证码回显，并接入真实短信服务。
        </div>
        <Back changeState={changeState} />
      </AuthFooter>
    </AuthContainer>
  );
};
