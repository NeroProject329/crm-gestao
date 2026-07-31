export const dynamic =
  'force-dynamic';

export function GET():
  Response {
  return Response.json(
    {
      status:
        'ok',

      service:
        'crm-web',
    },

    {
      status:
        200,

      headers: {
        'Cache-Control':
          'no-store, max-age=0',
      },
    },
  );
}