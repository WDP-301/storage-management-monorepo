# API response contract

JSON endpoints under `/api/v1` use one envelope.

## Success

```json
{"success":true,"statusCode":200,"code":"SUCCESS","message":"Request successful","data":{},"requestId":"...","timestamp":"...","path":"/api/v1/..."}
```

## Error

```json
{"success":false,"statusCode":400,"code":"VALIDATION_FAILED","message":"Validation failed","details":{"fields":[{"field":"email","code":"isEmail","message":"email must be an email"}]},"requestId":"...","timestamp":"...","path":"/api/v1/..."}
```

Clients may send `X-Request-Id` using letters, numbers, `.`, `_`, `:`, or `-` (maximum 128 characters). Otherwise the API generates a UUID. The same ID is returned in the header and body and included in HTTP logs.

Error codes are stable machine-readable values grouped by validation, authentication, upload/resource, throttling, availability, and internal errors. Human-readable messages may evolve.

## Status and envelope policy

- Registration and upload creation remain `201`; normal reads/actions remain `200` for compatibility.
- Logout and upload deletion remain idempotent `200` with a response body to avoid a breaking change.
- `GET /health/live` checks process liveness. `GET /health/ready` returns `503` when PostgreSQL or configured object storage is unavailable. `GET /health` is the backward-compatible readiness alias.
- Binary streams and explicitly decorated raw endpoints are not JSON-enveloped, but still return `X-Request-Id`.
- `204 No Content` responses are never enveloped.
- Internal `500` details are logged server-side; responses never expose stack traces or vendor error messages.
