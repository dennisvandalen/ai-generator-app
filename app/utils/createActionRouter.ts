import { type ActionFunctionArgs, data } from '@remix-run/node';
import { authenticate } from '~/shopify.server';
import type { Session } from '@shopify/shopify-api';

type AdminContext = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

type HandlerFn = (
  args: ActionFunctionArgs,
  payload: any,
  session: Session,
  admin: AdminContext,
) => Promise<unknown>;

export function createActionRouter(handlers: Record<string, HandlerFn>) {
  type ActionKey = keyof typeof handlers;

  return async function action(args: ActionFunctionArgs) {
    try {
      const { session, admin } = await authenticate.admin(args.request);

      // Handle both JSON and FormData
      let body: any;
      const contentType = args.request.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        body = await args.request.json();
      } else {
        const formData = await args.request.formData();
        const data = formData.get('data');
        if (data) {
          body = JSON.parse(data as string);
        } else {
          // Fallback for regular form data
          body = Object.fromEntries(formData);
        }
      }

      const actionType = body._action;

      console.log('Action router - received:', { actionType, body });

      if (!actionType || !(actionType in handlers)) {
        console.error('Action router - invalid action:', { actionType, availableActions: Object.keys(handlers) });
        return data({ error: 'Invalid _action' }, { status: 400 });
      }

      const result = await handlers[actionType as ActionKey](args, body, session, admin);
      console.log('Action router - result:', result);
      return result;
    } catch (error) {
      console.error('Action router error:', error);
      if (error instanceof Response) {
        throw error;
      }
      return data({ error: 'An error occurred' }, { status: 400 });
    }
  };
}
