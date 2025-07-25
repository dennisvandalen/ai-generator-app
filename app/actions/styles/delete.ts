import { redirect } from '@remix-run/node';
import { withZodHandler } from '~/utils/withZodHandler';
import { DeleteAiStyleSchema } from '~/schemas/aiStyle';
import db from '~/db.server';
import { aiStylesTable } from '~/db/schema';
import { eq, and } from 'drizzle-orm';
import { getShopId } from '~/utils/getShopId';

export const action = withZodHandler(
  DeleteAiStyleSchema,
  async (args, { id }, session) => {
    const shopId = getShopId(session.shop);

    await db
      .delete(aiStylesTable)
      .where(and(eq(aiStylesTable.uuid, id), eq(aiStylesTable.shopId, shopId)));

    return redirect('/app/styles');
  }
);
