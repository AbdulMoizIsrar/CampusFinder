export function canMarkReturned(status) { return status === 'claimed'; }
export function pendingStatus(remainingPending) { return remainingPending > 0 ? 'claim_pending' : 'open'; }
export function canReviewClaim(claimStatus, itemStatus) { return claimStatus === 'pending' && ['claim_pending', 'open'].includes(itemStatus); }
