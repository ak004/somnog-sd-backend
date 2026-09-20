import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import * as path from 'node:path';
import {
  EventStatus,
  EventType,
  FormFieldType,
  PrismaClient,
} from '../src/generated/prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: process.env.EVENTS_DATABASE_URL! },
    { schema: 'events' },
  ),
});

/**
 * Seeds the real SomNOG9 shape: the three public categories SomaliREN uses,
 * the conference itself, and its four parallel workshop tracks.
 *
 * Every demo and every student test then starts from data people recognise.
 */
const CATEGORIES = [
  { name: 'Conferences & Meetings', order: 1 },
  { name: 'SomNOG Events', order: 2 },
  { name: 'Trainings, Workshops & Seminars', order: 3 },
];

const TRACKS = [
  {
    title: 'Cybersecurity Track',
    track: 'cybersecurity',
    room: 'Hall A',
    capacity: 40,
    abstract:
      'Hands-on incident response, hardening and network defence for operators.',
  },
  {
    title: 'Network Infrastructure Track',
    track: 'network-infrastructure',
    room: 'Hall B',
    capacity: 40,
    abstract: 'Routing, peering and IXP operations for Somali networks.',
  },
  {
    title: 'Software Development Track',
    track: 'software-development',
    room: 'Lab 1',
    capacity: 30,
    abstract:
      'Building this event management system: NestJS microservices, Postgres and Prisma.',
  },
  {
    title: 'Systems & Services Track',
    track: 'systems-services',
    room: 'Lab 2',
    capacity: 30,
    abstract: 'DNS, mail, monitoring and the services a NREN runs day to day.',
  },
];

async function main() {
  console.log('Seeding events schema...');

  // --- categories ---------------------------------------------------------
  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const slug = category.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const row = await prisma.category.upsert({
      where: { slug },
      update: { order: category.order },
      create: {
        name: category.name,
        slug,
        order: category.order,
        isPublic: true,
        description: `${category.name} hosted by SomaliREN.`,
      },
    });
    categories.set(category.name, row.id);
    console.log(`  category  ${row.name}`);
  }

  const somnogCategoryId = categories.get('SomNOG Events')!;

  // --- the conference -----------------------------------------------------
  // Organiser id comes from the auth seed. Services do not share a database,
  // so a seed can only reference the other service's id - never join to it.
  // The fallback is the id the auth seed pins for organizer@somnog.so, so
  // running both seeds (auth first) leaves the demo organiser actually owning
  // these events. Change it there, change it here.
  const organizerUserId =
    process.env.SEED_ORGANIZER_USER_ID ?? '00000000-0000-0000-0000-000000000002';

  const conference = await prisma.event.upsert({
    where: { slug: 'somnog9-conference' },
    update: {},
    create: {
      categoryId: somnogCategoryId,
      title: 'SomNOG9 Conference',
      slug: 'somnog9-conference',
      type: EventType.CONFERENCE,
      description:
        'The ninth meeting of the Somali Network Operators Group: three days of talks, workshops and peering conversations in Mogadishu.',
      venue: 'Mogadishu, Somalia',
      timezone: 'Africa/Mogadishu',
      startsAt: new Date('2026-11-02T06:00:00.000Z'),
      endsAt: new Date('2026-11-04T14:00:00.000Z'),
      capacity: 200,
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: organizerUserId,
    },
  });
  console.log(`  event     ${conference.title}`);

  // --- workshop tracks ----------------------------------------------------
  for (const [index, track] of TRACKS.entries()) {
    const existing = await prisma.session.findFirst({
      where: { eventId: conference.id, track: track.track },
    });
    if (existing) continue;

    const day = new Date('2026-11-03T06:00:00.000Z');
    await prisma.session.create({
      data: {
        eventId: conference.id,
        title: track.title,
        track: track.track,
        abstract: track.abstract,
        room: track.room,
        capacity: track.capacity,
        startsAt: day,
        endsAt: new Date(day.getTime() + 6 * 60 * 60 * 1000),
      },
    });
    console.log(`  track     ${index + 1}. ${track.title} (${track.capacity} seats)`);
  }

  // --- registration form --------------------------------------------------
  const form = await prisma.registrationForm.upsert({
    where: { eventId: conference.id },
    update: {},
    create: {
      eventId: conference.id,
      isOpen: true,
      requiresApproval: false,
      maxPerUser: 1,
    },
  });

  const fields = [
    {
      key: 'organisation',
      label: 'Organisation',
      type: FormFieldType.TEXT,
      required: true,
      order: 0,
      options: [] as string[],
    },
    {
      key: 'tshirt',
      label: 'T-shirt size',
      type: FormFieldType.SELECT,
      required: false,
      order: 1,
      options: ['S', 'M', 'L', 'XL'],
    },
    {
      key: 'dietary',
      label: 'Dietary requirements',
      type: FormFieldType.TEXT,
      required: false,
      order: 2,
      options: [] as string[],
    },
  ];

  for (const field of fields) {
    await prisma.formField.upsert({
      where: { formId_key: { formId: form.id, key: field.key } },
      update: { label: field.label, order: field.order },
      create: { formId: form.id, ...field },
    });
  }
  console.log(`  form      ${fields.length} fields on ${conference.title}`);

  // --- extra questions on one track ---------------------------------------
  // The software development track needs to know who is bringing a laptop.
  // Nobody else does, which is exactly why it lives on the track and not on
  // the conference form everyone fills in.
  const devTrack = await prisma.session.findFirst({
    where: { eventId: conference.id, track: 'software-development' },
  });
  if (devTrack) {
    const trackForm = await prisma.registrationForm.upsert({
      where: { sessionId: devTrack.id },
      update: {},
      create: { sessionId: devTrack.id },
    });
    await prisma.formField.upsert({
      where: { formId_key: { formId: trackForm.id, key: 'laptop' } },
      update: {},
      create: {
        formId: trackForm.id,
        key: 'laptop',
        label: 'Will you bring a laptop?',
        type: FormFieldType.SELECT,
        required: true,
        options: ['Yes', 'No, I need one provided'],
        order: 0,
      },
    });
    console.log('  track form  1 extra question on Software Development Track');
  }

  // --- a smaller training event, to prove the category tree works ---------
  const trainingCategoryId = categories.get('Trainings, Workshops & Seminars')!;
  await prisma.event.upsert({
    where: { slug: 'librarian-training-2026' },
    update: {},
    create: {
      categoryId: trainingCategoryId,
      title: 'Librarian Training 2026',
      slug: 'librarian-training-2026',
      type: EventType.LECTURE,
      description:
        'Digital resources and repository management for university librarians.',
      venue: 'Online',
      startsAt: new Date('2026-10-14T07:00:00.000Z'),
      endsAt: new Date('2026-10-14T11:00:00.000Z'),
      capacity: 50,
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: organizerUserId,
    },
  });
  console.log('  event     Librarian Training 2026');

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
