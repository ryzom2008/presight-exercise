# API reference

The API is served under `/api`. Requests and responses use JSON. In local development the
server runs at `http://localhost:3001`; Docker Compose serves the client and API from the
same address.

## Health check

### `GET /api/health`

Returns `200 OK` when the server is running.

```json
{
  "status": "ok"
}
```

## Search users

### `POST /api/users/search`

Returns one page of users matching the supplied filters. Send an empty object to use all
defaults.

```json
{
  "q": "ana",
  "nationalities": ["French", "German"],
  "hobbies": ["Reading", "Swimming"],
  "sort": "age",
  "direction": "desc",
  "offset": 0,
  "limit": 20
}
```

| Field           | Type     | Default        | Validation and behavior                                                                                                                |
| --------------- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `q`             | string   | `""`           | Maximum 200 characters. Matches first name, last name, or full name case-insensitively. SQL wildcard characters are treated literally. |
| `nationalities` | string[] | `[]`           | Maximum 195 values, each 1–100 characters. A user may match any selected nationality.                                                  |
| `hobbies`       | string[] | `[]`           | Maximum 10 values, each 1–100 characters. A user must have every selected hobby.                                                       |
| `sort`          | string   | `"first_name"` | One of `first_name`, `last_name`, `age`, or `nationality`.                                                                             |
| `direction`     | string   | `"asc"`        | Either `asc` or `desc`. The user ID is the final tie-breaker in the same direction.                                                    |
| `offset`        | integer  | `0`            | Minimum 0.                                                                                                                             |
| `limit`         | integer  | `20`           | From 1 to 100.                                                                                                                         |

Text, nationality, and hobby filters apply together. Filter strings are trimmed,
case-insensitive, deduplicated, and normalized by the server.

Example response:

```json
{
  "users": [
    {
      "id": 42,
      "avatar": "https://api.dicebear.com/10.x/lorelei/svg?seed=42&size=96",
      "first_name": "Ana",
      "last_name": "Smith",
      "age": 30,
      "nationality": "French",
      "hobbies": ["Reading", "Swimming"]
    }
  ],
  "pagination": {
    "total": 37,
    "offset": 0,
    "limit": 20,
    "hasMore": true,
    "nextOffset": 20
  }
}
```

`nextOffset` is `null` when no more users are available. Pass a non-null `nextOffset` as
the next request's `offset` to continue pagination.

## Get filter options

### `POST /api/users/filter-options`

Returns the top 20 hobbies and nationalities for the active text and selected filters.
It accepts only `q`, `nationalities`, and `hobbies`, with the same validation and matching
rules as the search endpoint.

```json
{
  "q": "ana",
  "nationalities": ["French"],
  "hobbies": ["Reading"]
}
```

Example response:

```json
{
  "hobbies": [
    { "value": "Reading", "count": 18 },
    { "value": "Swimming", "count": 9 }
  ],
  "nationalities": [{ "value": "French", "count": 18 }]
}
```

Counts include all matching users, independent of search pagination. Options are ordered
by count descending and then alphabetically. Sorting and pagination fields are rejected
because they do not affect these counts.

## Errors

Errors use this shape:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "limit: Too big: expected number to be <=100"
  }
}
```

| Status | Code                     | Meaning                                                                 |
| ------ | ------------------------ | ----------------------------------------------------------------------- |
| `400`  | `INVALID_QUERY`          | The body contains an unknown, incorrectly typed, or out-of-range field. |
| `400`  | `INVALID_JSON`           | The request body is malformed JSON.                                     |
| `413`  | `BODY_TOO_LARGE`         | The JSON body exceeds 16 KB.                                            |
| `415`  | `UNSUPPORTED_MEDIA_TYPE` | A body was sent with a content type other than `application/json`.      |
| `500`  | `INTERNAL_ERROR`         | The server could not load users. Internal details are not exposed.      |

Unknown `/api` routes return `404` with `{ "error": { "message": "API route not found" } }`.
