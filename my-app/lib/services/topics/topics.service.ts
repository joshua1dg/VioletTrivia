import "server-only";

import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import * as repo from "@/lib/repos/topics";
import type { TopicInput, TopicUpdateInput } from "@/lib/schemas/topics";

import { nextSortOrder } from "./sort.util";

/**
 * Topics — full CRUD (D14). Authorization lives here rather than in the
 * action, because "who may do this" is a business rule and a Server Action
 * is a public endpoint: not rendering the form protects nothing (§7.2).
 */

export type Topic = repo.TopicRow;
export type TopicWithUsage = repo.TopicWithUsageRow;

export function listTopics(): Promise<Topic[]> {
  return repo.list();
}

/** The admin screen and every delete confirm's blast radius. */
export function listTopicsWithUsage(): Promise<TopicWithUsage[]> {
  return repo.listWithUsage();
}

export function getTopic(id: string): Promise<Topic> {
  return repo.getById(id);
}

export async function createTopic(input: TopicInput): Promise<Topic> {
  await requireAdmin();

  const sortOrder =
    input.sortOrder ?? nextSortOrder(await repo.list());

  return repo.insert({ ...input, slug: slugify(input.label), sortOrder });
}

export async function updateTopic(
  id: string,
  patch: TopicUpdateInput,
): Promise<Topic> {
  await requireAdmin();
  // The slug follows the label — one field, one source of truth. A rename
  // therefore changes the topic's URL (/admin/topics/[slug], ?topic=);
  // acceptable for an internal tool, and the alternative (a frozen slug
  // that stops matching its label) confuses forever rather than once.
  return repo.update(
    id,
    patch.label === undefined
      ? patch
      : { ...patch, slug: slugify(patch.label) },
  );
}

/** "Frustrated user" → "frustrated-user". Lowercase, every run of anything
 * that isn't a letter or digit becomes one dash. */
function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new AppError(
      "validation",
      "A topic label needs at least one letter or number.",
    );
  }
  return slug;
}

/**
 * Arrow reorder sends the whole ordered list. One update per topic, in
 * sequence — NOT transactional (D13): PostgREST has no multi-row update with
 * differing values, and a failure part-way leaves the list half-renumbered.
 * The cost of that is a visibly wrong order, which the next reorder fixes.
 */
export async function reorderTopics(orderedIds: string[]): Promise<void> {
  await requireAdmin();

  for (const [index, id] of orderedIds.entries()) {
    await repo.update(id, { sortOrder: (index + 1) * 10 });
  }
}

/**
 * Deleting a topic cascades `question_topics`, so the questions survive and
 * simply lose the tag. The count is read BEFORE the delete so the caller can
 * report what actually happened ("3 questions lost this topic"), and so the
 * confirm dialog and the outcome cannot disagree.
 */
export async function deleteTopic(
  id: string,
): Promise<{ questionsAffected: number }> {
  await requireAdmin();

  const usage = await repo.listWithUsage();
  const questionsAffected =
    usage.find((topic) => topic.id === id)?.questionCount ?? 0;

  await repo.remove(id);

  return { questionsAffected };
}
