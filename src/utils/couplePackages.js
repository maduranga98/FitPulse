// Couple packages: one package, two members, ONE payer.
//
// The gym sells a package that covers two people. Only one of them hands over
// the money, so without an explicit link the second person looks like an
// unpaid member on every screen — and the scheduled job eventually blocks
// them for a payment that was, in fact, collected.
//
// The link is therefore stored on BOTH member documents so that any screen
// holding a single member can answer "who is the other one, and who pays?"
// without loading the whole roster:
//
//   partnerId    the other member's id
//   partnerName  denormalised for display (lists render before a lookup)
//   payerId      id of whichever of the two settles the couple fee
//
// `payerId` is one of the two member ids, never a third party. The member
// whose id equals payerId is the PAYER; the other is COVERED. The couple fee
// lives on the payer's membershipFee; the covered partner's fee is set to 0
// so a single couple package is never counted twice in an outstanding total.
//
// A package is marked as a couple package in gym settings (`isCouple`), which
// is what makes the partner picker appear while registering a member.

/** Is this settings package sold for two people? */
export const isCouplePackage = (pkg) => pkg?.isCouple === true;

/** Is this member linked to a partner under a couple package? */
export const isCoupleMember = (member) => !!member?.partnerId;

/**
 * Does this member pay the couple fee?
 * A linked member with no payerId recorded (data written before the link had
 * a payer, or hand-edited) is treated as paying for themselves — the safe
 * direction, because it keeps them visible as unpaid rather than silently
 * marking them settled by someone who never paid.
 */
export const isCouplePayer = (member) =>
  isCoupleMember(member) && (!member?.payerId || member.payerId === member.id);

/** Is this member's fee settled by their partner? */
export const isCoveredByPartner = (member) =>
  isCoupleMember(member) && !!member?.payerId && member.payerId !== member.id;

/** The member ids whose payments settle this member's dues (self, plus payer). */
export const payingMemberIdsFor = (member) =>
  isCoveredByPartner(member) ? [member.id, member.payerId] : [member.id];

/** The linked partner's full record, when the roster is at hand. */
export const findPartner = (member, members) =>
  member?.partnerId
    ? (members || []).find((m) => m.id === member.partnerId) || null
    : null;

/**
 * Has this member's fee been settled for `month`?
 *
 * For a covered partner this is true as soon as the PAYER has a payment
 * recorded for the month — that is the whole point of the link, and what
 * stops the partner from being chased or blocked.
 */
export const hasPaidForMonth = (member, payments, month) => {
  if (!member) return false;
  const ids = payingMemberIdsFor(member);
  return (payments || []).some(
    (p) => p.month === month && ids.includes(p.memberId),
  );
};

/** Short label for a card or a report cell. */
export const coupleRoleLabel = (member) => {
  if (!isCoupleMember(member)) return "";
  return isCouplePayer(member)
    ? `Couple — pays for ${member.partnerName || "partner"}`
    : `Couple — paid by ${member.partnerName || "partner"}`;
};

/**
 * The two Firestore patches that link `member` and `partner`.
 *
 * Both documents are written together: a one-sided link is worse than no link
 * at all, because only one of the two screens would know about it.
 * `packageId`/`packageName` are carried onto the partner so both members show
 * the same package, and the covered partner's fee is zeroed so the couple
 * price is collected exactly once.
 */
export const buildCoupleLinkUpdates = ({ member, partner, payerId, pkg }) => {
  const shared = {
    ...(pkg
      ? {
          packageId: pkg.id || "",
          packageName: pkg.name || "",
          packageDuration: parseInt(pkg.duration) || 1,
          isCouplePackage: true,
        }
      : { isCouplePackage: true }),
    payerId,
  };

  const feeFor = (m) => {
    if (m.isVip) return 0;
    if (m.id !== payerId) return 0; // covered partner — the payer holds the fee
    return pkg ? parseFloat(pkg.price) || 0 : parseFloat(m.membershipFee) || 0;
  };

  return {
    [member.id]: {
      ...shared,
      partnerId: partner.id,
      partnerName: partner.name || "",
      membershipFee: feeFor(member),
    },
    [partner.id]: {
      ...shared,
      partnerId: member.id,
      partnerName: member.name || "",
      membershipFee: feeFor(partner),
    },
  };
};

/** The patch that removes a couple link from one member document. */
export const coupleUnlinkUpdate = () => ({
  partnerId: "",
  partnerName: "",
  payerId: "",
  isCouplePackage: false,
});
