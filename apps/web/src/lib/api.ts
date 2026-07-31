const API_PREFIX =
  '/api/v1';

const CSRF_COOKIE =
  'crm_csrf';

export class ApiError
  extends Error {
  constructor(
    readonly status:
      number,

    message:
      string,
  ) {
    super(message);

    this.name =
      'ApiError';
  }
}

function getCookie(
  name: string,
): string | null {
  if (
    typeof document ===
    'undefined'
  ) {
    return null;
  }

  const encodedName =
    encodeURIComponent(
      name,
    );

  const prefix =
    `${encodedName}=`;

  const cookies =
    document.cookie
      .split('; ');

  const cookie =
    cookies.find(
      (item) =>
        item.startsWith(
          prefix,
        ),
    );

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(
    cookie.substring(
      prefix.length,
    ),
  );
}

function requiresCsrf(
  method:
    string,
): boolean {
  return ![
    'GET',
    'HEAD',
    'OPTIONS',
  ].includes(
    method,
  );
}

function isFormData(
  value:
    BodyInit | null | undefined,
): boolean {
  return (
    typeof FormData !==
      'undefined' &&
    value instanceof
      FormData
  );
}

interface ApiRequestOptions
  extends RequestInit {
  allowRefresh?:
    boolean;
}

async function parseError(
  response:
    Response,
): Promise<string> {
  try {
    const payload =
      await response
        .json() as {
          message?:
            | string
            | string[];
        };

    if (
      Array.isArray(
        payload.message,
      )
    ) {
      return payload.message
        .join(' ');
    }

    if (
      typeof payload.message ===
      'string'
    ) {
      return payload.message;
    }
  } catch {
    // Resposta sem JSON.
  }

  return (
    response.statusText ||
    'Erro inesperado.'
  );
}

async function refreshSession():
  Promise<boolean> {
  const csrfToken =
    getCookie(
      CSRF_COOKIE,
    );

  if (!csrfToken) {
    return false;
  }

  try {
    const response =
      await fetch(
        `${API_PREFIX}/auth/refresh`,
        {
          method:
            'POST',

          credentials:
            'include',

          cache:
            'no-store',

          headers: {
            'x-csrf-token':
              csrfToken,
          },
        },
      );

    return response.ok;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(
  path:
    string,

  options:
    ApiRequestOptions = {},
): Promise<T> {
  const method =
    (
      options.method ??
      'GET'
    ).toUpperCase();

  const headers =
    new Headers(
      options.headers,
    );

  if (
    options.body &&
    !headers.has(
      'Content-Type',
    ) &&
    !isFormData(
      options.body,
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  if (
    requiresCsrf(
      method,
    )
  ) {
    const csrfToken =
      getCookie(
        CSRF_COOKIE,
      );

    if (csrfToken) {
      headers.set(
        'x-csrf-token',
        csrfToken,
      );
    }
  }

  const response =
    await fetch(
      `${API_PREFIX}${path}`,
      {
        ...options,

        method,

        headers,

        credentials:
          'include',

        cache:
          'no-store',
      },
    );

  const allowRefresh =
    options.allowRefresh ??
    true;

  const shouldRefresh =
    response.status ===
      401 &&
    allowRefresh &&
    path !==
      '/auth/login' &&
    path !==
      '/auth/refresh';

  if (
    shouldRefresh
  ) {
    const refreshed =
      await refreshSession();

    if (refreshed) {
      return apiRequest<T>(
        path,
        {
          ...options,

          allowRefresh:
            false,
        },
      );
    }
  }

  if (!response.ok) {
    const message =
      await parseError(
        response,
      );

    throw new ApiError(
      response.status,
      message,
    );
  }

  if (
    response.status ===
    204
  ) {
    return undefined as T;
  }

const payload: T =
  await response.json();

return payload;
}