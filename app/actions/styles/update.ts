import {json} from '@remix-run/node';
import {withZodHandler} from '~/utils/withZodHandler';
import {UpdateAiStyleSchema} from '~/schemas/aiStyle';
import db from '~/db.server';
import {aiStylesTable} from '~/db/schema';
import {eq, and} from 'drizzle-orm';
import {getShopId} from '~/utils/getShopId';

export const action = withZodHandler(
    UpdateAiStyleSchema,
    async (args, {id, name, promptTemplate, exampleImageUrl, isActive}, session) => {
        const shopId = getShopId(session.shop);

        await db
            .update(aiStylesTable)
            .set({
                name,
                promptTemplate,
                exampleImageUrl: exampleImageUrl || null,
                isActive: isActive ?? false,
                updatedAt: new Date().toISOString(),
            })
            .where(and(eq(aiStylesTable.uuid, id), eq(aiStylesTable.shopId, shopId)));

        return json({success: true});
    }
);
