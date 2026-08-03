/**
 * TODO (next step): port ChatHub.AckMessageDelivered / AckMessagesSeen.
 * Best-effort — swallow errors, log and move on, never let a failed ack
 * tear down the socket connection (same behavior as the dotnet version).
 * Ordering will use Mongo ObjectId comparison ($lte on _id) in place of
 * the dotnet SequenceNumber field, and Message.receipts array updates via
 * arrayFilters for group conversations (per confirmed schema mapping).
 */
const registerReceiptHandlers = (socket) => {
  // placeholder — filled in next step
};

export { registerReceiptHandlers };
