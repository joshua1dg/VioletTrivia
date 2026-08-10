import "server-only";

import { serviceClient } from "@/lib/db/server";

import { camelRow, mapPostgrestError, unwrap } from "./_shared";

/**
 * Topics — why a question is worth asking. Full CRUD (D14); deleting one
 * cascades `question_topics`, so questions survive and simply lose the tag.
 * The confirm states that blast radius, which is why the usage count is a
 * first-class read here.
 */

export type TopicRow = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
};

export type TopicWithUsageRow = TopicRow & { questionCount: number };

const COLUMNS = "id, slug, label, sort_order";

export async function list(): Promise<TopicRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("topics")
      .select(COLUMNS)
      .order("sort_order", { ascending: true }),
  );
  return rows.map(camelRow);
}

export async function listWithUsage(): Promise<TopicWithUsageRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("topics")
      .select(`${COLUMNS}, question_topics(count)`)
      .order("sort_order", { ascending: true }),
  );

  return rows.map(({ question_topics, ...row }) => ({
    ...camelRow(row),
    // PostgREST returns an embedded aggregate as a one-element array.
    questionCount: question_topics?.[0]?.count ?? 0,
  }));
}

export async function getById(id: string): Promise<TopicRow> {
  const row = unwrap(
    await serviceClient().from("topics").select(COLUMNS).eq("id", id).single(),
    { notFound: "That topic no longer exists." },
  );
  return camelRow(row);
}

export async function insert(input: {
  slug: string;
  label: string;
  sortOrder?: number;
}): Promise<TopicRow> {
  const row = unwrap(
    await serviceClient()
      .from("topics")
      .insert({
        slug: input.slug,
        label: input.label,
        sort_order: input.sortOrder ?? 0,
      })
      .select(COLUMNS)
      .single(),
    { conflict: "A topic with that slug already exists." },
  );
  return camelRow(row);
}

export async function update(
  id: string,
  patch: { slug?: string; label?: string; sortOrder?: number },
): Promise<TopicRow> {
  const row = unwrap(
    await serviceClient()
      .from("topics")
      .update({
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.sortOrder !== undefined
          ? { sort_order: patch.sortOrder }
          : {}),
      })
      .eq("id", id)
      .select(COLUMNS)
      .single(),
    {
      conflict: "A topic with that slug already exists.",
      notFound: "That topic no longer exists.",
    },
  );
  return camelRow(row);
}

export async function remove(id: string): Promise<void> {
  const { error } = await serviceClient().from("topics").delete().eq("id", id);
  if (error)
    throw mapPostgrestError(error, {
      conflict: "That topic is still in use and couldn't be removed.",
    });
}
