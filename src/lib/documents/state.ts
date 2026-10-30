/** Display state of an issued document: superseded = revoked by a reissue; expired = past its validity date. */
export function documentState(d: { status: string; valid_until: string | null; revoke_reason: string | null }) {
  if (d.status === "revoked") return d.revoke_reason?.startsWith("Superseded:") ? "superseded" : "revoked";
  if (d.valid_until && d.valid_until < new Date().toISOString().slice(0, 10)) return "expired";
  return "valid";
}
