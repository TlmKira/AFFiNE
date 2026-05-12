import { createHash } from 'node:crypto';
import { resolveMx, resolveTxt, setServers } from 'node:dns/promises';

import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  ActionForbidden,
  BadRequest,
  Config,
  CryptoHelper,
  EmailTokenNotFound,
  InvalidAuthState,
  InvalidEmail,
  InvalidEmailToken,
  SignUpForbidden,
  Throttle,
  URLHelper,
  UseNamedGuard,
  WrongSignInCredentials,
} from '../../base';
import { Models, TokenType } from '../../models';
import { validators } from '../utils/validators';
import { Public } from './guard';
import { AuthService } from './service';
import { CurrentUser, Session } from './session';

interface PreflightResponse {
  registered: boolean;
  hasPassword: boolean;
}

interface SignInCredential {
  email: string;
  password?: string;
  callbackUrl?: string;
  client_nonce?: string;
}

interface MagicLinkCredential {
  email: string;
  token: string;
  client_nonce?: string;
}

interface OpenAppSignInCredential {
  code: string;
}

interface PhoneCodeCredential {
  phone: string;
}

interface PhoneSignInCredential {
  phone: string;
  code: string;
}

const PHONE_OTP_PREFIX = 'phone:';

function normalizePhone(phone: string) {
  const value = phone.trim().replace(/[\s-]/g, '');
  if (/^1[3-9]\d{9}$/.test(value)) {
    return `+86${value}`;
  }
  if (/^86(1[3-9]\d{9})$/.test(value)) {
    return `+${value}`;
  }
  if (/^\+[1-9]\d{7,14}$/.test(value)) {
    return value;
  }
  throw new BadRequest(
    '手机号格式无效，请输入中国大陆手机号或 E.164 格式号码。'
  );
}

function phoneOtpKey(phone: string) {
  return `${PHONE_OTP_PREFIX}${phone}`;
}

function phonePlaceholderEmail(phone: string) {
  const hash = createHash('sha256').update(phone).digest('hex').slice(0, 24);
  return `phone_${hash}@local.invalid`;
}

