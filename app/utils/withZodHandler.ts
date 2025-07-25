import { data, type ActionFunctionArgs } from '@remix-run/node';
import type { ZodSchema } from 'zod';
import { authenticate } from '~/shopify.server';
import type { Session } from '@shopify/shopify-api';

type AdminContext = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export function withZodHandler<T>(
  schema: ZodSchema<T>,
  fn: (args: ActionFunctionArgs, input: T, session: Session, admin: AdminContext) => Promise<unknown>
) {
  return async (args: ActionFunctionArgs, payload: unknown): Promise<unknown> => {
    try {
      const { session, admin } = await authenticate.admin(args.request);

      if (!session) {
        return data({ error: 'Authentication required' }, { status: 401 });
      }

      const result = schema.safeParse(payload);

      if (!result.success) {
        // IMPROVEMENT: Return a structured array of errors, not a plain string.
        const errors = result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return data({
          error: 'Validation failed',
          details: errors // `details` is now an array of objects
        }, { status: 400 });
      }

      return await fn(args, result.data, session, admin);
    } catch (error) {
      console.error('Handler error:', error);

      // Type guard to check if error is an object with specific properties
      const isErrorWithProps = (err: unknown): err is { message?: string; status?: number } => {
        return err !== null && typeof err === 'object';
      };

      if (isErrorWithProps(error) &&
          (error.message?.includes('authentication') || error.status === 401)) {
        return data({ error: 'Authentication failed' }, { status: 401 });
      }

      return data({
        error: 'An unexpected server error occurred.',
        ...(process.env.NODE_ENV === 'development' &&
            isErrorWithProps(error) && error.message ?
            { details: error.message } : {})
      }, { status: 500 });
    }
  };
}
