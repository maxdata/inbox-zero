import { type gmail_v1 } from "googleapis";
import { parseMessage } from "@/utils/mail";
import { MessageWithPayload, isDefined } from "@/utils/types";
import { getBatch } from "@/utils/gmail/batch";

export async function getMessage(
  messageId: string,
  gmail: gmail_v1.Gmail,
  format?: "full",
): Promise<MessageWithPayload> {
  const message = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format,
  });

  return message.data as MessageWithPayload;
}

export async function getMessagesBatch(
  messageIds: string[],
  accessToken: string,
) {
  if (messageIds.length > 100) throw new Error("Too many messages. Max 100");

  const batch: MessageWithPayload[] = await getBatch(
    messageIds,
    "/gmail/v1/users/me/messages",
    accessToken,
  );

  const messages = batch.map((message) => {
    return {
      ...message,
      parsedMessage: parseMessage(message),
    };
  });

  return messages;
}

async function findPreviousEmailsBySender(
  gmail: gmail_v1.Gmail,
  options: {
    sender: string;
    dateInSeconds: number;
  },
) {
  const messages = await gmail.users.messages.list({
    userId: "me",
    q: `from:${options.sender} before:${options.dateInSeconds}`,
    maxResults: 2,
  });

  return messages.data.messages;
}

export async function hasPreviousEmailsFromSender(
  gmail: gmail_v1.Gmail,
  options: { from: string; date: string; threadId: string },
) {
  const previousEmails = await findPreviousEmailsBySender(gmail, {
    sender: options.from,
    dateInSeconds: +new Date(options.date) / 1000,
  });
  const hasPreviousEmail = !!previousEmails?.find(
    (p) => p.threadId !== options.threadId,
  );

  return hasPreviousEmail;
}

export async function getMessages(
  gmail: gmail_v1.Gmail,
  options: {
    query?: string;
    maxResults?: number;
  },
) {
  const messages = await gmail.users.messages.list({
    userId: "me",
    maxResults: options.maxResults,
    q: options.query,
  });

  return messages.data;
}

export async function queryBatchMessages(
  gmail: gmail_v1.Gmail,
  accessToken: string,
  {
    query,
    maxResults,
  }: {
    query?: string;
    maxResults?: number;
  },
) {
  const messages = await getMessages(gmail, { query, maxResults });
  if (!messages.messages) return [];
  const messageIds = messages.messages.map((m) => m.id).filter(isDefined);
  return getMessagesBatch(messageIds, accessToken);
}
