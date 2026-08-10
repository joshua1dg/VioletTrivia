import "server-only";

/** The public surface (PLAN §5.3). */

export {
  registerParticipant,
  getParticipant,
  ensureParticipant,
  type Participant,
} from "./participants.service";