@Throttle('strict')
@Controller('/api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly url: URLHelper,
    private readonly auth: AuthService,
    private readonly models: Models,
    private readonly config: Config,
    private readonly crypto: CryptoHelper
  ) {
    if (env.dev) {
      // set DNS servers in dev mode
      // NOTE: some network debugging software uses DNS hijacking
      // to better debug traffic, but their DNS servers may not
      // handle the non dns query(like txt, mx) correctly, so we
      // set a public DNS server here to avoid this issue.
      setServers(['1.1.1.1', '8.8.8.8']);
    }
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/phone/code')
  async sendPhoneCode(@Body() credential: PhoneCodeCredential) {
    if (!this.config.auth.phone.enabled) {
      throw new ActionForbidden('手机号登录未启用。');
    }

    const phone = normalizePhone(credential.phone);
    const otp = this.crypto.otp();
    const token = await this.models.verificationToken.create(
      TokenType.SignIn,
      phone,
      5 * 60
    );

    await this.models.magicLinkOtp.upsert(phoneOtpKey(phone), otp, token);
    this.logger.log(`Phone sign-in code for ${phone}: ${otp}`);

    return {
      phone,
      ...(env.dev || this.config.auth.phone.mockCodeVisible
        ? { code: otp }
        : {}),
    };
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/phone/sign-in')
  async phoneSignIn(
    @Req() req: Request,
    @Res() res: Response,
    @Body() credential: PhoneSignInCredential
  ) {
    if (!this.config.auth.phone.enabled) {
      throw new ActionForbidden('手机号登录未启用。');
    }

    const phone = normalizePhone(credential.phone);
    if (!credential.code || !/^\d{6}$/.test(credential.code)) {
      throw new InvalidEmailToken();
    }

    const consumed = await this.models.magicLinkOtp.consume(
      phoneOtpKey(phone),
      credential.code
    );
    if (!consumed.ok) {
      throw new InvalidEmailToken();
    }

    const tokenRecord = await this.models.verificationToken.verify(
      TokenType.SignIn,
      consumed.token,
      {
        credential: phone,
      }
    );

    if (!tokenRecord) {
      throw new InvalidEmailToken();
    }

    let user = await this.models.user.getUserByPhone(phone, {
      withDisabled: true,
    });

    if (!user) {
      if (!this.config.auth.allowSignup) {
        throw new SignUpForbidden();
      }

      user = await this.models.user.create({
        email: phonePlaceholderEmail(phone),
        phone,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        registered: true,
        name: phone,
      });
    } else if (user.disabled) {
      throw new WrongSignInCredentials({ email: phone });
    }

    await this.auth.setCookies(req, res, user.id);
    res.status(HttpStatus.OK).send({ id: user.id, phone: user.phone });
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/preflight')
  async preflight(
    @Body() params?: { email: string }
  ): Promise<PreflightResponse> {
    if (!params?.email) {
      throw new InvalidEmail({ email: 'not provided' });
    }
    validators.assertValidEmail(params.email);

    const user = await this.models.user.getUserByEmail(params.email);

    if (!user) {
      return {
        registered: false,
        hasPassword: false,
      };
    }

    return {
      registered: user.registered,
      hasPassword: !!user.password,
    };
  }

  @Public()
  @UseNamedGuard('version', 'captcha')
  @Post('/sign-in')
  @Header('content-type', 'application/json')
  async signIn(
    @Req() req: Request,
    @Res() res: Response,
    @Body() credential: SignInCredential
  ) {
    validators.assertValidEmail(credential.email);
    const canSignIn = await this.auth.canSignIn(credential.email);
    if (!canSignIn) {
      throw new ActionForbidden();
    }

    if (credential.password) {
      await this.passwordSignIn(
        req,
        res,
        credential.email,
        credential.password
      );
    } else {
      await this.sendMagicLink(
        res,
        credential.email,
        credential.callbackUrl,
        credential.client_nonce
      );
    }
  }

  async passwordSignIn(
    req: Request,
    res: Response,
    email: string,
    password: string
  ) {
    const user = await this.auth.signIn(email, password);

    await this.auth.setCookies(req, res, user.id);
    res.status(HttpStatus.OK).send(user);
  }

  async sendMagicLink(
    res: Response,
    email: string,
    callbackUrl = '/magic-link',
    clientNonce?: string
  ) {
    if (!this.url.isAllowedCallbackUrl(callbackUrl)) {
      throw new ActionForbidden();
    }

    const callbackUrlObj = this.url.url(callbackUrl);
    const redirectUriInCallback =
      callbackUrlObj.searchParams.get('redirect_uri');
    if (
      redirectUriInCallback &&
      !this.url.isAllowedRedirectUri(redirectUriInCallback)
    ) {
      throw new ActionForbidden();
    }

    // send email magic link
    const user = await this.models.user.getUserByEmail(email, {
      withDisabled: true,
    });

    if (!user) {
      if (!this.config.auth.allowSignup) {
        throw new SignUpForbidden();
      }

      if (this.config.auth.requireEmailDomainVerification) {
        // verify domain has MX, SPF, DMARC records
        const [name, domain, ...rest] = email.split('@');
        if (rest.length || !domain) {
          throw new InvalidEmail({ email });
        }
        const [mx, spf, dmarc] = await Promise.allSettled([
          resolveMx(domain).then(t => t.map(mx => mx.exchange).filter(Boolean)),
          resolveTxt(domain).then(t =>
            t.map(([k]) => k).filter(txt => txt.includes('v=spf1'))
          ),
          resolveTxt('_dmarc.' + domain).then(t =>
            t.map(([k]) => k).filter(txt => txt.includes('v=DMARC1'))
          ),
        ]).then(t => t.filter(t => t.status === 'fulfilled').map(t => t.value));
        if (!mx?.length || !spf?.length || !dmarc?.length) {
          throw new InvalidEmail({ email });
        }
        // filter out alias emails
        if (name.includes('+')) {
          throw new InvalidEmail({ email });
        }
      }
    } else if (user.disabled) {
      throw new WrongSignInCredentials({ email });
    }

    const ttlInSec = 30 * 60;
    const token = await this.models.verificationToken.create(
      TokenType.SignIn,
      email,
      ttlInSec
    );

    const otp = this.crypto.otp();
    await this.models.magicLinkOtp.upsert(email, otp, token, clientNonce);

    const magicLink = this.url.link(callbackUrl, { token: otp, email });
    if (env.dev) {
      // make it easier to test in dev mode
      this.logger.debug(`Magic link: ${magicLink}`);
    }

    await this.auth.sendSignInEmail(email, magicLink, otp, !user);

    res.status(HttpStatus.OK).send({
      email: email,
    });
  }

  @Public()
  /**
   * @deprecated Kept for 0.25 clients that still call GET `/api/auth/sign-out`.
   * Use POST `/api/auth/sign-out` instead.
   */
  @Get('/sign-out')
  async signOutDeprecated(
    @Res() res: Response,
    @Session() session: Session | undefined,
    @Query('user_id') userId: string | undefined
  ) {
    res.setHeader('Deprecation', 'true');

    if (!session) {
      res.status(HttpStatus.OK).send({});
      return;
    }

    await this.auth.signOut(session.sessionId, userId);
    await this.auth.refreshCookies(res, session.sessionId);

    res.status(HttpStatus.OK).send({});
  }

  @Public()
  @Post('/sign-out')
  async signOut(
    @Req() req: Request,
    @Res() res: Response,
    @Session() session: Session | undefined,
    @Query('user_id') userId: string | undefined
  ) {
    if (!session) {
      res.status(HttpStatus.OK).send({});
      return;
    }

    const csrfCookie = req.cookies?.[AuthService.csrfCookieName] as
      | string
      | undefined;
    const csrfHeader = req.get('x-affine-csrf-token');
    if (
      csrfHeader && // optional for backward compatibility, drop after 0.25.0 outdated
      (!csrfCookie || csrfCookie !== csrfHeader)
    ) {
      throw new ActionForbidden();
    }

    await this.auth.signOut(session.sessionId, userId);
    await this.auth.refreshCookies(res, session.sessionId);

    res.status(HttpStatus.OK).send({});
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/open-app/sign-in-code')
  async openAppSignInCode(@CurrentUser() user?: CurrentUser) {
    if (!user) {
      throw new ActionForbidden();
    }

    // short-lived one-time code for handing off the authenticated session
    const code = await this.models.verificationToken.create(
      TokenType.OpenAppSignIn,
      user.id,
      5 * 60
    );

    return { code };
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/open-app/sign-in')
  async openAppSignIn(
    @Req() req: Request,
    @Res() res: Response,
    @Body() credential: OpenAppSignInCredential
  ) {
    if (!credential?.code) {
      throw new InvalidAuthState();
    }

    const tokenRecord = await this.models.verificationToken.get(
      TokenType.OpenAppSignIn,
      credential.code
    );

    if (!tokenRecord?.credential) {
      throw new InvalidAuthState();
    }

    await this.auth.setCookies(req, res, tokenRecord.credential);
    res.send({ id: tokenRecord.credential });
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/magic-link')
  async magicLinkSignIn(
    @Req() req: Request,
    @Res() res: Response,
    @Body()
    { email, token: otp, client_nonce: clientNonce }: MagicLinkCredential
  ) {
    if (!otp || !email) {
      throw new EmailTokenNotFound();
    }

    validators.assertValidEmail(email);

    const consumed = await this.models.magicLinkOtp.consume(
      email,
      otp,
      clientNonce
    );
    if (!consumed.ok) {
      if (consumed.reason === 'nonce_mismatch') {
        throw new InvalidAuthState();
      }
      throw new InvalidEmailToken();
    }

    const token = consumed.token;

    const tokenRecord = await this.models.verificationToken.verify(
      TokenType.SignIn,
      token,
      {
        credential: email,
      }
    );

    if (!tokenRecord) {
      throw new InvalidEmailToken();
    }

    const user = await this.models.user.fulfill(email);

    await this.auth.setCookies(req, res, user.id);
    res.send({ id: user.id });
  }

  @UseNamedGuard('version')
  @Throttle('default', { limit: 1200 })
  @Public()
  @Get('/session')
  async currentSessionUser(@CurrentUser() user?: CurrentUser) {
    return {
      user,
    };
  }

  @Throttle('default', { limit: 1200 })
  @Public()
  @Get('/sessions')
  async currentSessionUsers(@Req() req: Request) {
    const token = req.cookies[AuthService.sessionCookieName];
    if (!token) {
      return {
        users: [],
      };
    }

    return {
      users: await this.auth.getUserList(token),
    };
  }
}
