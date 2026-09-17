import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateCategoryDto,
  EVENTS_PATTERNS,
  Message,
  UpdateCategoryDto,
  unwrap,
} from '@somnog/contracts';
import { CategoriesService } from './categories.service';

@Controller()
export class CategoriesMessageController {
  constructor(private readonly categories: CategoriesService) {}

  @MessagePattern(EVENTS_PATTERNS.CATEGORY_TREE)
  tree(@Payload() message: Message<{ includePrivate?: boolean }>) {
    return this.categories.tree(unwrap(message)?.includePrivate ?? false);
  }

  @MessagePattern(EVENTS_PATTERNS.CATEGORY_FIND)
  find(@Payload() message: Message<{ slug: string }>) {
    return this.categories.findBySlug(unwrap(message).slug);
  }

  @MessagePattern(EVENTS_PATTERNS.CATEGORY_CREATE)
  create(@Payload() message: Message<CreateCategoryDto>) {
    return this.categories.create(unwrap(message));
  }

  @MessagePattern(EVENTS_PATTERNS.CATEGORY_UPDATE)
  update(@Payload() message: Message<UpdateCategoryDto & { id: string }>) {
    const { id, ...dto } = unwrap(message);
    return this.categories.update(id, dto);
  }
}
