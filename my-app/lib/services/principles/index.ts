import "server-only";

/**
 * The public surface. Nothing outside this folder imports
 * `principles.service.ts` or `principles.util.ts` directly (PLAN §5.3).
 */

export {
  listPrinciples,
  listPrinciplesWithUsage,
  listActivePrinciples,
  principlesByCode,
  principleIdsByCode,
  type Principle,
  type PrincipleWithUsage,
  type PrincipleIndex,
  type PrincipleRef,
} from "./principles.service";
