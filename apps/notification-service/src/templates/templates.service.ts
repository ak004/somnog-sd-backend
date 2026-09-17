import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import {
  ERROR_CODES,
  NotificationChannel,
  ServiceError,
  UpsertTemplateDto,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TEMPLATES } from './default-templates';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);
  private readonly compiled = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Templates live in the database so an organiser can edit the wording
   * without a deploy. The file-based defaults are the fallback, which also
   * means a fresh clone works before anyone has seeded anything.
   */
  async render(
    key: string,
    payload: Record<string, unknown>,
    channel: NotificationChannel = NotificationChannel.EMAIL,
    locale = 'en',
  ): Promise<{ subject: string; body: string }> {
    const stored = await this.prisma.template.findFirst({
      where: { key, channel, locale, isActive: true },
    });

    const source = stored ?? DEFAULT_TEMPLATES[key];
    if (!source) {
      throw new ServiceError(
        ERROR_CODES.TEMPLATE_NOT_FOUND,
        `No template for "${key}"`,
      );
    }

    return {
      subject: this.compile(`${key}:subject`, source.subject)(payload),
      body: this.compile(`${key}:body`, source.body)(payload),
    };
  }

  list(channel?: NotificationChannel) {
    return this.prisma.template.findMany({
      where: channel ? { channel } : {},
      orderBy: [{ key: 'asc' }, { locale: 'asc' }],
    });
  }

  async upsert(dto: UpsertTemplateDto) {
    const locale = dto.locale ?? 'en';
    const template = await this.prisma.template.upsert({
      where: {
        key_channel_locale: { key: dto.key, channel: dto.channel, locale },
      },
      update: {
        subject: dto.subject,
        body: dto.body,
        isActive: dto.isActive ?? true,
      },
      create: {
        key: dto.key,
        channel: dto.channel,
        locale,
        subject: dto.subject,
        body: dto.body,
        isActive: dto.isActive ?? true,
      },
    });

    // An edited template must not keep rendering from the old compiled copy.
    this.compiled.delete(`${dto.key}:subject`);
    this.compiled.delete(`${dto.key}:body`);

    return template;
  }

  private compile(cacheKey: string, source: string) {
    let template = this.compiled.get(cacheKey);
    if (!template) {
      template = Handlebars.compile(source, { noEscape: false });
      this.compiled.set(cacheKey, template);
    }
    return template;
  }
}
