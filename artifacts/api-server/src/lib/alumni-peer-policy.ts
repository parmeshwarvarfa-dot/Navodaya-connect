import { isValidJnvSelection } from "@workspace/api-zod";
import { makeJnvId } from "./jnv-identity";

export type PeerIdentity = {
  id: string;
  role: string;
  jnvId: string | null;
  jnvName: string;
  jnvState: string;
  verificationStatus: string | null;
};

export function hasValidAlumniSchool(identity: PeerIdentity): boolean {
  return identity.role === "alumni"
    && Boolean(identity.jnvId)
    && identity.jnvId === makeJnvId(identity.jnvState, identity.jnvName)
    && isValidJnvSelection(identity.jnvState, identity.jnvName);
}

export function alumniPeerEligibility(actor: PeerIdentity, applicant: PeerIdentity): "eligible" | "role" | "self" | "school" | "restricted" {
  if (actor.role !== "alumni" || applicant.role !== "alumni") return "role";
  if (actor.id === applicant.id) return "self";
  if (!hasValidAlumniSchool(actor) || !hasValidAlumniSchool(applicant) || actor.jnvId !== applicant.jnvId) return "school";
  if (["under_review", "suspended", "revoked"].includes(actor.verificationStatus ?? "")
    || ["under_review", "suspended", "revoked"].includes(applicant.verificationStatus ?? "")) return "restricted";
  return "eligible";
}
