Shareable URL Encoding

Overview
- The calculator and Agent Builder state is stored in a single URL parameter `s`.
- The value is a Base64‑URL string containing a compact JSON payload.
- The payload is versioned so links stay stable across future updates.

Payload shape
- Object with two properties: `{ v: number, d: any[] }`
- `v` is the schema version. Current version is `2`.
- `d` is a compact array whose element order is fixed by version.

Version 2 (current)
- d[0]  messages: integer
- d[1]  bufferPct: number
- d[2]  paygRate: number
- d[3]  packPrice: number
- d[4]  packSize: integer
- d[5]  vatOn: 1 | 0
- d[6]  vatRate: number
- d[7]  totalUsers: integer
- d[8]  licensedUsers: integer
- d[9]  m365Apply: 1 | 0
- d[10] agentName: string
- d[11] expectedRuns: integer (Agent Builder)
- d[12] nodes: Array<NodeCompact>

NodeCompact
- Each node is encoded as `[typeKey, qty, actions, name]`
- `typeKey` is a 1‑letter code:
  - c: classic
  - g: generative
  - t: tenant
  - f: flow
  - b: toolBasic
  - s: toolStandard
  - p: toolPremium
  - w: web

Version 1 (legacy links)
- d[0..10] match v2 up to agentName and stop there (no expectedRuns, no nodes).
- v1 is still accepted and auto‑upgraded into the current UI.

Encoding details
1) Build the payload object as above.
2) `JSON.stringify(payload)`
3) UTF‑8 encode to bytes
4) Base64 encode, then make it URL‑safe: replace `+` with `-`, `/` with `_`, and strip trailing `=`

Decoding does the reverse and then applies defaults for any missing values.

Stability contract (keep links working)
- Never reorder existing fields within a given version.
- When adding fields, append at the end of `d` and bump `v`.
- Decoders must:
  - Accept older versions (v <= current), mapping whatever fields exist.
  - Tolerate extra array elements (ignore unknowns).
- Encoders should always emit the latest version.

Where implemented in code
- Encode/decode helpers: `app.js:267` (`encodeState`, `decodeState`)
- Gather current state: `app.js:281` (`gatherState`) — emits `{ v:2, d:[…] }`
- Apply state from URL: `app.js:296` (`applyState`) — accepts v1 and v2
- Keep address bar in sync: `app.js:313` (`updateShareUrl`)
- Initial load from URL: `app.js:338` (after nodes/uid are defined)

Example
- Example v2 payload (pretty JSON):
  { "v":2, "d":[50000,20,0.008,153.8,25000,1,20,100,0,0,"Policy helper",1000,[["f",1,3,"Agent flow"]] ] }
- After Base64‑URL encoding it becomes a short token in `?s=…`

Notes
- The encoded token is not meant to be a security boundary — it is only a compact representation.
- Do not store secrets or PII in the token.
