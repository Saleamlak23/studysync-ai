import { Prisma } from '@prisma/client';
import { searchQuery, searchResult, type SearchQuery } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';

const START_HIGHLIGHT = '__studysync_match_start__';
const STOP_HIGHLIGHT = '__studysync_match_end__';
const HEADLINE_OPTIONS =
  `StartSel=${START_HIGHLIGHT},StopSel=${STOP_HIGHLIGHT},MaxFragments=1,MinWords=6,MaxWords=20`;

function removeHighlightMarkers<T extends { snippet: string }>(
  rows: T[],
): Array<Omit<T, 'snippet'> & { snippet: string }> {
  return rows.map(({ snippet, ...row }) => ({
    ...row,
    snippet: snippet.replaceAll(START_HIGHLIGHT, '').replaceAll(STOP_HIGHLIGHT, ''),
  }));
}

export async function searchWorkspace(workspaceId: string, input: unknown) {
  const { q, type, limit }: SearchQuery = searchQuery.parse(input);
  const includeCards = type === undefined || type === 'cards';
  const includeMessages = type === undefined || type === 'messages';
  const includeFiles = type === undefined || type === 'files';

  const [cards, messages, files] = await Promise.all([
    includeCards
      ? prisma.$queryRaw<Array<{ id: string; title: string; snippet: string }>>(Prisma.sql`
          SELECT c."id", c."title",
                 ts_headline('simple', coalesce(c."title", '') || ' ' || coalesce(c."description", ''), query, ${HEADLINE_OPTIONS}) AS snippet
          FROM "Card" c
          JOIN "List" l ON l."id" = c."listId"
          JOIN "Board" b ON b."id" = l."boardId"
          CROSS JOIN plainto_tsquery('simple', ${q}) query
          WHERE b."workspaceId" = ${workspaceId} AND c."searchVector" @@ query
          ORDER BY ts_rank(c."searchVector", query) DESC, c."id"
          LIMIT ${limit}
        `)
      : Promise.resolve([]),
    includeMessages
      ? prisma.$queryRaw<Array<{ id: string; snippet: string }>>(Prisma.sql`
          SELECT m."id",
                 ts_headline('simple', m."content", query, ${HEADLINE_OPTIONS}) AS snippet
          FROM "Message" m
          JOIN "Channel" ch ON ch."id" = m."channelId"
          CROSS JOIN plainto_tsquery('simple', ${q}) query
          WHERE ch."workspaceId" = ${workspaceId} AND m."deletedAt" IS NULL AND m."searchVector" @@ query
          ORDER BY ts_rank(m."searchVector", query) DESC, m."createdAt" DESC, m."id"
          LIMIT ${limit}
        `)
      : Promise.resolve([]),
    includeFiles
      ? prisma.file.findMany({
          where: { workspaceId, name: { contains: q, mode: 'insensitive' } },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: limit,
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return searchResult.parse({
    cards: removeHighlightMarkers(cards),
    messages: removeHighlightMarkers(messages),
    files,
  });
}
