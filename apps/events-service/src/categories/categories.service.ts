import { Injectable } from '@nestjs/common';
import { slugify, uniqueSlug } from '@somnog/common';
import {
  CategoryNode,
  CreateCategoryDto,
  ERROR_CODES,
  ServiceError,
  UpdateCategoryDto,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The whole tree in ONE query, assembled in memory.
   *
   * A recursive per-level query would be N+1 against the database. Category
   * trees are small (tens of rows), so fetching them flat and linking them
   * here is both simpler and faster.
   */
  async tree(includePrivate = false): Promise<CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      where: includePrivate ? {} : { isPublic: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { events: true } } },
    });

    const byId = new Map<string, CategoryNode>();
    for (const row of rows) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        parentId: row.parentId,
        isPublic: row.isPublic,
        order: row.order,
        eventCount: row._count.events,
        children: [],
      });
    }

    const roots: CategoryNode[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) {
        parent.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findBySlug(slug: string): Promise<CategoryNode> {
    const row = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { order: 'asc' } },
        _count: { select: { events: true } },
      },
    });

    if (!row) {
      throw new ServiceError(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        `No category with slug "${slug}"`,
      );
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parentId,
      isPublic: row.isPublic,
      order: row.order,
      eventCount: row._count.events,
      children: row.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        description: child.description,
        parentId: child.parentId,
        isPublic: child.isPublic,
        order: child.order,
      })),
    };
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new ServiceError(
          ERROR_CODES.CATEGORY_NOT_FOUND,
          'Parent category not found',
        );
      }
    }

    const slug = await uniqueSlug(dto.name, async (candidate) =>
      Boolean(
        await this.prisma.category.findUnique({ where: { slug: candidate } }),
      ),
    );

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
        isPublic: dto.isPublic ?? true,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new ServiceError(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        'Category not found',
      );
    }

    if (dto.parentId === id) {
      throw new ServiceError(
        ERROR_CODES.VALIDATION_FAILED,
        'A category cannot be its own parent',
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim(), slug: slugify(dto.name) }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }
}
