import type {
  CampaignConfig,
  Contact,
  ContactHistory,
  ScheduleBatch,
  ScheduleResult,
} from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function campaignDurationDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "").trim();
}

function shuffleContacts(contacts: Contact[]) {
  const shuffled = [...contacts];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function getCooldownPhones(
  history: ContactHistory[],
  startDate: string,
  cooldownDays: number,
) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();

  return new Set(
    history
      .filter((record) => {
        const lastSent = new Date(`${record.lastSentAt}T00:00:00.000Z`).getTime();
        const daysSince = Math.floor((start - lastSent) / MS_PER_DAY);
        return daysSince >= 0 && daysSince < cooldownDays;
      })
      .map((record) => normalizePhone(record.phone)),
  );
}

export function generateSchedule(
  contacts: Contact[],
  config: CampaignConfig,
  existingHistory: ContactHistory[] = [],
): ScheduleResult {
  const errors: string[] = [];
  const duration = campaignDurationDays(config.startDate, config.endDate);

  if (!config.startDate || !config.endDate) {
    errors.push("Add a start and end date before generating a schedule.");
  }

  if (duration < 1 || Number.isNaN(duration)) {
    errors.push("Campaign end date must be on or after the start date.");
  }

  if (config.dailyLimit < 1) {
    errors.push("Daily limit must be at least 1 contact.");
  }

  if (contacts.length === 0) {
    errors.push("Upload at least one contact.");
  }

  if (errors.length > 0) {
    return { batches: [], skippedContacts: [], errors };
  }

  const cooldownPhones = getCooldownPhones(
    existingHistory,
    config.startDate,
    config.cooldownDays,
  );

  const skippedContacts: Contact[] = [];
  const eligibleContacts = contacts.filter((contact) => {
    const isCoolingDown = cooldownPhones.has(normalizePhone(contact.phone));
    if (isCoolingDown) {
      skippedContacts.push(contact);
    }

    return !isCoolingDown;
  });

  const daysNeeded = Math.ceil(eligibleContacts.length / config.dailyLimit);

  if (daysNeeded > duration) {
    errors.push(
      `${eligibleContacts.length} eligible contacts need ${daysNeeded} days at ${config.dailyLimit} per day, but this campaign only has ${duration} days.`,
    );
    return { batches: [], skippedContacts, errors };
  }

  const shuffled = shuffleContacts(eligibleContacts);
  const batches: ScheduleBatch[] = [];

  for (let i = 0; i < shuffled.length; i += config.dailyLimit) {
    const day = batches.length + 1;
    batches.push({
      day,
      date: addDays(config.startDate, day - 1),
      contacts: shuffled.slice(i, i + config.dailyLimit),
    });
  }

  return { batches, skippedContacts, errors };
}
